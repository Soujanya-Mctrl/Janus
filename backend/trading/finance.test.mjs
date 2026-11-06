import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createPaperTrader } from './engine.mjs';
import { createPaperFinance } from './finance.mjs';
import { runTradingSimulation } from './orchestrator.mjs';
import { selfFundingPlan, simulationPlan } from './simulation-fixture.mjs';
import { policy, proposal, quote, timestamp } from './fixture.mjs';

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-finance-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const rules = { ...policy, operatingCostCap: '1000000' };
  const source = createPaperTrader({ directory: path.join(directory, 'source'), policy: rules, now: () => timestamp });
  const target = createPaperTrader({ directory: path.join(directory, 'target'), policy: rules, now: () => timestamp });
  const traders = new Map([['source', source], ['target', target]]);
  const allowedTransfers = [{ id: 'rescue', from: 'source', to: 'target', amount: '5000000' }];
  return { directory, source, target, traders, allowedTransfers,
    finance: createPaperFinance({ directory, traders, allowedTransfers }) };
}
async function earn(source) {
  await source.execute({ operationId: 'buy', proposal, quote });
  await source.execute({ operationId: 'sell', proposal: { ...proposal, action: 'sell' },
    quote: { ...quote, midPrice: '11000000', executionPrice: '11000000' } });
}

test('only realized profit pays operating costs; caps and stable invoice IDs prevent extra charges', async t => {
  const { source } = await setup(t);
  assert.equal((await source.adjust({ operationId: 'before-gain', kind: 'operating-cost', amount: '500000' })).operation.decision.approved, false);
  await source.execute({ operationId: 'buy', proposal, quote });
  assert.equal((await source.adjust({ operationId: 'open-position', kind: 'operating-cost', amount: '500000' })).operation.decision.approved, false);
  await source.execute({ operationId: 'sell', proposal: { ...proposal, action: 'sell' }, quote: { ...quote, midPrice: '11000000', executionPrice: '11000000' } });
  const invoice = { operationId: 'service-1', kind: 'operating-cost', amount: '500000' };
  const paid = await source.adjust(invoice);
  assert.equal(paid.portfolio.cash, '101315800');
  assert.equal(paid.portfolio.operatingCostsPaid, '500000');
  assert.equal((await source.adjust(invoice)).replayed, true);
  assert.equal((await source.adjust(invoice)).portfolio.operatingCostsPaid, '500000');
  const overCap = await source.adjust({ ...invoice, operationId: 'service-2', amount: '600000' });
  assert.match(overCap.operation.decision.reason, /cap exceeded/);
  await assert.rejects(source.adjust({ ...invoice, amount: '1' }), /different inputs/);
});

test('loss-making task cannot spend its principal on operating costs', async t => {
  const { source } = await setup(t);
  await source.execute({ operationId: 'buy', proposal, quote });
  await source.execute({ operationId: 'sell', proposal: { ...proposal, action: 'sell' }, quote: { ...quote, midPrice: '9000000', executionPrice: '9000000' } });
  const rejected = await source.adjust({ operationId: 'bill', kind: 'operating-cost', amount: '1' });
  assert.match(rejected.operation.decision.reason, /realized profit/);
  assert.equal(rejected.portfolio.operatingCostsPaid, '0');
});

test('transfer interruption after debit recovers one credit and never repeats either side', async t => {
  const options = await setup(t);
  await assert.rejects(options.finance.transfer('rescue', { afterDebit: () => { throw new Error('crash after debit'); } }), /crash after debit/);
  assert.equal((await options.source.inspect()).cash, '95000000');
  assert.equal((await options.target.inspect()).cash, '100000000');
  const replacement = createPaperFinance(options);
  assert.equal((await replacement.recover())[0].status, 'completed');
  assert.equal((await options.source.inspect()).cash, '95000000');
  assert.equal((await options.target.inspect()).cash, '105000000');
  assert.equal((await replacement.transfer('rescue')).replayed, true);
  assert.equal((await replacement.recover()).length, 0);
  assert.equal((await options.source.inspect()).operations.length, 1);
  assert.equal((await options.target.inspect()).operations.length, 1);
});

test('pending trades must be reconciled; transfers cannot take money tied up in a position', async t => {
  const { source, target, directory, traders } = await setup(t);
  const buy = { operationId: 'buy', proposal, quote };
  await assert.rejects(source.execute({ ...buy, afterFill: () => { throw new Error('ack lost'); } }), /ack lost/);
  const finance = createPaperFinance({ directory, traders, allowedTransfers: [{ id: 'oversized', from: 'source', to: 'target', amount: '90000000' }] });
  await assert.rejects(finance.transfer('oversized'), /Reconcile pending trade/);
  await source.execute(buy);
  const result = await finance.transfer('oversized');
  assert.equal(result.status, 'rejected');
  assert.equal((await source.inspect()).positions.DEMO.quantity, '2000000');
  assert.equal((await target.inspect()).transferredIn, '0');
});

