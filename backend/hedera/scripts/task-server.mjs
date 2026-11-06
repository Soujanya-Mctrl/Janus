import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http as rpc } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createTaskMerchant, taskMerchantHandler } from '../lib/task-merchant.mjs';
const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../../../shared/deployments/hedera-testnet.json', import.meta.url), 'utf8'));
if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.HEDERA_MERCHANT_PRIVATE_KEY ?? '')) throw new Error('Dedicated testnet merchant key required in environment');
const chain = defineChain({ ...network, id: network.chainId }), transport = rpc(process.env.HEDERA_RPC_URL || network.rpcUrls.default.http[0]);
const merchant = await createTaskMerchant({ directory: fileURLToPath(new URL('../../.merchant-state/', import.meta.url)),
 publicClient: createPublicClient({ chain, transport, cacheTime: 0 }), walletClient: createWalletClient({ chain, transport, account: privateKeyToAccount(process.env.HEDERA_MERCHANT_PRIVATE_KEY) }), manifest,
 produce: async ({ request }) => ({ schemaVersion: '1', requestHash: (await import('../lib/task-merchant.mjs')).requestHash(request), dataset: request.body }),
});
const server = http.createServer(taskMerchantHandler(merchant));
server.listen(4023, '127.0.0.1', () => console.log('Task merchant on http://127.0.0.1:4023 (Hedera testnet; no payment until an authorized request)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
