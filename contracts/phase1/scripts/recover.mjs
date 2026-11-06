import fs from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { planRecovery, executeRecovery } from '../lib/recovery.mjs';

const [manifestPath, taskId, ...options] = process.argv.slice(2);
if (!manifestPath || !taskId || options.some(value => value.startsWith('--') && value !== '--execute')) {
  console.error('Usage: npm run recovery:plan --prefix contracts -- MANIFEST TASK_ID [OPERATION_ID ...] [--execute]');
  process.exit(1);
}
try {
  const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.chainId !== network.chainId || manifest.mode !== 'historical-testnet') throw new Error('CLI accepts only the pinned Hedera testnet manifest');
  const transport = http(process.env.JANUS_RECOVERY_RPC_URL || network.rpcUrls.default.http[0], { retryCount: 0, timeout: 20000 });
  const chain = defineChain({ ...network, id: network.chainId });
  const publicClient = createPublicClient({ chain, transport, cacheTime: 0 });
  const args = { publicClient, manifest, taskId, operationIds: options.filter(value => value !== '--execute') };
  const plan = await planRecovery(args);
  console.log(JSON.stringify(plan, null, 2));
  if (options.includes('--execute')) {
    const key = process.env.JANUS_RECOVERY_PRIVATE_KEY ?? '';
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('A valid dedicated testnet recovery key is required');
    let account;
    try { account = privateKeyToAccount(key); }
    catch { throw new Error('Invalid recovery key'); }
    const walletClient = createWalletClient({ account, chain, transport });
    console.log(JSON.stringify(await executeRecovery({ ...args, walletClient }), null, 2));
  }
} catch (error) {
  // Avoid SDK error objects/transaction dumps which may contain sensitive context.
  console.error(error.shortMessage || error.message?.split('\n')[0] || 'Recovery failed');
  process.exitCode = 1;
}
