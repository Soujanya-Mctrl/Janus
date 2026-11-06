import { randomBytes } from 'node:crypto';
import { verifyMessage } from 'viem';
import { selectReplacement } from '../runner/checkpoint-runner.mjs';
import spec from '../../shared/arkiv-worker.json' with { type: 'json' };

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const address = value => /^0x[0-9a-fA-F]{40}$/.test(value ?? '') && !/^0x0{40}$/.test(value);
const integer = value => typeof value === 'string' && /^[0-9]+$/.test(value);
async function readiness(probe, input) {
 const controller = new AbortController();
 let timer;
 try {
  return await Promise.race([probe({ ...input, signal: controller.signal }), new Promise((_, reject) => {
   timer = setTimeout(() => { controller.abort(); reject(new Error('Readiness timeout')); }, 5000);
  })]);
 } finally { clearTimeout(timer); }
}

export async function discoverReplacement({ directory, network, taskId, treasury, epoch, failedWorker,
 authorize, probe, now = () => BigInt(Math.floor(Date.now() / 1000)) }) {
 if (typeof authorize !== 'function' || typeof probe !== 'function') throw new Error('Discovery requires owner policy and authenticated worker readiness');
 const queriedAt = now();
 // RPC errors propagate: no local-directory or cached fallback.
 const snapshot = await directory.query({ network, capability: spec.capability, scheme: spec.scheme, now: queriedAt });
 if (snapshot.chainId !== spec.chainId || !integer(snapshot.block) || !Array.isArray(snapshot.records)) throw new Error('Invalid Arkiv snapshot');
 const rejected = [], latest = new Map();
 for (const record of snapshot.records) {
  let reason;
  if (!address(record.address) || !same(record.owner, record.address)) reason = 'owner-worker mismatch';
  else if (!/^0x[0-9a-fA-F]{64}$/.test(record.entityKey ?? '') || !integer(record.updatedAtBlock)
    || BigInt(record.updatedAtBlock) > BigInt(snapshot.block)) reason = 'invalid entity';
  else if (!integer(record.expiresAtBlock) || BigInt(record.expiresAtBlock) <= BigInt(snapshot.block)
    || !integer(record.validUntil) || BigInt(record.validUntil) <= now()) reason = 'expired';
  else if (record.network !== network || record.scheme !== spec.scheme || record.role !== spec.role
    || record.status !== 'ready' || !Array.isArray(record.capabilities) || !record.capabilities.includes(spec.capability)) reason = 'incompatible';
  else if (same(record.address, failedWorker)) reason = 'failed worker';
  if (reason) { rejected.push({ entityKey: record.entityKey ?? null, reason }); continue; }
  const key = record.address.toLowerCase(), prior = latest.get(key);
  // Repeated wallet publications cannot create duplicate worker identities.
  if (!prior || BigInt(record.updatedAtBlock) > BigInt(prior.updatedAtBlock)
    || (record.updatedAtBlock === prior.updatedAtBlock && record.entityKey < prior.entityKey)) latest.set(key, record);
 }
 const candidates = [];
 for (const record of [...latest.values()].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()))) {
  if (await authorize(record.address, record) !== true) { rejected.push({ entityKey: record.entityKey, reason: 'not owner-authorized' }); continue; }
  const deadline = now() + 30n;
  const message = JSON.stringify({ domain: 'janus.worker.readiness.v1', network, treasury: treasury.toLowerCase(), taskId,
   epoch: String(epoch), entityKey: record.entityKey, worker: record.address.toLowerCase(), ready: true,
   nonce: randomBytes(32).toString('hex'), deadline: deadline.toString() });
  let ready = false;
  try {
   const response = await readiness(probe, { worker: record, message });
   ready = response?.busy === false && now() < deadline && BigInt(record.validUntil) > now()
    && await verifyMessage({ address: record.address, message, signature: response.signature });
  } catch { /* An unreachable or unauthenticated worker is ineligible. */ }
  if (!ready) { rejected.push({ entityKey: record.entityKey, reason: 'readiness rejected' }); continue; }
  candidates.push({ ...record, authorized: true, busy: false, expiresAt: record.validUntil, readinessDeadline: deadline.toString() });
 }
 const selected = selectReplacement(candidates.filter(record => BigInt(record.readinessDeadline) > now()), { requiredCapabilities: [spec.capability], failedWorker, now: now() });
 return { status: selected ? 'selected' : 'waiting', selected, evidence: {
  source: snapshot.source ?? 'arkiv', chainId: String(snapshot.chainId), block: snapshot.block, queriedAt: snapshot.queriedAt ?? queriedAt.toString(),
  latencyMs: snapshot.latencyMs === undefined ? null : String(snapshot.latencyMs), recordsRead: String(snapshot.records.length), rejected,
  selected: selected ? { address: selected.address, entityKey: selected.entityKey, owner: selected.owner,
   validUntil: selected.validUntil, expiresAtBlock: selected.expiresAtBlock } : null,
 } };
}

export async function handoffFromArkiv({ runner, directory, publicClient, manifest, taskId, schedulerWallet, authorize, probe, afterAssignment, failedWorker }) {
 const state = await runner.inspect();
 if (state.handoff?.discovery && (state.handoff.status === 'intent' || (state.handoff.status === 'confirmed' && !failedWorker))) {
  // Reconcile an already-broadcast assignment even after its directory lease expires.
  return { status: 'reconciled', state: await runner.handoff({ schedulerWallet, replacement: state.handoff.replacement,
   eligible: async () => { throw new Error('Pending handoff must only reconcile'); }, afterAssignment }) };
 }
 const { taskTreasuryAbi } = await import('../hedera/lib/treasury.mjs');
 const task = await publicClient.readContract({ address: manifest.treasury, abi: taskTreasuryAbi, functionName: 'tasks', args: [taskId] });
 if (failedWorker && !same(task[6], failedWorker)) throw new Error('Failed worker no longer assigned');
 const decision = await discoverReplacement({ directory, network: `eip155:${manifest.chainId}`, taskId, treasury: manifest.treasury,
  epoch: task[8], failedWorker: task[6], authorize, probe });
 if (!decision.selected) return decision;
 const replacement = decision.selected;
 const result = await runner.handoff({ schedulerWallet, replacement: replacement.address, discovery: decision.evidence,
  eligible: async () => {
   const current = await publicClient.readContract({ address: manifest.treasury, abi: taskTreasuryAbi, functionName: 'tasks', args: [taskId] });
   if (!same(current[6], task[6]) || current[8] !== task[8]) return false;
   const checked = await discoverReplacement({ directory, network: `eip155:${manifest.chainId}`, taskId, treasury: manifest.treasury,
    epoch: current[8], failedWorker: current[6], authorize: async (address, record) => same(address, replacement.address)
     && record.entityKey === replacement.entityKey && await authorize(address, record) === true, probe });
   return checked.selected?.entityKey === replacement.entityKey;
  }, afterAssignment });
 return { ...decision, state: result };
}
