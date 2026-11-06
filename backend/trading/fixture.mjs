// Synthetic prices and scripted proposals: never market data or investment advice.
export const policy = {
  mode: 'paper', assets: ['DEMO'], initialCash: '100000000', maxOrder: '25000000',
  maxPositionCost: '40000000', maxTotalSpend: '60000000', maxTrades: 4,
  maxSlippageBps: 100, maxFeeBps: 50, maxQuoteAgeMs: 60000,
};
export const timestamp = 1800000000000;
export const quote = { asset: 'DEMO', midPrice: '10000000', executionPrice: '10050000', feeBps: 20, timestamp };
export const proposal = { action: 'buy', asset: 'DEMO', quantity: '2000000', reason: 'Scripted fixture to demonstrate paper execution and recovery; not a market signal.' };
