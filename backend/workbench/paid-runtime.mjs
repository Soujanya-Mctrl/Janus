// Local demo authority only. Public development accounts never sign on a live chain.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createWalletClient, defineChain, http, keccak256, stringToHex, parseEventLogs } from 'viem';
import { account } from '../docker/common.mjs';
import { loadRuntimeDeployment } from '../lib/runtime-deployment.mjs';
import { createCheckpointRunner } from '../runner/checkpoint-runner.mjs';
import { createPaidResearchTools } from './paid-research.mjs';
import { createPrivateJsonStore } from '../lib/private-json.mjs';
import { acquireSignerLock } from '../hedera/lib/signer-lock.mjs';
import { taskTreasuryAbi as abi } from '../hedera/lib/treasury.mjs';
import { operationId, taskSnapshot } from '../../shared/protocol.mjs';
import { createArkivDirectory, spec } from '../arkiv/directory.mjs';
import { handoffFromArkiv } from '../arkiv/discovery.mjs';
import { sameDeployment } from '../../shared/runtime-deployment.mjs';

const indices = [1, 2, 4, 5, 6, 7];
const hash = value => createHash('sha256').update(value).digest('hex');
export const paidTerms = { budget: '100000', price: '20000', source: 'Janus reference dataset (not live web research)' };
export function paidRuntimeEnabled(env = process.env) { return env.JANUS_LOCAL_RESEARCH === '1'; }

