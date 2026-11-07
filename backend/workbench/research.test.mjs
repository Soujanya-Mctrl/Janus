import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRun, executeResearch, readRun, listRuns, controlRun, runDirectory, deleteRun } from './research.mjs';
import { defaultConfig } from './config.mjs';
import { createWorkbenchStore } from './store.mjs';
const user = 'did:privy:research-owner';
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-research-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('parallel process research persists checkpoints and replacement reuses the original response', async t => {
  const root = await fixture(t);
  const run = await createRun(root, user, { config: defaultConfig, question: 'How do task-owned budgets help research agents?', mode: 'fixture', interrupt: true });
  const result = await executeResearch({ root, user, id: run.id });
  assert.equal(result.status, 'completed');
  assert.equal(Object.keys(result.artifacts).length, 5);
  assert.ok(result.events.some(event => event.type === 'worker-replaced'));
  assert.ok(result.events.some(event => event.type === 'artifact-reused'));
  assert.equal(result.events.filter(event => event.type === 'provider-requested').length, 5);
  const starts = result.events.filter(event => event.type === 'worker-started');
  assert.ok(new Set(starts.map(event => event.pid)).size >= 4);
  assert.ok(starts[1].sequence < result.events.find(event => event.type === 'worker-completed').sequence);
  const replay = await executeResearch({ root, user, id: run.id });
  assert.equal(replay.events.length, result.events.length);
  assert.deepEqual((await readRun(root, user, run.id)).artifacts, result.artifacts);
  assert.deepEqual(await listRuns(root, 'did:privy:other'), []);
  await assert.rejects(readRun(root, 'did:privy:other', run.id));
  await assert.rejects(readRun(root, user, '../escape'), /Invalid run/);
});
test('provider runs require consent, account-owned credentials and reuse completed inference', async t => {
  const root = await fixture(t), vault = createWorkbenchStore(path.join(root, 'vault'));
  const credential = await vault.saveCredential(user, { provider: 'openai', label: 'fixture', key: 'fixture-secret-not-for-workers' });
  const config = structuredClone(defaultConfig);
  for (const agent of config.agents) { agent.credentialId = credential.id; agent.model = 'fixture-model'; }
  const options = { config, question: 'Compare task progress with worker authority.', mode: 'llm' };
  await assert.rejects(createRun(root, user, options), /billing/);
  await assert.rejects(createRun(root, 'did:privy:other', { ...options, confirmProviderBilling: true }), /not found/);
  const run = await createRun(root, user, { ...options, confirmProviderBilling: true });
  let calls = 0;
  const providerCall = async ({ credential: record }) => { calls++; assert.equal(record.key, 'fixture-secret-not-for-workers'); return { text: 'Fixture research response', provider: 'openai', model: 'fixture-model', requestId: 'fixture-' + calls, usage: null }; };
  const result = await executeResearch({ root, user, id: run.id, providerCall });
  assert.equal(result.status, 'completed', result.error); assert.equal(calls, 5);
  assert.ok(!JSON.stringify(result).includes('fixture-secret-not-for-workers'));
  await executeResearch({ root, user, id: run.id, providerCall }); assert.equal(calls, 5);
});
test('uncertain inference is reconciled without automatic rebilling; run controls preserve identity', async t => {
  const root = await fixture(t), vault = createWorkbenchStore(path.join(root, 'vault'));
  const credential = await vault.saveCredential(user, { provider: 'openai', label: 'test', key: 'fixture-uncertain-private-key' });
  const config = structuredClone(defaultConfig);
  for (const agent of config.agents) { agent.credentialId = credential.id; agent.model = 'fixture-model'; }
  const run = await createRun(root, user, { config, question: 'What survives a lost response?', mode: 'llm', confirmProviderBilling: true });
  let calls = 0;
  const providerCall = async () => { calls++; throw new Error('Provider response lost'); };
  const failed = await executeResearch({ root, user, id: run.id, providerCall });
  assert.equal(failed.status, 'reconciling'); assert.equal(calls, 1);
  await executeResearch({ root, user, id: run.id, providerCall }); assert.equal(calls, 1);
  await assert.rejects(controlRun(root, user, run.id, 'resume'), /uncertain/);
  const paused = await createRun(root, user, { config: defaultConfig, question: 'Explain recovery checkpoints.', mode: 'fixture' });
  await controlRun(root, user, paused.id, 'pause');
  assert.equal((await executeResearch({ root, user, id: paused.id })).status, 'paused');
  await controlRun(root, user, paused.id, 'resume');
  assert.equal((await executeResearch({ root, user, id: paused.id })).status, 'completed');
  // Locks fail closed rather than starting another supervisor.
  const dir = runDirectory(root, user, run.id);
  await fs.writeFile(path.join(dir, 'supervisor.lock'), 'fixture');
  await assert.rejects(executeResearch({ root, user, id: run.id }), /Supervisor already/);
});

test('research is encrypted on disk and deletion refuses active, foreign and unresolved runs', async t => {
  const root = await fixture(t), question = 'Private question about an unpublished research strategy.';
  const run = await createRun(root, user, { config: defaultConfig, question, mode: 'fixture' });
  const file = path.join(runDirectory(root, user, run.id), 'run.json');
  assert.ok(!(await fs.readFile(file, 'utf8')).includes(question));
  await assert.rejects(deleteRun(root, user, run.id), /completed or cancelled/);
  await assert.rejects(deleteRun(root, 'did:privy:other', run.id));
  await executeResearch({ root, user, id: run.id });
  const dir = runDirectory(root, user, run.id);
  await fs.writeFile(path.join(dir, 'supervisor.lock'), 'fixture');
  await assert.rejects(deleteRun(root, user, run.id), /active or unresolved/);
  await fs.unlink(path.join(dir, 'supervisor.lock'));
  // Financial state is deliberately outside research deletion's scope.
  const journal = path.join(root, 'financial-record.json'); await fs.writeFile(journal, 'preserve');
  assert.deepEqual(await deleteRun(root, user, run.id), { deleted: run.id });
  await assert.rejects(readRun(root, user, run.id));
  assert.deepEqual(await listRuns(root, user), []);
  assert.equal(await fs.readFile(journal, 'utf8'), 'preserve');
});
