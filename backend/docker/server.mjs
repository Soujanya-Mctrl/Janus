import fs from 'node:fs/promises';
import { loadRuntimeDeployment } from '../lib/runtime-deployment.mjs';
import { validateTreasury } from '../../contracts/phase1/lib/recovery-core.mjs';
import http from 'node:http';
import { createWalletClient, defineChain, http as rpc } from 'viem';
import { account } from './common.mjs';
import { createTaskMerchant, taskMerchantHandler, requestHash } from '../hedera/lib/task-merchant.mjs';
import { acquireSignerLock } from '../hedera/lib/signer-lock.mjs';

const { deployment: manifest, publicClient, chain: definition, serviceRpcUrl } = await loadRuntimeDeployment({ env: { ...process.env, JANUS_DEPLOYMENT_FILE: process.env.JANUS_DEPLOYMENT_FILE || `${process.env.JANUS_CHAIN_STATE || '/state'}/deployment.json` }, verify: false });
const chain = defineChain(definition);
const directory = process.env.JANUS_MERCHANT_STATE || '/merchant';
await fs.mkdir(directory, { recursive: true });
const release = acquireSignerLock(directory, account(3).address);
process.once('exit', release);
const merchant = await createTaskMerchant({ directory, publicClient, walletClient: createWalletClient({ chain, transport: rpc(serviceRpcUrl), account: account(3) }), manifest, confirmations: 1,
  produce: async ({ request }) => ({ schemaVersion: '1', requestHash: requestHash(request), dataset: request.body,
   ...(request.body?.dataset === 'task-budget-reference-v1' ? { content: 'Janus reference dataset v1: Available funds exclude reserved obligations and settled spending. Worker reassignment increments the epoch and fences old workers. Stable task and step identities retrieve an existing paid result without purchasing it again. This is a reference dataset, not independent web evidence.' } : {}) }) });
const handler = taskMerchantHandler(merchant);
const server = http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
  if (req.method === 'GET' && ['/health', '/deployment'].includes(req.url)) {
    try {
      await validateTreasury(publicClient, manifest);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url === '/deployment' ? manifest : { status: 'ok', network: 'local' }));
    } catch { res.writeHead(503); res.end(); }
    return;
  }
  await handler(req, res);
});
const port = Number(process.env.JANUS_MERCHANT_PORT || 4023);
server.listen(port, process.env.JANUS_BIND_HOST || '0.0.0.0', () => console.log(`Local task merchant listening on ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
process.on('message', message => { if (message?.type === 'shutdown') server.close(() => process.exit(0)); });
