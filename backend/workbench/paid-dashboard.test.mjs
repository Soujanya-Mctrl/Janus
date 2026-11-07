import test from 'node:test';
import assert from 'node:assert/strict';
import { paidFixture } from './paid-fixture.mjs';
import { createRun, executeResearch, readRun, interruptRunWorker, controlRun } from './research.mjs';
import { createRunPaidTools, financialSnapshot } from './paid-runtime.mjs';
import { defaultConfig } from './config.mjs';

test('paid dashboard binding, real interruption, confirmed replacement, replay and no-directory waiting', async t => {
 const fixture = await paidFixture(), executions = [];
 const user = 'did:privy:paid-dashboard';
 t.after(async () => { for (const item of executions) await controlRun(fixture.root, user, item.id, 'cancel').catch(() => {}); await Promise.allSettled(executions.map(item => item.promise)); await fixture.close(); });
 async function scenario(discoveryMode, directory) {
  const run = await createRun(fixture.root, user, { config: defaultConfig, question: 'How do budgets and paid source reuse survive interruption?',
   mode: 'fixture', deployment: fixture.manifest, paid: true, confirmTaskSpending: true, discoveryMode, interrupt: true });
  const factory = options => createRunPaidTools({ ...options, env: fixture.env, directory });
  const execution = executeResearch({ root: fixture.root, user, id: run.id, paidToolsFactory: factory });
  executions.push({ id: run.id, promise: execution });
  let running;
  for (let i = 0; i < 1200; i++) {
   running = await readRun(fixture.root, user, run.id);
   if (running.workers.alpha?.status === 'holding') break;
   if (running.status === 'failed' || running.status === 'reconciling') throw Error(running.error);
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(running.workers.alpha.status, 'holding', JSON.stringify(running.events.slice(-8)));
  await assert.rejects(interruptRunWorker(fixture.root, 'did:privy:other', run.id, 'alpha'));
  await assert.rejects(interruptRunWorker(fixture.root, user, run.id, '../other'));
  await interruptRunWorker(fixture.root, user, run.id, 'alpha');
  return { result: await execution, factory };
 }
 const { result } = await scenario('local');
 assert.equal(result.status, 'completed', result.error);
 assert.ok(result.report.text.includes('Reference source'));
 assert.equal(result.workers.alpha.attempt, 2);
 const first = result.events.find(event => event.type === 'tool-payment-confirmed' && event.agentId === 'alpha');
 const reuse = result.events.find(event => event.type === 'paid-result-reused' && event.agentId === 'alpha');
 assert.equal(first.transaction, reuse.transaction);
 assert.ok(result.events.find(event => event.type === 'worker-exited' && event.agentId === 'alpha'));
 assert.ok(result.events.findIndex(event => event.type === 'assignment-confirmed') < result.events.findIndex(event => event.type === 'worker-started' && event.agentId === 'alpha' && event.attempt === 2));
 const finance = await financialSnapshot(result, { env: fixture.env });
 assert.equal(finance.tasks.alpha.epoch, '2');
 for (const task of Object.values(finance.tasks)) { assert.equal(task.spent, '20000'); assert.equal(task.available, '80000'); assert.equal(task.reserved, '0'); }
 const tools = await createRunPaidTools({ root: fixture.root, user, run: result, env: fixture.env });
 await assert.rejects(tools.bindings.alpha.runner.run({ walletClient: fixture.wallet(1) }), /not currently assigned/);
 const noDirectory = { query: async () => ({ source: 'arkiv-empty-fixture', chainId: 66404, block: '1', records: [] }) };
 // Reuse the actual Arkiv chain ID, without pretending the fixture is a live read.
 const { spec } = await import('../arkiv/directory.mjs');
 noDirectory.query = async () => ({ source: 'arkiv-empty-fixture', chainId: spec.chainId, block: '1', records: [] });
 const waiting = await scenario('arkiv', noDirectory);
 assert.equal(waiting.result.status, 'waiting', waiting.result.error);
 assert.equal(waiting.result.workers.beta.status, 'completed');
 assert.equal(waiting.result.workers.gamma.status, 'completed');
 assert.equal((await financialSnapshot(waiting.result, { env: fixture.env })).tasks.alpha.epoch, '1');
 await controlRun(fixture.root, user, waiting.result.id, 'cancel');
});
