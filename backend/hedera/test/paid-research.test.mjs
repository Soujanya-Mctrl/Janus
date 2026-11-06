import { createPaidResearchTools } from '../../workbench/paid-research.mjs';
import { createRun, executeResearch } from '../../workbench/research.mjs';
import { createWorkbenchStore } from '../../workbench/store.mjs';
import { defaultConfig } from '../../workbench/config.mjs';
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
import { createTaskMerchant, taskMerchantHandler } from '../lib/task-merchant.mjs';
import { createCheckpointRunner } from '../../runner/checkpoint-runner.mjs';

test('paid research survives worker process failure with onchain replacement and source reuse', async t => {
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
 const merchant = await createTaskMerchant({ directory: merchantDirectory, publicClient, walletClient: wallets[3], manifest, price: '20', confirmations: 1,
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
 const user = 'did:privy:paid-research-test', root = path.join(directory, 'workbench');
 const config = structuredClone(defaultConfig);
 const live = process.env.JANUS_LIVE_RESEARCH === '1';
 if (live) {
  if (!process.env.GROQ_API_KEY) throw new Error('Groq key required for explicitly enabled live research');
  const credential = await createWorkbenchStore(path.join(root, 'vault')).saveCredential(user, { provider: 'groq', label: 'Bounded phase-five demo', key: process.env.GROQ_API_KEY });
  for (const agent of config.agents) { agent.credentialId = credential.id; agent.model = 'openai/gpt-oss-20b'; }
 }
 const bindings = Object.fromEntries(['alpha','beta','gamma'].map((agentId, index) => {
  const name = ['A','B','C'][index];
  return [agentId, { runner: makeRunner(name, [steps[name][0]]), walletClient: wallets[workerIndex[name]], replacementWallet: wallets[6], schedulerWallet: wallets[0], eligible: async address => address === wallets[6].account.address }];
 }));
 const run = await createRun(root, user, { config, question: 'Explain how task-owned budgets preserve paid research across worker failures. Use the purchased dataset identifiers as limited test evidence.', mode: live ? 'llm' : 'fixture', confirmProviderBilling: live });
 const result = await executeResearch({ root, user, id: run.id, paidTools: createPaidResearchTools(bindings), interruptAfterPaid: true });
 assert.equal(result.status, 'completed', result.error);
 assert.ok(result.report.text.length > 0);
 assert.equal(result.workers.alpha.attempt, 2);
 assert.ok(result.events.some(e => e.type === 'worker-replaced'));
 assert.equal(result.events.filter(e => e.type === 'provider-requested').length, 5);
 const taskA = await read('tasks', [ids.A]);
 assert.equal(taskA[6].toLowerCase(), wallets[6].account.address.toLowerCase());
 assert.equal(taskA[8], 2n); assert.equal(taskA[3], 20n); assert.equal(taskA[1], 80n);
 assert.equal((await read('tasks', [ids.B]))[3], 20n);
 assert.equal((await read('tasks', [ids.C]))[3], 20n);
 assert.equal((await read('tasks', [ids.D]))[3], 0n);
 assert.equal(await read('totalSpent'), 60n);
 await assert.rejects(bindings.alpha.runner.run({ walletClient: wallets[1] }), /not currently assigned/);
 await assert.rejects(send(wallets[1], 'reserve', [ids.A, id('revived-old-worker'), id('request'), 1n, 1n, 1n, 120n]));
 const replay = await bindings.alpha.runner.run({ walletClient: wallets[6] });
 const first = result.events.find(e => e.type === 'tool-payment-confirmed' && e.agentId === 'alpha').transaction;
 assert.equal(replay.completed[0].result.receipt.transaction, first);
 assert.equal(await read('totalSpent'), 60n);
 const starts = result.events.filter(e => e.type === 'worker-started');
 assert.ok(new Set(starts.map(e => e.pid)).size >= 4);
 const logs = await publicClient.getLogs({ address: treasury, event: abi.find(e => e.name === 'Paid'), fromBlock: 0n, toBlock: 'latest' });
 assert.equal(logs.length, 3);
 if (process.env.JANUS_PHASE5_EVIDENCE) {
  await fs.mkdir(process.env.JANUS_PHASE5_EVIDENCE, { recursive: true });
  await fs.writeFile(path.join(process.env.JANUS_PHASE5_EVIDENCE, 'report.json'), JSON.stringify({ status: 'passed', financialNetwork: 'local EVM 1337', liveModel: live, model: live ? 'openai/gpt-oss-20b' : 'fixture', run: result, firstPayment: first, reusedPayment: replay.completed[0].result.receipt.transaction, totalSpent: '60', taskA: taskA.map(v => typeof v === 'bigint' ? v.toString() : v), paidEvents: logs.map(e => ({ transaction: e.transactionHash, task: e.args.taskId, operation: e.args.operationId })) }, null, 2));
 }
});
