import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { createWorkbenchStore } from './store.mjs';
import { callProvider } from './providers.mjs';
import { defaultConfig, validateWorkbenchConfig } from './config.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-workbench-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
test('vault encrypts keys, scopes records to identities, and revokes credentials', async t => {
  const directory = await fixture(t), store = createWorkbenchStore(directory, randomBytes(32).toString('base64'));
  const user = 'did:privy:owner', key = 'fixture-key-never-expose-12345';
  const record = await store.saveCredential(user, { provider: 'gemini', label: 'Research', key });
  assert.equal(record.provider, 'gemini'); assert.ok(!JSON.stringify(record).includes(key));
  const files = await fs.readdir(directory);
  assert.ok(!(await fs.readFile(path.join(directory, files.find(file => /^[a-f0-9]{64}\.vault$/.test(file))), 'utf8')).includes(key));
  assert.equal((await store.credential(user, record.id)).key, key);
  assert.deepEqual(await store.list('did:privy:other'), []);
  await assert.rejects(store.credential('did:privy:other', record.id), /not found/);
  await store.saveConfig(user, defaultConfig); assert.deepEqual(await store.config(user), defaultConfig);
  await store.removeCredential(user, record.id);
  await assert.rejects(store.credential(user, record.id), /not found/);
});
test('tampered vault and missing encryption configuration fail closed', async t => {
  const directory = await fixture(t), key = randomBytes(32).toString('base64');
  const store = createWorkbenchStore(directory, key);
  await store.saveCredential('did:privy:owner', { provider: 'openai', label: 'test', key: 'fixture-credential-secret' });
  const file = path.join(directory, (await fs.readdir(directory)).find(name => /^[a-f0-9]{64}\.vault$/.test(name)));
  const envelope = JSON.parse(await fs.readFile(file, 'utf8')); envelope.tag = randomBytes(16).toString('base64');
  await fs.writeFile(file, JSON.stringify(envelope));
  await assert.rejects(store.list('did:privy:owner'), /could not be decrypted/);
  await assert.rejects(createWorkbenchStore(directory, 'short').list('did:privy:owner'), /32 bytes/);
});
test('popular providers use fixed endpoints and return sanitized metadata', async () => {
  for (const provider of ['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'nvidia']) {
    const result = await callProvider({ credential: { provider, key: 'fixture-private-key' }, model: 'fixture-model', prompt: 'research task',
      fetchImpl: async (endpoint, options) => {
        assert.ok(endpoint.startsWith('https://')); assert.ok(!endpoint.includes('fixture-private-key'));
        assert.equal(options.redirect, 'error');
        const data = { id: 'request-fixture', output: [{ content: [{ type: 'output_text', text: 'hold' }] }],
          content: [{ type: 'text', text: 'hold' }], candidates: [{ content: { parts: [{ text: 'hold' }] } }], choices: [{ message: { content: 'hold' } }] };
        return new Response(JSON.stringify(data));
      } });
    assert.equal(result.text, 'hold'); assert.ok(!JSON.stringify(result).includes('fixture-private-key'));
  }
  await assert.rejects(callProvider({ credential: { provider: 'openai', key: 'fixture-secret' }, model: 'model', prompt: '', fetchImpl: async () => new Response('secret-provider-error', { status: 401 }) }), error => !error.message.includes('secret-provider-error') && /HTTP 401/.test(error.message));
  await assert.rejects(callProvider({ credential: { provider: 'openai', key: 'fixture-secret' }, model: 'model', prompt: 'x'.repeat(128001), fetchImpl: async () => { throw new Error('Should never dispatch'); } }), /input-size limit/);
});
test('research configuration rejects the removed execution configuration', () => {
  assert.deepEqual(validateWorkbenchConfig(defaultConfig), defaultConfig);
  assert.throws(() => validateWorkbenchConfig({ totalBudget: '100', taskBudget: '30', interrupt: true, agents: defaultConfig.agents }), /research workflow/);
});
