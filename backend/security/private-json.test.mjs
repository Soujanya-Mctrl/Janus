import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { createPrivateJsonStore } from '../lib/private-json.mjs';
import { createWorkbenchStore } from '../workbench/store.mjs';
import { publicWorkerProfile } from '../../shared/public-worker-profile.mjs';

const key = () => randomBytes(32).toString('base64');
test('Arkiv public projection excludes private agent configuration and uses a generic label', () => {
  const profile = publicWorkerProfile({ worker: '0x' + '12'.repeat(20), network: 'eip155:296', now: 1000n,
    prompt: 'private-prompt', credentialId: 'private-key-reference', checkpoint: 'private-path', report: 'private-report' });
  assert.deepEqual(Object.keys(profile).sort(), ['worker', 'role', 'status', 'capabilities', 'network', 'scheme', 'validUntil', 'name'].sort());
  assert.ok(!JSON.stringify(profile).includes('private-')); assert.equal(profile.name, 'Research worker');
  assert.throws(() => publicWorkerProfile({ worker: '0x' + '00'.repeat(20), network: 'eip155:296' }), /Invalid/);
});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-private-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('research ciphertext rejects tampering and substitution across accounts and domains', async t => {
  const root = await fixture(t), ring = { active: 'one', keys: { one: key() } };
  const store = createPrivateJsonStore(root, { domain: 'research', keyring: ring });
  const file = path.join(root, 'alice', 'run.json'), other = path.join(root, 'bob', 'run.json');
  const record = { question: 'private-acquisition-question', report: 'sensitive-source-material' };
  await store.write(file, record);
  const raw = await fs.readFile(file, 'utf8');
  assert.ok(!raw.includes(record.question)); assert.ok(!raw.includes(record.report));
  assert.deepEqual(await store.read(file), record);
  await fs.mkdir(path.dirname(other)); await fs.writeFile(other, raw);
  await assert.rejects(store.read(other), /authentication failed/);
  await assert.rejects(createPrivateJsonStore(root, { domain: 'merchant', keyring: ring }).read(file), /authentication failed/);
  const envelope = JSON.parse(raw); envelope.tag = randomBytes(16).toString('base64');
  await fs.writeFile(file, JSON.stringify(envelope));
  await assert.rejects(store.read(file), /authentication failed/);
  await assert.rejects(store.write(path.join(root, '..', 'escape.json'), record), /inside/);
});

test('rotation reads retained old keys, writes the active key, and refuses retired keys', async t => {
  const root = await fixture(t), first = key(), second = key(), file = path.join(root, 'record.json');
  const old = createPrivateJsonStore(root, { domain: 'rotation', keyring: { active: 'old', keys: { old: first } } });
  await old.write(file, { result: 'original-purchase' });
  const rotated = createPrivateJsonStore(root, { domain: 'rotation', keyring: { active: 'new', keys: { old: first, new: second } } });
  const value = await rotated.read(file);
  const retired = createPrivateJsonStore(root, { domain: 'rotation', keyring: { active: 'new', keys: { new: second } } });
  await assert.rejects(retired.read(file), /authentication failed/);
  await rotated.write(file, value);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).keyId, 'new');
  assert.deepEqual(await retired.read(file), value);
  await assert.rejects(old.read(file), /authentication failed/);
});

test('production needs external keys and never silently accepts plaintext or resets state', async t => {
  const parent = await fixture(t), root = path.join(parent, 'state'); await fs.mkdir(root);
  const file = path.join(root, 'record.json');
  const production = createPrivateJsonStore(root, { domain: 'production', production: true, keyFile: '' });
  await assert.rejects(production.write(file, { private: true }), /Production requires/);
  assert.deepEqual(await fs.readdir(root), []);
  await assert.rejects(createPrivateJsonStore(root, { domain: 'production', production: true, keyFile: path.join(parent, 'missing-keyring') }).read(file), error => /key unavailable/.test(error.message) && error.code !== 'ENOENT');
  const secret = path.join(parent, 'keyring.json');
  await fs.writeFile(secret, JSON.stringify({ active: 'one', keys: { one: key() } }));
  const external = createPrivateJsonStore(root, { domain: 'production', production: true, keyFile: secret, allowLegacy: true });
  await external.write(file, { result: 'durable-result' });
  assert.equal((await external.read(file)).result, 'durable-result');
  await fs.writeFile(file, JSON.stringify({ result: 'legacy' }));
  await assert.rejects(external.read(file), /offline migration/);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).result, 'legacy');
  await fs.copyFile(secret, path.join(root, 'keyring.json'));
  await assert.rejects(createPrivateJsonStore(root, { domain: 'production', production: true, keyFile: path.join(root, 'keyring.json') }).read(file), /outside/);
});

test('concurrent development stores share a complete key and persist across restart', async t => {
  const root = await fixture(t);
  await Promise.all(Array.from({ length: 12 }, (_, index) => createPrivateJsonStore(root, { domain: 'concurrent', keyFile: '', production: false }).write(path.join(root, index + '.json'), { index })));
  for (let index = 0; index < 12; index++) assert.deepEqual(await createPrivateJsonStore(root, { domain: 'concurrent', keyFile: '', production: false }).read(path.join(root, index + '.json')), { index });
  assert.equal((await fs.readFile(path.join(root, '.private-key'))).length, 32);
  assert.ok(!(await fs.readdir(root)).some(name => name.endsWith('.tmp')));
});

test('vault production refuses auto-generated master keys and supports an external key file', async t => {
  const parent = await fixture(t), root = path.join(parent, 'vault');
  const previous = { mode: process.env.NODE_ENV, file: process.env.JANUS_VAULT_KEY_FILE };
  process.env.NODE_ENV = 'production'; delete process.env.JANUS_VAULT_KEY_FILE;
  t.after(() => {
    for (const [name, value] of [['NODE_ENV', previous.mode], ['JANUS_VAULT_KEY_FILE', previous.file]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  await assert.rejects(createWorkbenchStore(root, '').list('did:privy:test'), /Production requires/);
  assert.deepEqual(await fs.readdir(root), []);
  const secret = path.join(parent, 'vault.key'); await fs.writeFile(secret, key());
  process.env.JANUS_VAULT_KEY_FILE = secret;
  const store = createWorkbenchStore(root, '');
  const record = await store.saveCredential('did:privy:test', { provider: 'groq', label: 'test', key: 'private-provider-key-fixture' });
  assert.equal((await store.credential('did:privy:test', record.id)).key, 'private-provider-key-fixture');
  assert.ok(!(await fs.readdir(root)).includes('master.key'));
});
