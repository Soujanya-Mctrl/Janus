import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { GET, POST } from '../src/app/api/research/route.ts';
import { createRun, readRun } from '../../backend/workbench/research.mjs';
import { defaultConfig } from '../../backend/workbench/config.mjs';

test('research routes enforce identity, billable consent, and account-private durable execution', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-research-api-'));
  const names = ['JANUS_WORKBENCH_STATE_DIR', 'NEXT_PUBLIC_PRIVY_APP_ID', 'PRIVY_VERIFICATION_KEY'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(async () => { for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; } await fs.rm(root, { recursive: true, force: true }); });
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  process.env.JANUS_WORKBENCH_STATE_DIR = root;
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'fixture-research-app';
  process.env.PRIVY_VERIFICATION_KEY = await exportSPKI(publicKey);
  const token = sub => new SignJWT({ sub, aud: 'fixture-research-app', iss: 'privy.io', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300 }).setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
  const owner = await token('did:privy:research-owner'), other = await token('did:privy:other');
  const request = (access, body, query = '') => new Request('http://localhost/api/research' + query, { method: body ? 'POST' : 'GET', headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await GET(request(null))).status, 401);
  assert.equal((await POST(request(null, { action: 'create' }))).status, 401);
  const cross = new Request('http://localhost/api/research', { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' });
  assert.equal((await POST(cross)).status, 403);
  assert.equal((await POST(request(owner, { action: 'create', mode: 'llm', question: 'Research this question.' }))).status, 400);
  const response = await POST(request(owner, { action: 'create', mode: 'fixture', question: 'How do paid research artifacts survive worker failure?', interrupt: true, deployment: { chainId: 999 } }));
  assert.equal(response.status, 201);
  const { run } = await response.json();
  assert.equal(run.deployment.chainId, 296, 'deployment comes from server configuration, never the request');
  assert.equal((await GET(request(other, null, '?id=' + run.id))).status, 404);
  assert.deepEqual((await (await GET(request(other))).json()).runs, []);
  let result;
  for (let i = 0; i < 80; i++) {
    result = (await (await GET(request(owner, null, '?id=' + run.id))).json()).run;
    if (['completed', 'failed', 'reconciling'].includes(result.status)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(result.status, 'completed', result.error);
  assert.ok(result.report.text.includes('Research fixture report'));
  assert.ok(result.events.some(event => event.type === 'worker-replaced'));
  assert.equal((await (await GET(request(owner))).json()).runs[0].id, run.id);
  assert.equal((await POST(request(other, { action: 'delete', id: run.id, confirmDelete: true }))).status, 400);
  assert.equal((await POST(request(owner, { action: 'delete', id: run.id }))).status, 400);
  assert.equal((await POST(request(owner, { action: 'delete', id: run.id, confirmDelete: true }))).status, 200);
  assert.equal((await GET(request(owner, null, '?id=' + run.id))).status, 404);
  const changed = await createRun(root, 'did:privy:research-owner', {
    config: defaultConfig, question: 'Can this run resume on a different deployment?', mode: 'fixture',
    deployment: { ...run.deployment, treasury: run.deployment.token },
  });
  const resume = await POST(request(owner, { action: 'resume', id: changed.id }));
  assert.equal(resume.status, 400);
  assert.match((await resume.json()).error, /deployment changed/);
  const unchanged = await readRun(root, 'did:privy:research-owner', changed.id);
  assert.equal(unchanged.status, 'queued');
  assert.deepEqual(unchanged.events, [], 'a mismatched resume never dispatches a worker');
});
