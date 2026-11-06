import { policy, timestamp } from './fixture.mjs';

function bot(id, asset, sellPrice, oversized = false) {
  const proposal = (action, quantity = '2000000') => ({ action, asset, quantity, reason: `Scripted ${id} ${action} on synthetic prices; no live market signal.` });
  const quote = (midPrice, executionPrice = midPrice) => ({ asset, midPrice, executionPrice, feeBps: 20, timestamp });
  return { id, responsibility: `Manage only the synthetic ${asset} task within its isolated allowance`,
    policy: { ...policy, assets: [asset], initialCash: '30000000', maxTotalSpend: '30000000' },
    steps: oversized ? [
      { proposal: proposal('buy', '5000000'), quote: quote('10000000', '10050000') },
      { proposal: proposal('hold', '0'), quote: quote('10000000') },
    ] : [
      { proposal: proposal('buy'), quote: quote('10000000', '10050000') },
      { proposal: proposal('sell'), quote: quote(sellPrice) },
    ] };
}

export const simulationPlan = { mode: 'paper', totalBudget: '100000000', bots: [
  bot('alpha', 'DEMOA', '11000000'),
  bot('beta', 'DEMOB', '9000000'),
  bot('gamma', 'DEMOC', '10000000', true),
] };

export const selfFundingPlan = {
  ...structuredClone(simulationPlan),
  bots: simulationPlan.bots.map(bot => ({ ...structuredClone(bot), policy: { ...bot.policy, operatingCostCap: '1000000' } })),
  failureTransfers: [{ id: 'alpha-to-beta', from: 'alpha', to: 'beta', amount: '5000000' }],
  operatingCosts: [
    { id: 'alpha-service', task: 'alpha', amount: '500000' },
    { id: 'beta-service', task: 'beta', amount: '500000' },
    { id: 'gamma-service', task: 'gamma', amount: '500000' },
  ],
};

// The profitable variant still includes Beta's loss. Aggregate realized gains,
// not Alpha's isolated win alone, must cover the operating bill.
selfFundingPlan.bots[0].steps[1].quote.midPrice = '12000000';
selfFundingPlan.bots[0].steps[1].quote.executionPrice = '12000000';
