import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJson, bytes32, operationId } from '../../shared/protocol.mjs';
import { buyTaskDataset } from '../hedera/lib/task-client.mjs';
import { taskTreasuryAbi as abi } from '../hedera/lib/treasury.mjs';
import { validateTreasury } from '../../contracts/phase1/lib/recovery.mjs';
import { createPrivateJsonStore } from '../lib/private-json.mjs';

const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();

export function createCheckpointRunner({ directory, publicClient, manifest, endpoint, taskId, steps, validateResult }) {
 const privateStore = createPrivateJsonStore(directory, { domain: 'paid-checkpoint-v1' });
 taskId = bytes32(taskId);
 if (!Array.isArray(steps) || !steps.length || new Set(steps.map(step => step.id)).size !== steps.length
   || steps.some(step => typeof step.id !== 'string' || !step.id || !step.request) || typeof validateResult !== 'function') throw new Error('Invalid workflow definition');
 const graphHash = hash(steps), file = path.join(directory, hash({ taskId, treasury: manifest.treasury.toLowerCase(), chainId: String(manifest.chainId) }) + '.json');
 const readTask = () => publicClient.readContract({ address: manifest.treasury, abi, functionName: 'tasks', args: [taskId] });
 const locked = async action => {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = await fs.open(file + '.lock', 'wx', 0o600).catch(error => { if (error.code === 'EEXIST') throw new Error('Task busy; reconcile stale crash lock before restart'); throw error; });
  try { return await action(); } finally { await lock.close(); await fs.unlink(file + '.lock'); }
 };
 const load = async () => {
  try {
   const envelope = await privateStore.read(file);
   if (envelope.hash !== hash(envelope.state) || envelope.state.version !== '1' || envelope.state.graphHash !== graphHash
      || envelope.state.taskId !== taskId || envelope.state.treasury !== manifest.treasury.toLowerCase()
      || envelope.state.chainId !== String(manifest.chainId) || !Array.isArray(envelope.state.completed)) throw new Error('Invalid or incompatible checkpoint');
   const ids = envelope.state.completed.map(step => step.id);
   if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== steps[index]?.id)) throw new Error('Invalid checkpoint step order');
   for (const step of envelope.state.completed) if (step.resultHash !== hash(step.result) || !await validateResult(step.result, step.id)) throw new Error('Invalid checkpoint artifact');
   return envelope.state;
  } catch (error) {
   if (error.code !== 'ENOENT') throw error;
   return { version: '1', taskId, treasury: manifest.treasury.toLowerCase(), chainId: String(manifest.chainId), graphHash, revision: '0', completed: [], pending: null, handoff: null };
  }
 };
 const save = async state => {
  state.revision = (BigInt(state.revision) + 1n).toString();
  await privateStore.write(file, { hash: hash(state), state });
 };
 return {
  async inspect() { return locked(load); },
  async run({ walletClient, afterPaid = async () => {} }) {
   return locked(async () => {
    await validateTreasury(publicClient, manifest);
    const state = await load(), task = await readTask();
    if (task[9] || !same(task[6], walletClient.account.address)) throw new Error('Worker is not currently assigned');
    if (state.handoff?.status === 'intent') throw new Error('Handoff requires reconciliation before execution');
    for (const step of state.completed) await afterPaid(step.result, step.id, { reused: true });
    for (const step of steps.slice(state.completed.length)) {
     const current = await readTask();
     if (current[9] || !same(current[6], walletClient.account.address)) throw new Error('Worker authority changed');
     state.pending = step.id; await save(state); // durable intent before paid HTTP call
     const opId = await operationId({ chainId: String(manifest.chainId), treasury: manifest.treasury, taskId, stepId: step.id });
     const prior = await publicClient.readContract({ address: manifest.treasury, abi, functionName: 'getOperation', args: [taskId, opId] });
     const result = await buyTaskDataset({ publicClient, walletClient, endpoint, taskId, stepId: step.id, request: step.request, manifest });
     if (!await validateResult(result, step.id)) throw new Error('Output validation failed; payment remains settled');
     await afterPaid(result, step.id, { reused: Number(prior.status) === 2 }); // no financial state is reset
     const latest = await readTask();
     if (!same(latest[6], walletClient.account.address) || latest[8] !== current[8] || latest[9]) throw new Error('Worker fenced before checkpoint commit');
     state.completed.push({ id: step.id, result, resultHash: hash(result) }); state.pending = null; await save(state);
    }
    return state;
   });
  },
  async handoff({ schedulerWallet, replacement, eligible, discovery, afterAssignment = async () => {} }) {
   if (typeof eligible !== 'function') throw new Error('No eligible replacement');
   if (!/^0x[0-9a-fA-F]{40}$/.test(replacement) || /^0x0{40}$/.test(replacement)) throw new Error('Invalid replacement');
   return locked(async () => {
    await validateTreasury(publicClient, manifest);
    if (await schedulerWallet.getChainId() !== manifest.chainId) throw new Error('Scheduler chain mismatch');
    const scheduler = await publicClient.readContract({ address: manifest.treasury, abi, functionName: 'scheduler' });
    if (!same(schedulerWallet.account.address, manifest.owner) && !same(schedulerWallet.account.address, scheduler)) throw new Error('Unauthorized scheduler');
    const state = await load(); let task = await readTask();
    if (state.handoff?.status === 'confirmed' && same(task[6], replacement) && task[8].toString() === state.handoff.epoch) return state;
    let fresh = false;
    if (task[9]) throw new Error('Task cancelled');
    if (!state.handoff || state.handoff.status === 'confirmed') {
     if (!await eligible(replacement)) throw new Error('No eligible replacement');
     fresh = true;
     state.handoff = { status: 'intent', fromWorker: task[6].toLowerCase(), fromEpoch: task[8].toString(), replacement: replacement.toLowerCase() };
     if (discovery) state.handoff.discovery = discovery;
     await save(state); // assignment outbox persisted before touching the chain
    }
    const intent = state.handoff;
    if (!same(intent.replacement, replacement)) throw new Error('Different pending handoff');
    if (!fresh && task[8] === BigInt(intent.fromEpoch) && same(task[6], intent.fromWorker)) throw new Error('Unknown assignment outcome; reconcile the saved transaction before retrying');
    if (task[8] === BigInt(intent.fromEpoch) && same(task[6], intent.fromWorker)) {
     const transaction = await schedulerWallet.writeContract({ address: manifest.treasury, abi, functionName: 'assignWorker', args: [taskId, replacement] });
     state.handoff.transaction = transaction; await save(state);
     const receipt = await publicClient.waitForTransactionReceipt({ hash: transaction });
     if (receipt.status !== 'success') throw new Error('Assignment reverted');
     await afterAssignment(receipt);
     task = await readTask();
    }
    if (!same(task[6], replacement) || task[8] !== BigInt(intent.fromEpoch) + 1n) throw new Error('Concurrent assignment requires owner reconciliation');
    state.handoff.status = 'confirmed'; state.handoff.epoch = task[8].toString(); await save(state);
    return state;
   });
  },
 };
}

export function selectReplacement(workers, { requiredCapabilities, failedWorker, now = BigInt(Math.floor(Date.now() / 1000)) }) {
 if (!Array.isArray(requiredCapabilities) || requiredCapabilities.some(value => typeof value !== 'string')) throw new Error('Invalid capabilities');
 const addresses = workers.map(worker => worker.address?.toLowerCase());
 if (new Set(addresses).size !== addresses.length) throw new Error('Duplicate worker identity');
 return workers.filter(worker => /^0x[0-9a-fA-F]{40}$/.test(worker.address ?? '') && !/^0x0{40}$/.test(worker.address)
  && !same(worker.address, failedWorker) && worker.authorized === true && worker.busy === false
  && typeof worker.expiresAt === 'string' && /^[0-9]+$/.test(worker.expiresAt) && BigInt(worker.expiresAt) > now
  && Array.isArray(worker.capabilities) && requiredCapabilities.every(capability => worker.capabilities.includes(capability)))
  .sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()))[0];
}
