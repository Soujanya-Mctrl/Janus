import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http as rpc } from 'viem';
import { acquireSignerLock } from '../lib/signer-lock.mjs';
import { privateKeyToAccount } from 'viem/accounts';
import { createTaskMerchant, taskMerchantHandler } from '../lib/task-merchant.mjs';

async function main() {
const env = new URL('../../.env.hedera', import.meta.url);
if (fs.existsSync(env)) process.loadEnvFile(env);
const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../../../shared/deployments/hedera-testnet.json', import.meta.url), 'utf8'));
if (!/^0x[0-9a-fA-F]{64}$/.test(process.env.HEDERA_MERCHANT_PRIVATE_KEY ?? '')) throw new Error('Dedicated testnet merchant key required in environment');
let merchantAccount;
try { merchantAccount = privateKeyToAccount(process.env.HEDERA_MERCHANT_PRIVATE_KEY); }
catch { throw new Error('Invalid dedicated testnet merchant key'); }
const chain = defineChain({ ...network, id: network.chainId }), transport = rpc(process.env.HEDERA_RPC_URL || network.rpcUrls.default.http[0]);
const publicClient = createPublicClient({ chain, transport, cacheTime: 0 });
const proof = JSON.parse(fs.readFileSync(new URL('../../../contracts/phase1/evidence/live-proof.json', import.meta.url), 'utf8'));
const deploymentReceipt = await publicClient.getTransactionReceipt({ hash: proof.deploymentHash });
const merchant = await createTaskMerchant({ directory: fileURLToPath(new URL('../../.merchant-state/', import.meta.url)),
 publicClient, fromBlock: deploymentReceipt.blockNumber, walletClient: createWalletClient({ chain, transport, account: merchantAccount }), manifest,
 produce: async ({ request }) => ({ schemaVersion: '1', requestHash: (await import('../lib/task-merchant.mjs')).requestHash(request), dataset: request.body }),
});
const releaseSigner = acquireSignerLock(fileURLToPath(new URL('../../.merchant-state/', import.meta.url)), merchantAccount.address);
process.once('exit', releaseSigner);
const server = http.createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 16384 }, taskMerchantHandler(merchant));
server.once('error', () => { releaseSigner(); console.error('Task merchant listener failed'); process.exitCode = 1; });
server.maxConnections = 64;
server.maxRequestsPerSocket = 100;
server.keepAliveTimeout = 5000;
server.listen(4023, '127.0.0.1', () => console.log('Task merchant on http://127.0.0.1:4023 (Hedera testnet; no payment until an authorized request)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
main().catch(() => { console.error('Task merchant startup failed; run npm run task:preflight --prefix backend for setup diagnostics'); process.exitCode = 1; });
