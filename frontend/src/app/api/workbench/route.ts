import path from 'node:path';
import { existsSync } from 'node:fs';
import { sessionResponse as session } from '../../../lib/session-response.mjs';
import { createWorkbenchStore } from '../../../../../backend/workbench/store.mjs';
import { defaultConfig, validateWorkbenchConfig } from '../../../../../backend/workbench/config.mjs';

const headers = { 'Cache-Control': 'no-store' };
const root = () => {
  const configured = process.env.JANUS_WORKSPACE_ROOT;
  const candidate = configured || (existsSync(path.join(process.cwd(), 'backend', 'workbench')) ? process.cwd() : path.resolve(process.cwd(), '..'));
  if (!existsSync(path.join(candidate, 'backend', 'workbench', 'store.mjs'))) throw new Error('Backend workspace not found; set JANUS_WORKSPACE_ROOT');
  return candidate;
};
const stateRoot = () => process.env.JANUS_WORKBENCH_STATE_DIR || path.join(root(), '.workbench-state');
const store = () => createWorkbenchStore(path.join(stateRoot(), 'vault'));
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
    const user = await identity(request);
    if (new URL(request.url).searchParams.has('run')) return Response.json({ error: 'Run retrieval is unavailable' }, { status: 410, headers });
    const saved = await store().config(user);
    let config = defaultConfig;
    if (saved?.workflow === 'research-v1') config = validateWorkbenchConfig(saved);
    return Response.json({ credentials: await store().list(user), config }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 401, headers }); }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-origin request rejected' }, { status: 403, headers });
  let user: string;
  try { user = await identity(request); }
  catch { return Response.json({ error: 'Sign in with Privy to manage credentials and agents' }, { status: 401, headers }); }
  try {
    const body = await input(request);
    if (body.action === 'saveCredential') return Response.json({ credential: await store().saveCredential(user, body.credential) }, { headers });
    if (body.action === 'removeCredential') { await store().removeCredential(user, body.id); return Response.json({ removed: true }, { headers }); }
    if (body.action === 'saveConfig') {
      const config = validateWorkbenchConfig(body.config);
      // A configuration may only refer to this identity's saved credentials.
      for (const agent of config.agents) if (agent.credentialId) await store().credential(user, agent.credentialId);
      await store().saveConfig(user, config);
      return Response.json({ config }, { headers });
    }
    return Response.json({ error: 'Execution is not available through this configuration endpoint' }, { status: 400, headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 400, headers }); }
}