async function ownerLock(directory, address = account(0).address) {
 await fs.mkdir(directory, { recursive: true });
 for (let attempt = 0; attempt < 200; attempt++) {
  try { return acquireSignerLock(directory, address); }
  catch (error) { if (attempt === 199) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
 }
}

export async function createRunPaidTools({ root, user, run, env = process.env, directory: suppliedDirectory, onActivity = async () => {} }) {
 if (!paidRuntimeEnabled(env) || !run.paid) throw new Error('Paid runtime is not enabled for this run');
 const runtime = await loadRuntimeDeployment({ env });
 const { deployment: manifest, publicClient, merchantUrl } = runtime;
 if (manifest.mode !== 'local' || manifest.chainId !== 1337 || !sameDeployment(run.deployment, manifest)
  || manifest.owner.toLowerCase() !== account(0).address.toLowerCase() || !merchantUrl) throw new Error('Paid demo requires the pinned local development treasury');
 const chain = defineChain(runtime.chain), transport = http(runtime.serviceRpcUrl);
 const wallet = index => {
  const client = createWalletClient({ account: account(index), chain, transport });
  if (index === 0) return client;
  return { ...client, async writeContract(input) {
   const release = await ownerLock(path.join(root, 'signers'), client.account.address);
   try { return await client.writeContract(input); } finally { release(); }
  } };
 };
 const schedulerWallet = wallet(0), replacementWallets = [wallet(8), wallet(9)];
 const directory = path.join(root, 'payments', hash(user), run.id);
 const privateStore = createPrivateJsonStore(path.join(root, 'payments'), { domain: 'research-task-bindings-v1' });
 const records = path.join(directory, 'bindings.json');
 const workers = run.config.agents.filter(agent => agent.id !== 'orchestrator');
 const expected = Object.fromEntries(workers.map((agent, index) => [agent.id, {
  taskId: keccak256(stringToHex(`janus.research.v1:${user}:${run.id}:${agent.id}`)),
  worker: account(indices[index]).address, budget: paidTerms.budget,
 }]));
 let saved;
 try { saved = await privateStore.read(records); } catch (error) { if (error.code !== 'ENOENT') throw error; }
 if (saved && (JSON.stringify(saved.tasks) !== JSON.stringify(expected) || !sameDeployment(saved.deployment, manifest))) throw new Error('Run task binding mismatch');
 if (!saved) await privateStore.write(records, { deployment: manifest, tasks: expected });
 const release = await ownerLock(path.join(root, 'signers'));
 try {
  for (const [agentId, binding] of Object.entries(expected)) {
   let task = await publicClient.readContract({ address: manifest.treasury, abi, functionName: 'tasks', args: [binding.taskId] });
   if (task[0] === 0n) {
    // Durable deterministic task identity precedes the write. Never allocate a new ID on retry.
    const transaction = await schedulerWallet.writeContract({ address: manifest.treasury, abi, functionName: 'createTask', args: [binding.taskId, binding.worker, account(3).address, BigInt(binding.budget), BigInt(paidTerms.price)] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transaction });
    if (receipt.status !== 'success') throw new Error('Task allocation reverted');
    await onActivity('task-funded', agentId, 'Task budget allocated and confirmed.', { taskId: binding.taskId, transaction });
    task = await publicClient.readContract({ address: manifest.treasury, abi, functionName: 'tasks', args: [binding.taskId] });
   }
   if (task[0] !== BigInt(binding.budget) || task[5] !== BigInt(paidTerms.price) || task[7].toLowerCase() !== account(3).address.toLowerCase() || task[9]) throw new Error('Task allocation identity mismatch');
  }
 } finally { release(); }
 const bindings = {};
 for (const [index, agent] of workers.entries()) {
  const task = expected[agent.id], stepId = 'source-v1';
  const request = { chainId: String(manifest.chainId), treasury: manifest.treasury, token: manifest.token,
   merchant: account(3).address, amount: paidTerms.price, route: '/dataset', body: { dataset: 'task-budget-reference-v1' } };
  const opId = await operationId({ chainId: request.chainId, treasury: manifest.treasury, taskId: task.taskId, stepId });
  const runner = createCheckpointRunner({ directory: path.join(directory, agent.id), publicClient, manifest, endpoint: merchantUrl,
   taskId: task.taskId, steps: [{ id: stepId, request }], validateResult: async result => {
    if (result.status !== 'ready' || typeof result.result !== 'string' || !result.receipt?.transaction) return false;
    const receipt = await publicClient.getTransactionReceipt({ hash: result.receipt.transaction });
    return receipt.status === 'success' && parseEventLogs({ abi, logs: receipt.logs, eventName: 'Paid' }).some(log =>
     log.address.toLowerCase() === manifest.treasury.toLowerCase() && log.args.taskId === task.taskId && log.args.operationId === opId && log.args.amount === BigInt(paidTerms.price));
   } });
  const current = await publicClient.readContract({ address: manifest.treasury, abi, functionName: 'tasks', args: [task.taskId] });
  const wallets = [wallet(indices[index]), ...replacementWallets];
  const walletClient = wallets.find(candidate => candidate.account.address.toLowerCase() === current[6].toLowerCase());
  if (!walletClient) throw new Error('Assigned worker has no authorized local executor');
  bindings[agent.id] = { runner, walletClient, schedulerWallet, taskId: task.taskId,
   async discover() {
    const mode = run.discoveryMode;
    // Supplied directory is test-only dependency injection; environment never loads arbitrary code.
    const directory = suppliedDirectory || (mode === 'arkiv' ? createArkivDirectory({ accessKey: env.ARKIV_ACCESS_KEY || '' }) : {
     async query({ network, now }) { return { source: 'local-executor-registry', chainId: spec.chainId, block: '1', records: replacementWallets.map(candidate => ({
      entityKey: keccak256(stringToHex(candidate.account.address)), address: candidate.account.address, owner: candidate.account.address,
      expiresAtBlock: '1000000', updatedAtBlock: '1', validUntil: (now + 60n).toString(), network, scheme: spec.scheme, role: spec.role,
      status: 'ready', capabilities: [spec.capability],
     })) }; },
    });
    await onActivity('discovery-started', agent.id, mode === 'arkiv' ? 'Querying live Arkiv for an eligible local executor.' : 'Querying the explicitly selected local executor registry.');
    const release = await ownerLock(path.join(root, 'signers'));
    try {
     const decision = await handoffFromArkiv({ runner, directory, publicClient, manifest, taskId: task.taskId, schedulerWallet,
      failedWorker: bindings[agent.id].walletClient.account.address,
      authorize: async address => replacementWallets.some(candidate => candidate.account.address.toLowerCase() === address.toLowerCase()),
      probe: async ({ worker, message }) => { const candidate = replacementWallets.find(item => item.account.address.toLowerCase() === worker.address.toLowerCase());
       if (!candidate) throw new Error('No reachable executor'); return { busy: false, signature: await candidate.signMessage({ message }) }; },
     });
     await onActivity('discovery-result', agent.id, decision.selected ? 'Eligible replacement selected with owner policy and signed readiness.' : 'No eligible replacement; task remains waiting.', { discovery: decision.evidence });
     if (!decision.state) { const error = new Error('No eligible replacement; retry discovery when an executor is available'); error.code = 'DISCOVERY_WAITING'; throw error; }
     const replacement = replacementWallets.find(candidate => candidate.account.address.toLowerCase() === decision.state.handoff.replacement.toLowerCase());
     if (!replacement) throw new Error('Replacement executor unavailable');
     bindings[agent.id].walletClient = replacement;
     await onActivity('assignment-confirmed', agent.id, 'Replacement worker and epoch confirmed before restart.', {
      taskId: task.taskId, worker: replacement.account.address, epoch: decision.state.handoff.epoch, transaction: decision.state.handoff.transaction,
     });
    } finally { release(); }
   },
  };
 }
 return { ...createPaidResearchTools(bindings), tasks: expected, bindings };
}

export async function financialSnapshot(run, { env = process.env } = {}) {
 if (!run.paid || !run.tasks) return null;
 const { deployment, publicClient } = await loadRuntimeDeployment({ env });
 if (!sameDeployment(run.deployment, deployment)) throw new Error('Run deployment changed');
 const block = await publicClient.getBlockNumber();
 const tasks = Object.fromEntries(await Promise.all(Object.entries(run.tasks).map(async ([agentId, binding]) => [agentId, {
  taskId: binding.taskId, ...taskSnapshot(await publicClient.readContract({ address: deployment.treasury, abi, functionName: 'tasks', args: [binding.taskId], blockNumber: block })),
 }])));
 return { block: block.toString(), chainId: deployment.chainId, treasury: deployment.treasury, tasks };
}
