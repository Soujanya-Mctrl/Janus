import { keccak256, stringToHex } from 'viem';
import { PurchaseConflict } from './purchase-ledger.mjs';

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  throw new Error('Request must contain JSON strings, safe integers, booleans, arrays and objects');
}

export function purchaseIdentity({ chainId, treasury, taskId, stepId, merchant, token, amount, route, body }) {
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || typeof stepId !== 'string' || !stepId || stepId.length > 256) throw new Error('Invalid operation scope');
  for (const address of [treasury, merchant, token]) if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid payment address');
  if (!/^0x[0-9a-fA-F]{64}$/.test(taskId) || typeof amount !== 'string' || !/^[1-9][0-9]*$/.test(amount) || BigInt(amount) >= 2n ** 256n) throw new Error('Invalid payment binding');
  if (typeof route !== 'string' || !route.startsWith('/')) throw new Error('Invalid merchant route');
  const scope = { schema: 1, chainId, treasury: treasury.toLowerCase(), taskId: taskId.toLowerCase(), stepId };
  const operationId = keccak256(stringToHex(canonicalJson(scope)));
  const request = canonicalJson({ ...scope, operationId, merchant: merchant.toLowerCase(), token: token.toLowerCase(), amount, route, body });
  const requestHash = keccak256(stringToHex(request));
  return { operationId, requestHash, request, key: canonicalJson({ ...scope, operationId }) };
}

export class PaymentPending extends Error {}
export class MissingPurchase extends Error {}

// The adapter owns chain verification and current-worker authentication.
// It must report confirmed onchain settlement, never infer failure from HTTP.
export function paidMerchant({ ledger, adapter, produce }) {
  async function execute(input, authorization) {
    const identity = purchaseIdentity(input);
    await adapter.authenticate(input, identity, authorization);
    let row = ledger.get(identity.key);
    const observed = await adapter.inspect(input, identity);
    if (!row && observed.state === 'settled') throw new MissingPurchase('Paid operation has no durable merchant record; owner review required');
    if (!row && observed.state !== 'reserved') throw new PaymentPending('A matching active reservation is required');
    row = ledger.prepare(identity.key, identity.requestHash, identity.request);
    if (['paid', 'ready'].includes(row.state) && observed.state !== 'settled') throw new PurchaseConflict('Stored payment disagrees with authoritative state');
    if (row.state === 'ready') {
      // Authenticate first, including after worker replacement. Stored results
      // belong to the task purchase, not the original worker's identity.
      if (observed.state !== 'settled') throw new PurchaseConflict('Stored payment disagrees with authoritative state');
      return { result: JSON.parse(row.result), digest: row.digest, reused: true };
    }
    if (observed.state === 'settled') {
      if (row.state === 'intent') throw new PurchaseConflict('Unjournaled payment requires reconciliation');
      ledger.paid(identity.key, observed.receipt);
    } else if (row.state === 'intent' && observed.state === 'reserved' && ledger.claim(identity.key)) {
      try {
        const submission = await adapter.settle(input, identity, observed);
        ledger.submitted(identity.key, submission.transactionId);
      } catch {
        throw new PaymentPending('Settlement submission is ambiguous; reconcile the same operation');
      }
      const after = await adapter.inspect(input, identity);
      if (after.state !== 'settled') throw new PaymentPending('Settlement awaiting confirmation');
      ledger.paid(identity.key, after.receipt);
    } else if (row.state !== 'paid') throw new PaymentPending('Existing payment intent requires reconciliation');
    row = ledger.result(identity.key, await produce(JSON.parse(identity.request)));
    return { result: JSON.parse(row.result), digest: row.digest, reused: false };
  }
  return { execute };
}