test('transfer interruption after credit reuses both sides before marking the intent complete', async t => {
  const { finance, source, target } = await setup(t);
  await assert.rejects(finance.transfer('rescue', { afterCredit: () => { throw new Error('credit acknowledgement lost'); } }), /acknowledgement lost/);
  assert.equal((await source.inspect()).cash, '95000000');
  assert.equal((await target.inspect()).cash, '105000000');
  await finance.recover();
  assert.equal((await source.inspect()).operations.length, 1);
  assert.equal((await target.inspect()).operations.length, 1);
  assert.equal((await finance.inspect()).transfers[0].status, 'completed');
});

test('transferred earnings cannot be spent again after fresh capital arrives', async t => {
  const { source, target, directory, traders } = await setup(t);
  await earn(source);
  const finance = createPaperFinance({ directory, traders, allowedTransfers: [
    { id: 'outgoing', from: 'source', to: 'target', amount: '5000000' },
    { id: 'incoming', from: 'target', to: 'source', amount: '5000000' },
  ] });
  await finance.transfer('outgoing'); await finance.transfer('incoming');
  assert.equal((await source.inspect()).profitConsumed, '1815800');
  const result = await source.adjust({ operationId: 'bill', kind: 'operating-cost', amount: '1' });
  assert.match(result.operation.decision.reason, /realized profit/);
  assert.equal(BigInt((await source.inspect()).cash) + BigInt((await target.inspect()).cash), 201815800n);
});

test('unauthorized transfer and missing completed-transfer entries fail closed', async t => {
  const { finance, directory } = await setup(t);
  await assert.rejects(finance.transfer('unknown'), /not authorized/);
  await finance.transfer('rescue');
  await fs.unlink(path.join(directory, 'target', 'portfolio.json'));
  await assert.rejects(finance.transfer('rescue'), /missing matching/);
});

test('orchestrator funds its simulated operating bill and reallocates free cash on worker failure', async t => {
  const { directory } = await setup(t);
  const options = { directory: path.join(directory, 'run'), plan: selfFundingPlan, now: () => timestamp, interruptTask: 'alpha' };
  const result = await runTradingSimulation(options);
  assert.equal(result.transfers[0].status, 'completed');
  assert.equal(result.portfolios.alpha.transferredOut, '5000000');
  assert.equal(result.portfolios.beta.transferredIn, '5000000');
  assert.equal(result.portfolios.alpha.cash, '28311800');
  assert.equal(result.portfolios.beta.cash, '32823800');
  assert.equal(result.operatingCostsPaid, '500000');
  assert.equal(result.cash, '101135600');
  assert.equal(result.events.filter(event => event.type === 'operating-cost-paused').length, 2);
  assert.ok(result.events.find(event => event.type === 'cash-reallocated').sequence < result.events.find(event => event.type === 'worker-reassigned').sequence);
  const replay = await runTradingSimulation(options);
  assert.deepEqual(replay.portfolios, result.portfolios);
  assert.equal(replay.cash, result.cash);
  assert.equal(replay.events.filter(event => event.type === 'operating-cost-reused').length, 3);
});

test('one profitable bot cannot pay operating bills while the shared pool is losing', async t => {
  const { directory } = await setup(t);
  const plan = structuredClone(simulationPlan);
  plan.bots[0].policy.operatingCostCap = '1000000';
  plan.operatingCosts = [{ id: 'pool-bill', task: 'alpha', amount: '500000' }];
  const result = await runTradingSimulation({ directory, plan, now: () => timestamp });
  assert.equal(result.portfolios.alpha.realizedPnl, '1815800');
  assert.equal(result.realizedPnl, '-360400');
  assert.equal(result.operatingCostsPaid, '0');
  assert.ok(result.events.some(event => event.type === 'operating-cost-paused' && event.reason.includes('Shared pool')));
});

test('unexpected worker exception triggers one funded replacement; a second failure stops', async t => {
  const { directory } = await setup(t);
  const options = { directory: path.join(directory, 'recover'), plan: selfFundingPlan, now: () => timestamp,
    createWorker: (url, options) => options.workerData.taskId === 'alpha' && options.workerData.epoch === 1
      ? new Worker('throw new Error("worker unavailable")', { eval: true }) : new Worker(url, options) };
  const result = await runTradingSimulation(options);
  assert.equal(result.transfers[0].status, 'completed');
  assert.equal(result.portfolios.alpha.fills.length, 2);
  assert.equal(result.events.filter(event => event.type === 'worker-reassigned').length, 1);
  await assert.rejects(runTradingSimulation({ ...options, directory: path.join(directory, 'stop'),
    createWorker: (url, options) => options.workerData.taskId === 'alpha'
      ? new Worker('throw new Error("still unavailable")', { eval: true }) : new Worker(url, options) }), /Worker execution failed/);
});
