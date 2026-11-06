import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createPublicClient, createWalletClient, custom, defineChain, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import ganache from '../../../contracts/node_modules/ganache/dist/node/core.js';
import { createTaskMerchant, taskMerchantHandler, accessMessage, requestHash } from '../lib/task-merchant.mjs';
import { buyTaskDataset } from '../lib/task-client.mjs';
import { createCheckpointRunner, selectReplacement } from '../../runner/checkpoint-runner.mjs';

test('four-task checkpointed handoff reuses a paid result and reconciles assignment acknowledgement loss', async t => {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-runner-'));
 const runnerDirectory = path.join(directory, 'checkpoints'), merchantDirectory = path.join(directory, 'merchant');
 const provider = ganache.provider({ logging: { quiet: true }, wallet: { deterministic: true }, chain: { chainId: 1337, hardfork: 'shanghai' } });
 t.after(async () => { await provider.disconnect(); await fs.rm(directory, { recursive: true, force: true }); });
 const chain = defineChain({ id: 1337, name: 'Local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://localhost'] } } });
 const transport = custom(provider), publicClient = createPublicClient({ chain, transport, cacheTime: 0, pollingInterval: 10 });
 const wallets = Object.values(provider.getInitialAccounts()).map(entry => createWalletClient({ account: privateKeyToAccount(entry.secretKey), chain, transport }));
 const artifact = name => fs.readFile(new URL(`../../../contracts/phase1/artifacts/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
 const tokenArtifact = await artifact('TestToken'), treasuryArtifact = await artifact('TaskTreasury');
 const receipt = async hash => { const result = await publicClient.waitForTransactionReceipt({ hash }); assert.equal(result.status, 'success'); return result; };
 const token = (await receipt(await wallets[0].deployContract({ abi: tokenArtifact.abi, bytecode: tokenArtifact.bytecode }))).contractAddress;
 const treasury = (await receipt(await wallets[0].deployContract({ abi: treasuryArtifact.abi, bytecode: treasuryArtifact.bytecode, args: [token] }))).contractAddress;
 const abi = treasuryArtifact.abi;
 const send = (wallet, functionName, args) => wallet.writeContract({ address: treasury, abi, functionName, args }).then(receipt);
 await receipt(await wallets[0].writeContract({ address: token, abi: tokenArtifact.abi, functionName: 'approve', args: [treasury, 1000n] }));
 await send(wallets[0], 'deposit', [1000n]);

 const id = value => keccak256(stringToHex(value));
 const ids = Object.fromEntries(['A','B','C','D'].map(name => [name, id('runner:' + name)]));
 const workerIndex = { A: 1, B: 2, C: 4, D: 5 };
 for (const name of Object.keys(ids)) await send(wallets[0], 'createTask', [ids[name], wallets[workerIndex[name]].account.address, wallets[3].account.address, 100n, 30n]);
 const descriptor = JSON.parse(await fs.readFile(new URL('../../../shared/treasury-interface.json', import.meta.url), 'utf8'));
 const manifest = { interfaceVersion: descriptor.interfaceVersion, abiHash: descriptor.abiHash, mode: 'local', chainId: 1337,
  treasury, token, owner: wallets[0].account.address, runtimeCodeHash: keccak256(await publicClient.getBytecode({ address: treasury })) };
 const merchant = await createTaskMerchant({ directory: merchantDirectory, publicClient, walletClient: wallets[3], manifest, price: '20',
  produce: async ({ request }) => ({ dataset: request.body.dataset }) });
 const server = http.createServer(taskMerchantHandler(merchant));
 t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const endpoint = `http://127.0.0.1:${server.address().port}`;
 const steps = Object.fromEntries(Object.keys(ids).map(name => [name, (name === 'A' ? ['dataset', 'followup'] : ['dataset']).map(step => ({
  id: name + ':' + step, request: { chainId: '1337', treasury, token, merchant: wallets[3].account.address, amount: '20', route: '/dataset', body: { dataset: name + ':' + step } },
 }))]));
 const makeRunner = (name, graph = steps[name]) => createCheckpointRunner({ directory: runnerDirectory, publicClient, manifest, endpoint, taskId: ids[name], steps: graph,
  validateResult: async (result, stepId) => result.status === 'ready' && JSON.parse(result.result).dataset === graph.find(step => step.id === stepId)?.request.body.dataset });
 const read = (functionName, args = []) => publicClient.readContract({ address: treasury, abi, functionName, args });
 let originalTransaction;
 await assert.rejects(() => makeRunner('A').run({ walletClient: wallets[1], afterPaid: async result => { originalTransaction = result.receipt.transaction; throw new Error('Worker disappeared after payment'); } }), /disappeared/);
 assert.equal(await read('totalSpent'), 20n);
 assert.equal((await makeRunner('A').inspect()).pending, 'A:dataset');
 // Distinct task workers continue while A is waiting for a capable replacement.
 await Promise.all(['B','C','D'].map(name => makeRunner(name).run({ walletClient: wallets[workerIndex[name]] })));
 assert.equal(await read('totalSpent'), 80n);
 const others = await Promise.all(['B','C','D'].map(name => read('tasks', [ids[name]])));
 const workers = [
  { address: wallets[2].account.address, capabilities: ['research'], authorized: true, busy: false, expiresAt: '9999999999' },
  { address: wallets[4].account.address, capabilities: ['research'], authorized: true, busy: true, expiresAt: '9999999999' },
  { address: wallets[5].account.address, capabilities: ['other'], authorized: true, busy: false, expiresAt: '9999999999' },
 ];
 const selected = selectReplacement(workers, { requiredCapabilities: ['research'], failedWorker: wallets[1].account.address });
 assert.equal(selected.address, wallets[2].account.address);
 assert.equal(selectReplacement(workers.map(worker => ({ ...worker, busy: true })), { requiredCapabilities: ['research'] }), undefined);
 const handoff = { schedulerWallet: wallets[0], replacement: selected.address, eligible: async address => address === selected.address };
 await assert.rejects(() => makeRunner('A').handoff({ ...handoff, schedulerWallet: wallets[1] }), /Unauthorized scheduler/);
 await assert.rejects(() => makeRunner('A').handoff({ ...handoff, afterAssignment: async () => { throw new Error('Scheduler lost acknowledgement'); } }), /acknowledgement/);
 assert.equal((await read('tasks', [ids.A]))[8], 2n);
 // Restart recognizes the confirmed chain assignment instead of incrementing twice.
 await makeRunner('A').handoff(handoff);
 await makeRunner('A').handoff(handoff);
 assert.equal((await read('tasks', [ids.A]))[8], 2n);
 await assert.rejects(() => makeRunner('A').run({ walletClient: wallets[1] }), /not currently assigned/);
 const resumed = await makeRunner('A').run({ walletClient: wallets[2] });
 assert.equal(resumed.completed.length, 2); assert.equal(resumed.pending, null);
 assert.equal(resumed.completed[0].result.receipt.transaction, originalTransaction);
 assert.notEqual(resumed.completed[1].result.receipt.transaction, originalTransaction);
 assert.equal(await read('totalSpent'), 100n); // exactly five distinct logical purchases
 assert.deepEqual(await Promise.all(['B','C','D'].map(name => read('tasks', [ids[name]]))), others);
 assert.equal(await publicClient.readContract({ address: token, abi: tokenArtifact.abi, functionName: 'balanceOf', args: [wallets[3].account.address] }), 100n);
 assert.equal((await makeRunner('A').run({ walletClient: wallets[2] })).completed.length, 2);
 assert.equal(await read('totalSpent'), 100n);
 await assert.rejects(() => makeRunner('A', [{ ...steps.A[0], id: 'incompatible' }]).inspect(), /incompatible/);
 const checkpoint = (await fs.readdir(runnerDirectory)).find(name => name.endsWith('.json'));
 const original = await fs.readFile(path.join(runnerDirectory, checkpoint), 'utf8');
 await fs.writeFile(path.join(runnerDirectory, checkpoint), '{corrupt');
 const envelopes = await fs.readdir(runnerDirectory);
 assert.ok(envelopes.includes(checkpoint));
 // Inspection must not repair malformed data by resetting completed work.
 const names = Object.keys(ids);
 let rejected = 0;
 for (const name of names) { try { await makeRunner(name).inspect(); } catch { rejected++; } }
 assert.equal(rejected, 1);
 await fs.writeFile(path.join(runnerDirectory, checkpoint), original);
 const paidLogs = await publicClient.getLogs({ address: treasury, event: abi.find(item => item.type === 'event' && item.name === 'Paid'), fromBlock: 0n, toBlock: 'latest' });
 assert.equal(paidLogs.length, 5);
 assert.equal(new Set(paidLogs.map(log => log.args.taskId + ':' + log.args.operationId)).size, 5);
 if (process.env.JANUS_DEMO_EVIDENCE_DIR) {
  await fs.mkdir(process.env.JANUS_DEMO_EVIDENCE_DIR, { recursive: true });
  const report = { status: 'passed', network: 'LOCAL EPHEMERAL EVM ONLY', liveTransactions: false, generatedAt: new Date().toISOString(), runtime: process.version,
   faultSchedule: ['A stops after confirmed payment before checkpoint', 'B/C/D complete independently', 'assignment acknowledgement is lost', 'scheduler reconciles assignment', 'B reuses A artifact and completes followup'],
   taskA: await read('tasks', [ids.A]), otherTasks: others, totalSpent: await read('totalSpent'), logicalPurchases: paidLogs.length,
   firstPayment: originalTransaction, reusedPayment: resumed.completed[0].result.receipt.transaction, completedSteps: resumed.completed.map(step => step.id), assignmentEpoch: (await read('tasks', [ids.A]))[8] };
  await fs.writeFile(path.join(process.env.JANUS_DEMO_EVIDENCE_DIR, 'report.json'), JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
 }
});
