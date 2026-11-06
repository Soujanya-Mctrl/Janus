import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http as rpc, erc20Abi, keccak256, stringToHex, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createTaskMerchant, taskMerchantHandler } from '../lib/task-merchant.mjs';
import { buyTaskDataset } from '../lib/task-client.mjs';
import { taskTreasuryAbi as abi } from '../lib/treasury.mjs';
import { validateTreasury } from '../../../contracts/phase1/lib/recovery.mjs';
import { transactionPolicy } from '../lib/transaction-policy.mjs';
import { acquireSignerLock } from '../lib/signer-lock.mjs';

if (!process.argv.includes('--execute')) { console.log('Explicit --execute required: maximum one 20,000-base-unit test-USDC purchase, plus bounded test HBAR gas.'); process.exit(0); }
let server, release;
async function main() {
 const completedFile = new URL('../../.merchant-state/task-live-proof.json', import.meta.url);
 if (fs.existsSync(completedFile)) { const completed = JSON.parse(fs.readFileSync(completedFile,'utf8')); if (completed.status === 'passed') { console.log('Existing bounded proof complete; no new transactions.'); console.log(completed.paymentTransaction); return; } }
 const env = new URL('../../.env.hedera', import.meta.url); if (fs.existsSync(env)) process.loadEnvFile(env);
 const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
 const manifest = JSON.parse(fs.readFileSync(new URL('../../../shared/deployments/hedera-testnet.json', import.meta.url), 'utf8'));
 assert.equal(manifest.chainId, 296);
 const chain = defineChain({ ...network, id: 296 }), transport = rpc(process.env.HEDERA_RPC_URL || network.rpcUrls.default.http[0], { timeout: 20000, retryCount: 0 });
 const publicClient = createPublicClient({ chain, transport: rpc(process.env.HEDERA_RPC_URL || network.rpcUrls.default.http[0], { timeout: 15000, retryCount: 2, retryDelay: 1000 }), cacheTime: 0, pollingInterval: 1500 });
 const wallets = {};
 for (const name of ['OWNER','WORKER','MERCHANT']) {
  const key = process.env[`HEDERA_${name}_PRIVATE_KEY`];
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? '')) throw Error('Dedicated keys required');
  wallets[name] = createWalletClient({ account: privateKeyToAccount(key), chain, transport });
 }
 assert.equal(wallets.OWNER.account.address.toLowerCase(), manifest.owner.toLowerCase());
 const read = await validateTreasury(publicClient, manifest);
 const directory = fileURLToPath(new URL('../../.merchant-state/', import.meta.url));
 release = acquireSignerLock(directory, wallets.MERCHANT.account.address);
 const proofFile = new URL('../../.merchant-state/task-live-proof.json', import.meta.url);
 const save = value => { const tmp = fileURLToPath(proofFile) + '.tmp'; const fd = fs.openSync(tmp,'w',0o600); try { fs.writeFileSync(fd,JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');fs.fsyncSync(fd); } finally {fs.closeSync(fd);} fs.renameSync(tmp,proofFile); };
 let proof = fs.existsSync(proofFile) ? JSON.parse(fs.readFileSync(proofFile,'utf8')) : { network: network.network, status: 'preparing', budgetBaseUnits: '20000', startedAt: new Date().toISOString() };
 if (proof.status === 'passed') { console.log('Existing bounded proof complete; no new transactions.'); console.log(proof.paymentTransaction); return; }
 const taskId = keccak256(stringToHex('janus-paid-merchant-live-v1:' + manifest.treasury.toLowerCase()));
 const request = { chainId: '296', treasury: manifest.treasury, token: manifest.token, merchant: wallets.MERCHANT.account.address, amount: '20000', route: '/dataset', body: { dataset: 'janus-reference-v1' } };
 const balance = address => publicClient.readContract({ address: manifest.token, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
 if (!proof.baseline) {
  const task = await read('tasks',[taskId]);
  if (task[0] !== 0n) throw Error('Existing task without proof journal; owner reconciliation required');
  assert.ok(await read('unallocated') >= 20000n, 'Insufficient unallocated treasury budget');
  proof.taskId = taskId; proof.baseline = { treasury: (await balance(manifest.treasury)).toString(), merchant: (await balance(request.merchant)).toString(), spent: (await read('totalSpent')).toString() }; save(proof);
 }
 if ((await read('tasks',[taskId]))[0] === 0n) {
  if (!proof.allocation) {
   const latest = await publicClient.getTransactionCount({ address: manifest.owner, blockTag: 'latest' });
   const pending = await publicClient.getTransactionCount({ address: manifest.owner, blockTag: 'pending' });
   if (latest !== pending) throw Error('Unknown pending owner nonce; reconcile before allocation');
   // Reconcile the legacy hash-less intent using the fixed task ID and a pinned
   // nonce. Contract task-ID uniqueness prevents a second allocation.
   const prepared = await wallets.OWNER.prepareTransactionRequest({ ...await transactionPolicy(publicClient,296), account: wallets.OWNER.account,
    to: manifest.treasury, data: encodeFunctionData({ abi, functionName: 'createTask', args: [taskId,wallets.WORKER.account.address,request.merchant,20000n,20000n] }), nonce: latest, value: 0n });
   const raw = await wallets.OWNER.account.signTransaction(prepared);
   proof.allocation = { nonce: String(latest), transaction: keccak256(raw), raw, broadcastAttempted: false, reconciledLegacyIntent: Boolean(proof.createPending), reconciledAt: new Date().toISOString() };
   proof.createTransaction = proof.allocation.transaction; save(proof);
  }
  if (!proof.allocation.broadcastAttempted) {
   proof.allocation.broadcastAttempted = true; save(proof); // hash and bytes durable before broadcast
   const sender = createPublicClient({ chain, transport }); // no submission retries
   try { await sender.sendRawTransaction({ serializedTransaction: proof.allocation.raw }); }
   catch { console.log('Allocation broadcast uncertain; reconciling the saved hash.'); }
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash: proof.allocation.transaction, confirmations: 2, timeout: 60000 });
  assert.equal(receipt.status,'success');

 }
 const task = await read('tasks',[taskId]); assert.equal(task[0],20000n); assert.equal(task[5],20000n); assert.equal(task[6].toLowerCase(),wallets.WORKER.account.address.toLowerCase()); assert.equal(task[7].toLowerCase(),request.merchant.toLowerCase());
 const oldProof = JSON.parse(fs.readFileSync(new URL('../../../contracts/phase1/evidence/live-proof.json', import.meta.url),'utf8'));
 const deployment = await publicClient.getTransactionReceipt({ hash: oldProof.deploymentHash });
 const merchant = await createTaskMerchant({ directory: fileURLToPath(new URL('../../.merchant-state/live-operations/', import.meta.url)), publicClient, walletClient: wallets.MERCHANT, manifest, fromBlock: deployment.blockNumber,
  produce: async ({ request }) => ({ schemaVersion: '1', dataset: request.body.dataset }) });
 server = http.createServer(taskMerchantHandler(merchant)); server.listen(0,'127.0.0.1'); await once(server,'listening');
 proof.status = 'purchase_pending'; save(proof);
 const args = { publicClient, walletClient: wallets.WORKER, endpoint: `http://127.0.0.1:${server.address().port}`, taskId, stepId: 'bounded-live-dataset-v1', request, manifest };
 const result = await buyTaskDataset(args);
 proof.paymentTransaction = result.receipt.transaction; proof.resultHash = result.resultHash; save(proof);
 const replay = await buyTaskDataset(args); assert.equal(replay.receipt.transaction,result.receipt.transaction); assert.equal(replay.resultHash,result.resultHash);
 const after = { treasury: await balance(manifest.treasury), merchant: await balance(request.merchant), spent: await read('totalSpent') };
 assert.equal(BigInt(proof.baseline.treasury)-after.treasury,20000n); assert.equal(after.merchant-BigInt(proof.baseline.merchant),20000n); assert.equal(after.spent-BigInt(proof.baseline.spent),20000n);
 proof.status = 'passed'; proof.finishedAt = new Date().toISOString(); proof.after = after; proof.replayTransaction = replay.receipt.transaction;
 proof.evidenceScope = 'Fresh Hedera JSON-RPC receipt, matching Paid event and exact HTS/ERC20 balances; native consensus child-record verification remains separate'; save(proof);
 console.log('Bounded Hedera purchase and paid-result replay verified: 0.02 test USDC, exactly once.'); console.log(proof.paymentTransaction);
}
main().catch(error => { console.error('Live proof stopped:',error.shortMessage || (error.message?.startsWith('Unknown') || error.message?.startsWith('Existing') ? error.message : 'Reconcile saved journal; no automatic repurchase')); process.exitCode=1; }).finally(() => { if(server) {server.closeAllConnections();server.close();} if(release)release(); });
