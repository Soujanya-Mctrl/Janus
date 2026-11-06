import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPaperTrader, assessTrade } from './engine.mjs';
import { policy, quote, proposal, timestamp } from './fixture.mjs';

async function setup(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-paper-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, trader: createPaperTrader({ directory, policy, now: () => timestamp, ...overrides }) };
}
const input = { operationId: 'cycle-1', proposal, quote };

test('fee-inclusive buy and sell conserve paper cash and realize net PnL', async t => {
  const { trader } = await setup(t);
  const bought = await trader.execute(input);
  assert.equal(bought.portfolio.cash, '79859800');
  assert.deepEqual(bought.portfolio.positions.DEMO, { quantity: '2000000', cost: '20140200' });
  const sold = await trader.execute({ operationId: 'cycle-2', proposal: { ...proposal, action: 'sell' },
    quote: { ...quote, midPrice: '11000000', executionPrice: '11000000' } });
  assert.equal(sold.portfolio.cash, '101815800');
  assert.equal(sold.portfolio.realizedPnl, '1815800');
  assert.deepEqual(sold.portfolio.positions.DEMO, { quantity: '0', cost: '0' });
  assert.deepEqual(await trader.inspect(), sold.portfolio);
});

test('interruption after durable fill resumes once; completed replay also submits nothing', async t => {
  const { trader, directory } = await setup(t);
  await assert.rejects(trader.execute({ ...input, afterFill: () => { throw new Error('interrupted'); } }), /interrupted/);
  const replacement = createPaperTrader({ directory, policy, now: () => timestamp + 999999 });
  await assert.rejects(replacement.execute({ ...input, operationId: 'different-cycle' }), /Resume pending/);
  const resumed = await replacement.execute(input);
  assert.equal(resumed.replayed, true);
  assert.equal(resumed.operation.status, 'completed');
  assert.equal(resumed.portfolio.fills.length, 1);
  assert.equal((await replacement.execute(input)).portfolio.cash, '79859800');
});

test('same operation ID cannot purchase with changed parameters', async t => {
  const { trader } = await setup(t);
  await trader.execute(input);
  await assert.rejects(trader.execute({ ...input, proposal: { ...proposal, quantity: '1000000' } }), /different inputs/);
});

test('risk gates reject overspend, stale quotes, fees, slippage and shorts', async t => {
  const { trader } = await setup(t);
  const portfolio = await trader.inspect();
  const check = (p, q = quote, rules = policy) => assessTrade(rules, portfolio, p, q, timestamp);
  assert.match(check({ ...proposal, quantity: '5000000' }).reason, /Order limit/);
  assert.match(check(proposal, { ...quote, timestamp: timestamp - 60001 }).reason, /Stale/);
  assert.match(check(proposal, { ...quote, timestamp: timestamp + 1 }).reason, /Stale/);
  assert.match(check(proposal, { ...quote, feeBps: 51 }).reason, /Fee limit/);
  assert.match(check(proposal, { ...quote, executionPrice: '10200000' }).reason, /Slippage/);
  assert.match(check({ ...proposal, action: 'sell' }).reason, /Short selling/);
  assert.match(check(proposal, quote, { ...policy, maxOrder: '20100000' }).reason, /Order limit/);
  assert.throws(() => check({ ...proposal, asset: 'UNKNOWN' }), /Invalid research/);
  assert.throws(() => check({ ...proposal, quantity: '-1' }), /base units/);
});

test('position, cumulative spend, cash and trade count caps apply across cycles', async t => {
  const { trader } = await setup(t);
  const p = (await trader.execute(input)).portfolio;
  assert.match(assessTrade(policy, p, proposal, quote, timestamp).reason, /Position cost/);
  assert.match(assessTrade({ ...policy, maxTotalSpend: '30000000' }, p, proposal, quote, timestamp).reason, /Total spend/);
  assert.match(assessTrade({ ...policy, maxTrades: 1 }, p, proposal, quote, timestamp).reason, /Trade count/);
  assert.match(assessTrade(policy, { ...p, cash: '1' }, proposal, quote, timestamp).reason, /Insufficient/);
});

test('hold and rejected operations leave cash untouched and replay safely', async t => {
  const { trader } = await setup(t);
  const hold = { ...input, proposal: { ...proposal, action: 'hold', quantity: '0' } };
  const result = await trader.execute(hold);
  assert.equal(result.operation.status, 'rejected');
  assert.equal(result.portfolio.cash, policy.initialCash);
  assert.equal(result.portfolio.fills.length, 0);
  assert.equal((await trader.execute(hold)).replayed, true);
});

test('lock excludes a concurrent executor until the first run releases it', async t => {
  const { trader, directory } = await setup(t);
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const pending = trader.execute({ ...input, afterFill: async () => { entered(); await blocked; } });
  await ready;
  try { await assert.rejects(createPaperTrader({ directory, policy }).execute(input), /busy/); }
  finally { release(); await pending; }
  assert.equal((await trader.inspect()).fills.length, 1);
});

test('corrupt journal and changed policy fail closed', async t => {
  const { trader, directory } = await setup(t);
  await trader.execute(input);
  await assert.rejects(createPaperTrader({ directory, policy: { ...policy, maxTrades: 5 } }).inspect(), /incompatible/);
  const file = path.join(directory, 'portfolio.json');
  const journal = JSON.parse(await fs.readFile(file, 'utf8'));
  journal.state.cash = '999999999';
  await fs.writeFile(file, JSON.stringify(journal));
  await assert.rejects(trader.inspect(), /Corrupt/);
});

test('micro-unit buy rounds debit upward and sell proceeds downward', async t => {
  const { trader } = await setup(t);
  const result = await trader.execute({ ...input, proposal: { ...proposal, quantity: '1' },
    quote: { ...quote, midPrice: '1500000', executionPrice: '1500000', feeBps: 0 } });
  assert.equal(result.portfolio.fills[0].notional, '2');
  const sold = await trader.execute({ ...input, operationId: 'dust-sale', proposal: { ...proposal, quantity: '1', action: 'sell' },
    quote: { ...quote, midPrice: '1500000', executionPrice: '1500000', feeBps: 0 } });
  assert.equal(sold.portfolio.fills[1].notional, '1');
  assert.equal(sold.portfolio.realizedPnl, '-1');
});
