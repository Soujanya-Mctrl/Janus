import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET } from '../src/app/api/workbench/route.ts';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';

test('credential and config routes reject unauthenticated or cross-origin access', async () => {
  const request = body => new Request('http://localhost/api/workbench', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const action of ['saveCredential', 'saveConfig', 'removeCredential', 'run']) {
    const response = await POST(request({ action }));
    assert.equal(response.status, 401); assert.ok(!JSON.stringify(await response.json()).includes('key:'));
  }
  assert.equal((await GET(new Request('http://localhost/api/workbench'))).status, 401);
  const crossOrigin = new Request('http://localhost/api/workbench', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' });
  assert.equal((await POST(crossOrigin)).status, 403);
});

test('verified accounts can save keys but cannot read or revoke another account credential', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-route-test-'));
  const names = ['JANUS_WORKBENCH_STATE_DIR', 'NEXT_PUBLIC_PRIVY_APP_ID', 'PRIVY_VERIFICATION_KEY'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(async () => {
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    await fs.rm(directory, { recursive: true, force: true });
  });
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  process.env.JANUS_WORKBENCH_STATE_DIR = directory;
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'fixture-app';
  process.env.PRIVY_VERIFICATION_KEY = await exportSPKI(publicKey);
  const token = sub => new SignJWT({ sub, aud: 'fixture-app', iss: 'privy.io', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 }).setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
  const owner = await token('did:privy:owner'), other = await token('did:privy:other');
  const req = (access, body) => new Request('http://localhost/api/workbench', { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${access}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const response = await POST(req(owner, { action: 'saveCredential', credential: { provider: 'groq', label: 'fixture', key: 'fixture-api-key-never-returned' } }));
  assert.equal(response.status, 200); const payload = await response.json();
  assert.ok(!JSON.stringify(payload).includes('fixture-api-key-never-returned'));
  assert.equal((await (await GET(req(other))).json()).credentials.length, 0);
  await POST(req(other, { action: 'removeCredential', id: payload.credential.id }));
  assert.equal((await (await GET(req(owner))).json()).credentials.length, 1);
});
