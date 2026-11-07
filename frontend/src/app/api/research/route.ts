import path from 'node:path';
import { loadRuntimeDeployment } from '../../../../../backend/lib/runtime-deployment.mjs';
import { sameDeployment } from '../../../../../shared/runtime-deployment.mjs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { sessionResponse } from '../../../lib/session-response.mjs';
import { createWorkbenchStore } from '../../../../../backend/workbench/store.mjs';
import { defaultConfig } from '../../../../../backend/workbench/config.mjs';
import { createRun, readRun, listRuns, controlRun, deleteRun } from '../../../../../backend/workbench/research.mjs';

const headers = { 'Cache-Control': 'no-store' };
function workspace() {
  const root = process.env.JANUS_WORKSPACE_ROOT || (existsSync(path.join(process.cwd(), 'backend/workbench')) ? process.cwd() : path.resolve(process.cwd(), '..'));
  if (!existsSync(path.join(root, 'backend/workbench/research-supervisor.mjs'))) throw new Error('Full Janus checkout required');
  return { root, state: process.env.JANUS_WORKBENCH_STATE_DIR || path.join(root, '.workbench-state') };
}
async function identity(request: Request) {
  const result = await sessionResponse(request);
  if (!result.ok) throw new Error('Sign in to manage research runs');
  return (await result.json()).userId as string;
}
function launch(root: string, state: string, user: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'backend/workbench/research-supervisor.mjs')], {
      cwd: root, detached: true, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.once('error', reject);
    child.stdin.on('error', reject);
    child.once('spawn', () => {
      child.stdin.end(JSON.stringify({ root: state, user, id }), () => { child.unref(); resolve(); });
    });
  });
}
export async function GET(request: Request) {
  let user: string;
  try { user = await identity(request); } catch { return Response.json({ error: 'Sign in to view runs' }, { status: 401, headers }); }
  try {
    const { state } = workspace(), url = new URL(request.url), id = url.searchParams.get('id');
    if (id) return Response.json({ run: await readRun(state, user, id) }, { headers });
    const runs = await listRuns(state, user);
    return Response.json({ runs: runs.map(({ id, question, status, mode, createdAt }: { id: string; question: string; status: string; mode: string; createdAt: string }) => ({ id, question, status, mode, createdAt })) }, { headers });
  } catch { return Response.json({ error: 'Run unavailable in this account' }, { status: 404, headers }); }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-origin request rejected' }, { status: 403, headers });
  let user: string;
  try { user = await identity(request); } catch { return Response.json({ error: 'Sign in to manage runs' }, { status: 401, headers }); }
  try {
    let raw = ''; let bytes = 0; const decoder = new TextDecoder();
    if (!request.body) throw new Error('Request body required');
    for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) { bytes += chunk.length; if (bytes > 32768) throw new Error('Request too large'); raw += decoder.decode(chunk, { stream: true }); }
    const body = JSON.parse(raw + decoder.decode()), { root, state } = workspace();
    if (body.action === 'create') {
      const config = await createWorkbenchStore(path.join(state, 'vault')).config(user) || defaultConfig;
      const { deployment } = await loadRuntimeDeployment({ verify: Boolean(process.env.JANUS_DEPLOYMENT_FILE) });
      const run = await createRun(state, user, { ...body, config, deployment });
      try { await launch(root, state, user, run.id); }
      catch { await controlRun(state, user, run.id, 'cancel'); throw new Error('Supervisor could not start; run cancelled'); }
      return Response.json({ run }, { status: 201, headers });
    }
    if (body.action === 'delete') {
      if (body.confirmDelete !== true) throw new Error('Confirm permanent deletion of local research; payment records and provider copies remain');
      return Response.json(await deleteRun(state, user, body.id), { headers });
    }
    if (body.action === 'resume') {
      const saved = await readRun(state, user, body.id);
      const { deployment } = await loadRuntimeDeployment({ verify: Boolean(process.env.JANUS_DEPLOYMENT_FILE) });
      if (saved.deployment && !sameDeployment(saved.deployment, deployment)) throw new Error('Run deployment changed; reconcile before resuming');
    }
    const run = await controlRun(state, user, body.id, body.action);
    if (body.action === 'resume') await launch(root, state, user, body.id);
    return Response.json({ run }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Run request failed' }, { status: 400, headers }); }
}
