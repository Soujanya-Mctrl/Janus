export const INTERFACE_VERSION = 'janus-task-treasury/1';
export const TASK_FIELDS = ['cap', 'available', 'reserved', 'spent', 'returned', 'perOperationLimit', 'worker', 'merchant', 'epoch', 'cancelled'];
export const UINT64_MAX = (1n << 64n) - 1n;

export function baseUnits(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('Expected canonical unsigned decimal base units');
  const result = BigInt(value);
  if (result >= 1n << 256n) throw new Error('Amount exceeds uint256');
  return result;
}

export function bytes32(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/.test(value)) throw new Error('Expected nonzero bytes32');
  return value.toLowerCase();
}

export function encodeAuthorization(taskId, operationId, attempt) {
  const n = baseUnits(attempt);
  if (n === 0n || n > UINT64_MAX) throw new Error('Invalid uint64 attempt');
  return bytes32(taskId) + bytes32(operationId).slice(2) + n.toString(16).padStart(64, '0');
}

export function decodeAuthorization(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{192}$/.test(value)) throw new Error('Expected 96-byte task authorization');
  const taskId = bytes32(value.slice(0, 66));
  const operationId = bytes32('0x' + value.slice(66, 130));
  const attempt = BigInt('0x' + value.slice(130));
  if (!attempt || attempt > UINT64_MAX) throw new Error('Invalid uint64 attempt');
  return { taskId, operationId, attempt: attempt.toString() };
}

// Version 1 admits strings, booleans, null, arrays and plain objects. Numeric
// values must be explicit decimal strings, avoiding float/unsafe-integer ambiguity.
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const entries = [];
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error('Sparse arrays are not canonical');
      entries.push(canonicalJson(value[index]));
    }
    return '[' + entries.join(',') + ']';
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  throw new Error('Canonical values require explicit strings for numbers and plain JSON objects');
}

export async function operationId({ chainId, treasury, taskId, stepId }) {
  baseUnits(chainId);
  if (!/^0x[0-9a-fA-F]{40}$/.test(treasury) || /^0x0{40}$/.test(treasury) || typeof stepId !== 'string' || !stepId.length) throw new Error('Invalid operation identity');
  const canonical = canonicalJson({ domain: INTERFACE_VERSION, chainId, treasury: treasury.toLowerCase(), taskId: bytes32(taskId), stepId });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return '0x' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function taskSnapshot(tuple) {
  if (!Array.isArray(tuple) || tuple.length !== TASK_FIELDS.length) throw new Error('Unexpected treasury task tuple');
  return Object.fromEntries(TASK_FIELDS.map((field, index) => [field, typeof tuple[index] === 'bigint' ? tuple[index].toString() : tuple[index]]));
}
