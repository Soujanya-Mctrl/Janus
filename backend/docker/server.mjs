import fs from 'node:fs/promises';
import http from 'node:http';
import { createPublicClient, createWalletClient, http as rpc } from 'viem';
import { chain, rpcUrl, account } from './common.mjs';
import { createTaskMerchant, taskMerchantHandler, requestHash } from '../hedera/lib/task-merchant.mjs';
import { acquireSignerLock } from '../hedera/lib/signer-lock.mjs';

const manifest = JSON.parse(await fs.readFile(`${process.env.JANUS_CHAIN_STATE || '/state'}/deployment.json`, 'utf8'));
const publicClient = createPublicClient({ chain, transport: rpc(rpcUrl), cacheTime: 0 });
const directory = process.env.JANUS_MERCHANT_STATE || '/merchant';
await fs.mkdir(directory, { recursive: true });
const release = acquireSignerLock(directory, account(3).address);
process.once('exit', release);
const merchant = await createTaskMerchant({ directory, publicClient, walletClient: createWalletClient({ chain, transport: rpc(rpcUrl), account: account(3) }), manifest, confirmations: 1,
  produce: async ({ request }) => ({ schemaVersion: '1', requestHash: requestHash(request), dataset: request.body }) });
const handler = taskMerchantHandler(merchant);
const server = http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
  if (req.method === 'GET' && ['/health', '/deployment'].includes(req.url)) {
    try {
      await publicClient.getChainId();
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url === '/deployment' ? manifest : { status: 'ok', network: 'local' }));
    } catch { res.writeHead(503); res.end(); }
    return;
  }
  await handler(req, res);
});
server.listen(4023, '0.0.0.0', () => console.log('Local task merchant listening on 4023'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
