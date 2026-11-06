// Public synthetic policy fixture for the CRE workflow. It exposes no user data.
export async function GET() {
  return Response.json({ schema: 'janus.synthetic-risk/1', simulated: true, availableCash: '101135600',
    realizedTradingProfit: '1635600', operatingCostsPaid: '500000', requestedOperatingCost: '500000',
    explanation: 'Synthetic policy input, not a real account balance or live trading signal.' },
  { headers: { 'Cache-Control': 'no-store' } });
}
