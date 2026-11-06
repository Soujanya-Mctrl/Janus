import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { sessionResponse as session } from '../../../lib/session-response.mjs';
import { createWorkbenchStore } from '../../../../../backend/workbench/store.mjs';
import { defaultConfig, validateWorkbenchConfig } from '../../../../../backend/workbench/config.mjs';

const headers = { 'Cache-Control': 'no-store' };
const root = () => {
  const configured = process.env.JANUS_WORKSPACE_ROOT;
  const candidate = configured || (existsSync(path.join(process.cwd(), 'backend', 'workbench')) ? process.cwd() : path.resolve(process.cwd(), '..'));
  if (!existsSync(path.join(candidate, 'backend', 'workbench', 'run.mjs'))) throw new Error('Backend workspace not found; set JANUS_WORKSPACE_ROOT');
  return candidate;
};
const stateRoot = () => process.env.JANUS_WORKBENCH_STATE_DIR || path.join(root(), '.workbench-state');
const store = () => createWorkbenchStore(path.join(stateRoot(), 'vault'));
const ownerFolder = (user: string) => createHash('sha256').update(user).digest('hex');
async function identity(request: Request) {
  const verified = await session(request);
  if (!verified.ok) throw new Error('Sign in with Privy to manage credentials and agents');
  return (await verified.json()).userId as string;
}
async function input(request: Request) {
  const reader = request.body?.getReader();
  let total = 0, value = '';
  if (!reader) throw new Error('Request body required');
  const decoder = new TextDecoder();
  for (;;) {
    const chunk = await reader.read(); if (chunk.done) break;
    total += chunk.value.length;
    if (total > 32768) { await reader.cancel(); throw new Error('Request body too large'); }
    value += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(value + decoder.decode()); } catch { throw new Error('Invalid JSON request'); }
}
export async function GET(request: Request) {
  try {
    const user = await identity(request), url = new URL(request.url);
    if (url.searchParams.get('run')) {
      const id = url.searchParams.get('run')!;
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID');
      const file = path.join(stateRoot(), 'runs', ownerFolder(user), id, 'result.json');
      try { return Response.json({ result: JSON.parse(await fs.readFile(file, 'utf8')) }, { headers }); }
      catch { return Response.json({ error: 'Run has not completed or does not belong to this account' }, { status: 404, headers }); }
    }
    return Response.json({ credentials: await store().list(user), config: await store().config(user) ?? defaultConfig }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 401, headers }); }
}
const slots = globalThis as typeof globalThis & { janusWorkbenchActive?: number };
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-origin request rejected' }, { status: 403, headers });
    const body = await input(request);
    const demo = body.action === 'runDemo';
    const user = demo ? 'guest-fixture' : await identity(request);
    if (body.action === 'saveCredential') return Response.json({ credential: await store().saveCredential(user, body.credential) }, { headers });
    if (body.action === 'removeCredential') { await store().removeCredential(user, body.id); return Response.json({ removed: true }, { headers }); }
    if (body.action === 'saveConfig') {
      const config = validateWorkbenchConfig(body.config); await store().saveConfig(user, config);
      return Response.json({ config }, { headers });
    }
    const resume = body.action === 'resume';
    if (!demo && body.action !== 'run' && !resume) throw new Error('Unknown workbench action');
    if ((slots.janusWorkbenchActive ?? 0) >= 2) return Response.json({ error: 'Two simulations are already running; retry when one finishes' }, { status: 429, headers });
    const runId = resume ? body.runId : randomUUID();
    if (typeof runId !== 'string' || !/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Invalid run ID');
    const directory = path.join(stateRoot(), 'runs', ownerFolder(user), runId);
    let previous;
    if (resume) {
      try { previous = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8')); }
      catch { throw new Error('Saved run not found in this account'); }
    }
    const config = previous?.config ?? (demo ? { ...structuredClone(defaultConfig), interrupt: body.interrupt !== false } : await store().config(user));
    if (!config) throw new Error('Save your agent configuration first');
    const mode = previous?.mode ?? (demo ? 'fixture' : body.mode);
    if (!['fixture', 'llm'].includes(mode)) throw new Error('Choose fixture or live LLM mode');
    if (mode === 'llm' && body.confirmProviderBilling !== true) throw new Error('Confirm separate provider billing before live inference');
    const credentials: Record<string, unknown> = {};
    if (mode === 'llm') for (const agent of config.agents) {
      if (!agent.credentialId || !agent.model) throw new Error(`Assign a credential and model to ${agent.name}`);
      credentials[agent.credentialId] = await store().credential(user, agent.credentialId);
    }
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    if (!resume) await fs.writeFile(path.join(directory, 'metadata.json'), JSON.stringify({ config, mode }), { flag: 'wx', mode: 0o600 });
    const encoder = new TextEncoder();
    slots.janusWorkbenchActive = (slots.janusWorkbenchActive ?? 0) + 1;
    const stream = new ReadableStream({ start(controller) {
      let connected = true, closed = false;
      const send = (value: unknown) => { if (connected) try { controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')); } catch { connected = false; } };
      send({ kind: 'started', runId });
      const child = spawn(process.execPath, [path.join(root(), 'backend', 'workbench', 'run.mjs')], { cwd: root(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      // Secrets travel through stdin only, never command arguments or disk.
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify({ directory, config, mode, credentials }));
      let pending = '', terminal = false;
      child.stdout.on('data', (chunk: Buffer) => {
        pending += chunk.toString('utf8');
        for (;;) {
          const end = pending.indexOf('\n'); if (end < 0) break;
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          try { const message = JSON.parse(line); if (['result', 'error'].includes(message.kind)) terminal = true; send(message); } catch { /* no raw process output */ }
        }
      });
      child.stderr.resume();
      const finish = () => {
        if (closed) return; closed = true;
        slots.janusWorkbenchActive = Math.max(0, (slots.janusWorkbenchActive ?? 1) - 1);
        if (!terminal) send({ kind: 'error', error: 'Simulation process stopped. Retain the run ID and inspect its journal before retrying.' });
        if (connected) try { controller.close(); } catch { /* client disconnected */ }
      };
      child.on('error', finish); child.on('close', finish);
    } });
    return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workbench request failed';
    return Response.json({ error: message }, { status: message.startsWith('Sign in') ? 401 : 400, headers });
  }
}
