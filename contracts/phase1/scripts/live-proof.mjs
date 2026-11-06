import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ContractExecuteTransaction, AccountAllowanceApproveTransaction, TransferTransaction, TransactionReceiptQuery, TransactionId, Hbar } from '@hiero-ledger/sdk';
import { createWalletClient, http, encodeFunctionData, encodeAbiParameters, hexToBytes, keccak256, stringToHex } from 'viem';
import { assertTestnet, role, account, mirror, publicClient, rpcUrl, chain, TOKEN, TOKEN_ID, safeError, tokenMetadata } from '../../../backend/hedera/lib/config.mjs';
import { sdkClient, consensusRecord } from '../../../backend/hedera/lib/sdk.mjs';
import { normalizeSdkRecord, checkSettlement } from '../../../backend/hedera/lib/settlement-check.mjs';

const dir = new URL('../evidence/', import.meta.url);
const proofPath = new URL('live-proof.json', dir);
const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/HederaTaskTreasury.json', import.meta.url), 'utf8'));
const abi = compiled.abi;
const id = value => keccak256(stringToHex(value));
const tasks = Object.fromEntries(['A', 'B', 'C', 'D'].map(name => [name, id(`phase1-${name}`)]));
const auth = (taskId, operationId) => encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }], [taskId, operationId, 1n]);
fs.mkdirSync(dir, { recursive: true });
const proof = fs.existsSync(proofPath) ? JSON.parse(fs.readFileSync(proofPath, 'utf8')) : { network: 'hedera:testnet', status: 'running', startedAt: new Date().toISOString(), steps: {}, payments: {} };
const save = () => { const temp = new URL('live-proof.json.tmp', dir); fs.writeFileSync(temp, JSON.stringify(proof, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n'); fs.renameSync(temp, proofPath); };
const clients = {};
const getClient = async name => clients[name] ??= await sdkClient(name);

async function step(name, signerName, build) {
  const signer = await getClient(signerName);
  let entry = proof.steps[name];
  if (entry?.status === 'confirmed') return entry;
  if (!entry) {
    const txId = TransactionId.generate(signer.id);
    const tx = build().setTransactionId(txId).setMaxTransactionFee(new Hbar(2)).freezeWith(signer.client);
    entry = proof.steps[name] = { status: 'submitting', transactionId: txId.toString() }; save();
    await tx.execute(signer.client);
  }
  // A saved ambiguous transaction is queried, never regenerated or rebroadcast.
  const receipt = await new TransactionReceiptQuery().setTransactionId(entry.transactionId).execute(signer.client);
  if (receipt.status.toString() !== 'SUCCESS') throw new Error(`Step ${name} failed: ${receipt.status}`);
  entry.status = 'confirmed'; save();
  console.log(`${name}: ${entry.transactionId}`);
  return entry;
}

async function ensureOwnerGas() {
  const owner = await account(role('OWNER').address);
  if (BigInt(owner.info.balance.balance) >= 300_000_000n) return;
  const worker = await account(role('WORKER').address);
  if (BigInt(worker.info.balance.balance) < 400_000_000n) throw new Error('Insufficient faucet gas reserve; no further calls submitted.');
  const name = `gas-refill-${Object.keys(proof.steps).filter(x => x.startsWith('gas-refill-')).length}`;
  await step(name, 'WORKER', () => new TransferTransaction().addHbarTransfer(worker.id, new Hbar(-3)).addHbarTransfer(owner.id, new Hbar(3)));
  // Mirror balances may lag consensus. Wait for the confirmed refill to appear
  // before another step can decide that the same account needs funding again.
  for (let n = 0; n < 20; n++) {
    if (BigInt((await account(owner.id)).info.balance.balance) >= 300_000_000n) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Gas refill confirmed but indexing is pending; reconcile before continuing.');
}

try {
  await assertTestnet(); await tokenMetadata(); assert.equal(proof.network, 'hedera:testnet');
  if (proof.lastError) {
    proof.resumeHistory ??= [];
    proof.resumeHistory.push({ priorError: proof.lastError, priorAssertion: proof.lastAssertion, resumedAt: new Date().toISOString(), previousRunStatus: proof.status });
    delete proof.lastError; delete proof.lastAssertion; save();
  }
  if (proof.status === 'passed') { console.log('Phase-1 live proof already completed; no transactions submitted.'); process.exit(0); }
  const owner = await getClient('OWNER'); const worker = await getClient('WORKER'); const merchant = await account(role('MERCHANT').address);
  if (!proof.deployment) {
    if (!proof.deploymentHash) {
      await ensureOwnerGas();
      const wallet = createWalletClient({ account: role('OWNER'), chain, transport: http(rpcUrl, { timeout: 30_000, retryCount: 0 }) });
      proof.deploymentHash = await wallet.deployContract({ abi, bytecode: compiled.bytecode, args: [TOKEN], gas: 3_500_000n, type: 'legacy', gasPrice: await publicClient.getGasPrice() });
      save();
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash: proof.deploymentHash, timeout: 90_000, pollingInterval: 2_000 });
    assert.equal(receipt.status, 'success');
    let info;
    for (let n = 0; n < 20; n++) { info = await mirror(`/api/v1/contracts/${receipt.contractAddress}`); if (info?.contract_id) break; await new Promise(r => setTimeout(r, 1_000)); }
    if (!info?.contract_id) throw new Error('Deployment indexing pending; rerun to reconcile the saved hash.');
    proof.deployment = { contractId: info.contract_id, vault: receipt.contractAddress, compiler: compiled.compiler, runtimeCodeHash: keccak256(await publicClient.getBytecode({ address: receipt.contractAddress })), hashscan: `https://hashscan.io/testnet/contract/${info.contract_id}` };
    save(); console.log(`Treasury deployed: ${proof.deployment.hashscan}`);
  }
  const d = proof.deployment;
  const read = (name, args = []) => publicClient.readContract({ address: d.vault, abi, functionName: name, args });
  const waitRead = async (name, args, accept) => {
    for (let n = 0; n < 20; n++) {
      const value = await read(name, args); if (accept(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Consensus transaction confirmed but indexed ${name} state is pending; rerun to reconcile.`);
  };
  assert.equal((await read('owner')).toLowerCase(), owner.signer.address.toLowerCase());
  assert.equal((await read('token')).toLowerCase(), TOKEN.toLowerCase());
  const send = async (name, signerName, method, args) => {
    if (signerName === 'OWNER' && !proof.steps[name]) await ensureOwnerGas();
    return step(name, signerName, () => new ContractExecuteTransaction().setContractId(d.contractId).setGas(500_000).setFunctionParameters(hexToBytes(encodeFunctionData({ abi, functionName: method, args }))));
  };
  const pay = async (name, taskId, op, amount) => {
    const entry = await send(name, 'OWNER', 'executeTransfer', [d.vault, TOKEN, merchant.address, amount, auth(taskId, op)]);
    if (!proof.payments[name]) {
      const record = normalizeSdkRecord(await consensusRecord(owner.client, entry.transactionId));
      const effects = checkSettlement(record, { payer: d.contractId, payTo: merchant.id, feePayer: owner.id, tokenId: TOKEN_ID, amount, controlledAddresses: [owner.signer.address, worker.signer.address, merchant.address] });
      proof.payments[name] = { transactionId: entry.transactionId, effects, record }; save();
    }
  };

  await ensureOwnerGas();
  await step('approve', 'OWNER', () => new AccountAllowanceApproveTransaction().approveTokenAllowance(TOKEN_ID, owner.id, d.contractId, '100000'));
  await send('deposit', 'OWNER', 'deposit', [100_000n]);
  for (const [name, assigned, cap] of [['A', worker.signer.address, 10_000n], ['B', owner.signer.address, 20_000n], ['C', worker.signer.address, 15_000n], ['D', owner.signer.address, 15_000n]]) {
    await send(`create-${name}`, 'OWNER', 'createTask', [tasks[name], assigned, merchant.address, cap, 10_000n]);
  }
  const paid = id('A-paid'), pending = id('A-pending'), bPaid = id('B-paid'), request = id('phase1-request');
  await send('reserve-A-paid', 'WORKER', 'reserve', [tasks.A, paid, request, 2_000n, 1n, 1n, 300n]);
  await pay('pay-A', tasks.A, paid, 2_000n);
  await send('reserve-B', 'OWNER', 'reserve', [tasks.B, bPaid, request, 500n, 1n, 1n, 300n]);
  await pay('pay-B', tasks.B, bPaid, 500n);
  await send('reserve-A-pending', 'WORKER', 'reserve', [tasks.A, pending, request, 1_000n, 1n, 1n, 300n]);
  if (!proof.otherTasksBeforeHandoff) { proof.otherTasksBeforeHandoff = await Promise.all([tasks.B, tasks.C, tasks.D].map(t => read('tasks', [t]))); save(); }
  await send('handoff-A', 'OWNER', 'assignWorker', [tasks.A, owner.signer.address]);
  if (!proof.handoff) {
    const a = await waitRead('tasks', [tasks.A], a => a[8] === 2n); assert.equal(a[1], 7_000n); assert.equal(a[2], 1_000n); assert.equal(a[3], 2_000n); assert.equal(a[8], 2n);
    proof.handoff = { available: a[1], reserved: a[2], spent: a[3], epoch: a[8] }; save();
  }
  await send('cancel-A', 'OWNER', 'cancelTask', [tasks.A]);
  await send('release-A', 'OWNER', 'releaseAvailable', [tasks.A, 7_000n]);
  if (!proof.steps['withdraw-A']) {
    proof.merchantReachableAtWithdrawal = await fetch('http://127.0.0.1:4022/supported', { signal: AbortSignal.timeout(1_000) }).then(() => true, () => false); save();
  }
  await send('withdraw-A', 'OWNER', 'withdrawUnallocated', [7_000n]);
  await pay('pay-A-pending-after-cancel', tasks.A, pending, 1_000n);
  await waitRead('totalSpent', [], value => value === 3_500n);
  const others = await Promise.all([tasks.B, tasks.C, tasks.D].map(t => read('tasks', [t])));
  const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  assert.equal(json(others), json(proof.otherTasksBeforeHandoff));
  const state = {};
  for (const name of ['deposited', 'unallocated', 'totalAvailable', 'totalReserved', 'totalSpent', 'totalWithdrawn', 'accountedBalance']) state[name] = await read(name);
  assert.equal(state.deposited, 100_000n); assert.equal(state.totalSpent, 3_500n); assert.equal(state.totalWithdrawn, 7_000n);
  assert.equal(state.unallocated, 40_000n); assert.equal(state.totalAvailable, 49_500n); assert.equal(state.totalReserved, 0n); assert.equal(state.accountedBalance, 89_500n);
  const balanceAbi = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }] }];
  const actualBalance = await publicClient.readContract({ address: TOKEN, abi: balanceAbi, functionName: 'balanceOf', args: [d.vault] });
  assert.equal(actualBalance, 89_500n);
  proof.final = { state, taskA: await read('tasks', [tasks.A]), otherTasks: others, tokenBalance: actualBalance };
  proof.status = 'passed'; proof.finishedAt = new Date().toISOString(); save();
  console.log('Live Phase-1 proof passed: isolated tasks, 0.007 USDC recovered, old commitment honored; B/C/D unchanged.');
} catch (error) { proof.lastError = safeError(error); if (error.code === 'ERR_ASSERTION') proof.lastAssertion = error.message; save(); console.error(safeError(error)); process.exitCode = 1; }
finally { for (const value of Object.values(clients)) value.client.close(); }
