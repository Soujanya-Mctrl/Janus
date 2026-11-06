import { keccak256 } from 'viem';
import { INTERFACE_VERSION, bytes32, taskSnapshot } from '../../../shared/protocol.mjs';
import descriptor from '../../../shared/treasury-interface.json' with { type: 'json' };
import network from '../../../shared/network.json' with { type: 'json' };
const abi = descriptor.abi;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export async function validateTreasury(client, manifest) {
  if (manifest.interfaceVersion !== INTERFACE_VERSION || manifest.abiHash !== descriptor.abiHash) throw new Error('Treasury interface/version mismatch');
  const chainId = await client.getChainId();
  if (manifest.chainId !== chainId || !(chainId === network.chainId || manifest.mode === 'local' && [1337, 31337].includes(chainId))) throw new Error('Treasury chain mismatch');
  if (chainId === network.chainId && !same(manifest.token, network.token.address)) throw new Error('Unsupported testnet token');
  if (![manifest.treasury, manifest.owner, manifest.token].every(address => /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/.test(address))) throw new Error('Invalid deployment identity');
  const code = await client.getBytecode({ address: manifest.treasury });
  if (!code || !same(keccak256(code), manifest.runtimeCodeHash)) throw new Error('Treasury runtime code mismatch');
  const read = (functionName, args = []) => client.readContract({ address: manifest.treasury, abi, functionName, args });
  const [owner, token] = await Promise.all([read('owner'), read('token')]);
  if (!same(owner, manifest.owner) || !same(token, manifest.token)) throw new Error('Treasury owner/token mismatch');
  return read;
}

export async function planRecovery({ publicClient, manifest, taskId, operationIds = [] }) {
  bytes32(taskId);
  const read = await validateTreasury(publicClient, manifest);
  const task = taskSnapshot(await read('tasks', [taskId]));
  if (task.cap === '0') throw new Error('Unknown recovery task');
  const timestamp = (await publicClient.getBlock()).timestamp;
  const operations = await Promise.all([...new Set(operationIds.map(bytes32))].map(async operationId => {
    const operation = await read('getOperation', [taskId, operationId]);
    return { operationId, attempt: operation.attempt.toString(), amount: operation.amount.toString(), deadline: operation.deadline.toString(),
      status: Number(operation.status), canExpire: Number(operation.status) === 1 && timestamp >= operation.deadline };
  }));
  const unallocated = (await read('unallocated')).toString();
  return { interfaceVersion: INTERFACE_VERSION, chainId: manifest.chainId, treasury: manifest.treasury, taskId, task, unallocated,
    operations, observedAt: timestamp.toString(), withdrawsEntireUnallocatedReserve: true,
    withdrawableAfterListedExpiries: (BigInt(unallocated) + BigInt(task.available) + operations.filter(op => op.canExpire).reduce((sum, op) => sum + BigInt(op.amount), 0n)).toString() };
}

// Uses only owner wallet + chain RPC + exported ABI/manifest. No application service.
// Re-running re-reads confirmed state, including a crash after release but before withdrawal.
export async function executeRecovery({ publicClient, walletClient, manifest, taskId, operationIds = [] }) {
  await planRecovery({ publicClient, manifest, taskId, operationIds });
  if (!same(walletClient.account?.address, manifest.owner)) throw new Error('Recovery wallet is not the owner');
  if (await walletClient.getChainId() !== manifest.chainId) throw new Error('Recovery wallet chain mismatch');
  const receipts = [];
  const read = (functionName, args = []) => publicClient.readContract({ address: manifest.treasury, abi, functionName, args });
  const send = async (functionName, args) => {
    const hash = await walletClient.writeContract({ address: manifest.treasury, abi, functionName, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Recovery transaction reverted: ${hash}`);
    receipts.push({ action: functionName, transaction: hash });
  };
  if (!(await read('tasks', [taskId]))[9]) await send('cancelTask', [taskId]);
  for (const operationId of [...new Set(operationIds.map(bytes32))]) {
    const operation = await read('getOperation', [taskId, operationId]);
    if (Number(operation.status) === 1 && (await publicClient.getBlock()).timestamp >= operation.deadline) {
      await send('expire', [taskId, operationId, operation.attempt]);
    }
  }
  const available = (await read('tasks', [taskId]))[1];
  if (available > 0n) await send('releaseAvailable', [taskId, available]);
  const unallocated = await read('unallocated');
  if (unallocated > 0n) await send('withdrawUnallocated', [unallocated]);
  return { ...await planRecovery({ publicClient, manifest, taskId, operationIds }), receipts };
}
