import fs from 'node:fs/promises';

// Read-only capability discovery. Never submits a payment or loads a key.
const endpoints = ['https://x402.org/facilitator', 'https://testnet.facilitator.launa.dev', 'https://api.testnet.blocky402.com'];
const results = await Promise.all(endpoints.map(async baseUrl => {
  try {
    const response = await fetch(`${baseUrl}/supported`, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const kinds = Array.isArray(body.kinds) ? body.kinds.filter(k => k.x402Version === 2 && k.network === 'hedera:testnet' && k.scheme === 'exact') : [];
    return { baseUrl, status: 'queried', kinds, transferExecutorAdvertised: kinds.some(k => k.extra?.assetTransferMethods?.includes('transferExecutor')), note: 'Advertising the method does not admit our undeployed executor or prove live settlement.' };
  } catch (error) { return { baseUrl, status: 'unreachable', error: error.cause?.code ?? error.message }; }
}));
const report = { generatedAt: new Date().toISOString(), liveSettlementAttempted: false, results };
await fs.mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../evidence/facilitators.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
for (const row of results) console.log(`${row.baseUrl}: ${row.status}; transferExecutor=${row.transferExecutorAdvertised ?? 'unknown'}`);
