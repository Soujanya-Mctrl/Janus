import fs from 'node:fs';
import { createPublicClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { validateTreasury } from '../../../contracts/phase1/lib/recovery.mjs';
const env = new URL('../../.env.hedera', import.meta.url);
if (fs.existsSync(env)) process.loadEnvFile(env);
const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../../../shared/deployments/hedera-testnet.json', import.meta.url), 'utf8'));
const report = { network: network.network, liveTransactions: false, status: 'checking', setupRequired: [], accounts: {} };
for (const name of ['OWNER','WORKER','MERCHANT']) {
 const key = process.env[`HEDERA_${name}_PRIVATE_KEY`];
 try { if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? '')) throw new Error(); report.accounts[name] = privateKeyToAccount(key).address; }
 catch { report.setupRequired.push(`Configure dedicated HEDERA_${name}_PRIVATE_KEY in backend/.env.hedera or environment`); }
}
if (report.accounts.OWNER && report.accounts.OWNER.toLowerCase() !== manifest.owner.toLowerCase()) report.setupRequired.push('Owner key does not control the pinned treasury; supply its owner key or a separately reviewed deployment manifest');
try {
 const client = createPublicClient({ chain: defineChain({ ...network, id: network.chainId }), transport: http(process.env.HEDERA_RPC_URL || network.rpcUrls.default.http[0], { retryCount: 0, timeout: 15000 }), cacheTime: 0 });
 await validateTreasury(client, manifest);
 report.deploymentVerified = true;
 for (const [role,address] of Object.entries(report.accounts)) {
  const balance = await client.getBalance({ address });
  report[role + 'GasWei'] = balance.toString();
  if (!balance) report.setupRequired.push(`Fund ${role} with test HBAR`);
 }
} catch (error) { report.failureReason = error.shortMessage || (error.message?.startsWith('Treasury') || error.message?.startsWith('Unsupported') ? error.message : 'RPC request failed'); report.deploymentVerified = false; report.setupRequired.push('RPC/deployment verification unavailable; resolve before signing transactions'); }
report.status = report.setupRequired.length ? 'setup_required' : 'preflight_passed';
console.log(JSON.stringify(report, null, 2));
if (report.setupRequired.length) process.exitCode = 2;
