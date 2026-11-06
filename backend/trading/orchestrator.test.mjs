import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runTradingSimulation, validateSimulation } from './orchestrator.mjs';
import { simulationPlan } from './simulation-fixture.mjs';
import { timestamp } from './fixture.mjs';

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-orchestrator-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, plan: structuredClone(simulationPlan), now: () => timestamp };
}

test('three live worker threads start together; other tasks finish while alpha is interrupted', async t => {
  const result = await runTradingSimulation({ ...await setup(t), interruptTask: 'alpha' });
  const ready = result.events.filter(event => event.type === 'worker-ready' && event.epoch === 1);
  assert.equal(new Set(ready.map(event => event.threadId)).size, 3);
  const firstStart = result.events.find(event => event.type === 'worker-started').sequence;
  assert.ok(ready.every(event => event.sequence < firstStart));
  const reassigned = result.events.find(event => event.type === 'worker-reassigned');
  for (const bot of ['beta', 'gamma']) {
    assert.ok(result.events.find(event => event.type === 'worker-completed' && event.bot === bot).sequence < reassigned.sequence);
  }
  assert.ok(result.events.some(event => event.type === 'result-reused' && event.bot === 'alpha' && event.epoch === 2));
  assert.equal(result.portfolios.alpha.fills.filter(fill => fill.operationId === 'alpha-step-1').length, 1);
  assert.equal(result.portfolios.alpha.fills.length, 2);
  assert.equal(result.portfolios.beta.fills.length, 2);
  assert.equal(result.portfolios.gamma.fills.length, 0);
  assert.equal(result.portfolios.alpha.realizedPnl, '1815800');
  assert.equal(result.portfolios.beta.realizedPnl, '-2176200');
  assert.equal(result.reserve, '10000000');
  assert.equal(result.cash, '99639600');
  assert.equal(result.realizedPnl, '-360400');
  assert.equal(result.positionCost, '0');
  assert.equal(result.networkCalls, 0);
});

test('orchestrator restart reuses all original outcomes without new fills or balances', async t => {
  const options = await setup(t);
  const first = await runTradingSimulation({ ...options, interruptTask: 'alpha' });
  const second = await runTradingSimulation({ ...options, interruptTask: 'alpha' });
  assert.deepEqual(second.portfolios, first.portfolios);
  assert.equal(second.events.filter(event => event.type === 'result-reused').length, 6);
  assert.equal(second.events.filter(event => event.type === 'paper-fill').length, 0);
  assert.equal(second.events.filter(event => event.type === 'worker-interrupted').length, 0);
});

test('shared budget and bot identity are validated before workers can run', () => {
  const plan = structuredClone(simulationPlan);
  plan.totalBudget = '80000000';
  assert.throws(() => validateSimulation(plan), /Allocations exceed/);
  plan.totalBudget = simulationPlan.totalBudget;
  plan.bots[1].id = plan.bots[0].id;
  assert.throws(() => validateSimulation(plan), /Invalid simulation/);
  plan.bots[1].id = '../escape';
  assert.throws(() => validateSimulation(plan), /Invalid bot/);
});

test('changing task allocations or market snapshots cannot reinterpret an existing journal', async t => {
  const options = await setup(t);
  await runTradingSimulation(options);
  options.plan.bots[0].steps[0].quote.executionPrice = '10000000';
  await assert.rejects(runTradingSimulation(options), /Simulation plan changed/);
});

test('a busy orchestrator refuses a second owner of the same run', async t => {
  const options = await setup(t);
  await fs.writeFile(path.join(options.directory, 'orchestrator.lock'), 'fixture owner');
  await assert.rejects(runTradingSimulation(options), /Orchestrator busy/);
  assert.equal(await fs.readFile(path.join(options.directory, 'orchestrator.lock'), 'utf8'), 'fixture owner');
});

test('unexpected strategy errors stop the run without pretending to be a recoverable demo crash', async t => {
  const options = await setup(t);
  options.plan.bots[0].steps[0].proposal.quantity = '-1';
  await assert.rejects(runTradingSimulation(options), /base units/);
  await assert.rejects(fs.access(path.join(options.directory, 'orchestrator.lock')), { code: 'ENOENT' });
});
