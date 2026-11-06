import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runTradingSimulation } from './orchestrator.mjs';
import { selfFundingPlan } from './simulation-fixture.mjs';
import { timestamp } from './fixture.mjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-parallel-paper-'));
const usd = value => {
  const amount = BigInt(value), absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 1000000n}.${(absolute % 1000000n).toString().padStart(6, '0')}`;
};
try {
  console.log('PAPER SIMULATION | 3 parallel worker threads | deterministic orchestrator | synthetic prices | no 0G, wallets or network calls');
  const result = await runTradingSimulation({ directory, plan: selfFundingPlan, now: () => timestamp, interruptTask: 'alpha',
    onEvent: event => console.log(`${event.sequence}. ${event.type}${event.bot ? ` [${event.bot}${event.epoch ? ` epoch ${event.epoch}` : ''}]` : ''}${event.from ? ` ${event.from} -> ${event.to}: ${usd(event.amount)} paper USD` : ''}${event.operationId ? ` ${event.operationId}` : ''}${event.reason ? `: ${event.reason}` : ''}`) });
  assert.equal(result.portfolios.alpha.fills.length, 2);
  assert.equal(result.portfolios.beta.fills.length, 2);
  assert.equal(result.portfolios.gamma.fills.length, 0);
  assert.ok(result.events.some(event => event.type === 'result-reused' && event.bot === 'alpha'));
  assert.equal(result.cash, '101135600');
  assert.equal(result.operatingCostsPaid, '500000');
  assert.equal(result.transfers[0].status, 'completed');
  console.log(JSON.stringify({ initialPaperUSD: '100.000000', unallocatedReserveUSD: usd(result.reserve),
    finalCashUSD: usd(result.cash), realizedPaperTradingPnlUSD: usd(result.realizedPnl),
    simulatedOperatingFeesPaidUSD: usd(result.operatingCostsPaid), transfers: result.transfers,
    bots: Object.fromEntries(Object.entries(result.portfolios).map(([id, portfolio]) => [id, {
      cashUSD: usd(portfolio.cash), realizedPaperPnlUSD: usd(portfolio.realizedPnl), fills: portfolio.fills.length,
      operatingFeesPaidUSD: usd(portfolio.operatingCostsPaid), transferredInUSD: usd(portfolio.transferredIn), transferredOutUSD: usd(portfolio.transferredOut),
    }])), gasPaid: '0 (offline)', networkCalls: 0, sponsorEvidence: false }, null, 2));
} finally { await fs.rm(directory, { recursive: true, force: true }); }
