import { createPublicClient, createWalletClient, http, custom, defineChain } from 'viem';
import { validateTreasury } from '../../../contracts/phase1/lib/recovery-core.mjs';
import { transactionPolicy } from '../../../backend/hedera/lib/transaction-policy.mjs';
import descriptor from '../../../shared/treasury-interface.json' with { type: 'json' };
import network from '../../../shared/network.json' with { type: 'json' };
import manifest from '../../../shared/deployments/hedera-testnet.json' with { type: 'json' };
import { bytes32, taskSnapshot } from '../../../shared/protocol.mjs';
export const deployment = manifest;
export const chain = defineChain({ ...network, id: network.chainId });
export const client = createPublicClient({ chain, transport: http(), cacheTime: 0 });
const abi = descriptor.abi;
export async function readTreasury(publicClient = client, identity = manifest, taskIds = [], fromBlock) {
 await validateTreasury(publicClient, identity);
 const block = await publicClient.getBlockNumber();
 const start = fromBlock === undefined ? (block > 1000n ? block - 1000n : 0n) : BigInt(fromBlock);
 if (start < 0n || start > block || block - start > 10000n) throw new Error('Choose an event range of at most 10,000 blocks ending at the current block');
 const logs = [];
 for (let from = start; from <= block; from += 100n) {
  logs.push(...await publicClient.getContractEvents({ address: identity.treasury, abi, fromBlock: from, toBlock: from + 99n < block ? from + 99n : block, strict: true }));
 }
 const ids = [...new Set([...taskIds.map(bytes32), ...logs.filter(log => log.eventName === 'TaskCreated').map(log => log.args.taskId)])];
 const read = (functionName, args = []) => publicClient.readContract({ address: identity.treasury, abi, functionName, args, blockNumber: block });
 const [unallocated, totalAvailable, totalReserved, totalSpent, withdrawn, deposited, scheduler, tasks] = await Promise.all([
  read('unallocated'), read('totalAvailable'), read('totalReserved'), read('totalSpent'), read('totalWithdrawn'), read('deposited'), read('scheduler'),
  Promise.all(ids.map(async id => { const task = taskSnapshot(await read('tasks', [id])); return { id, cap:task.cap, available:task.available, reserved:task.reserved, spent:task.spent, returned:task.returned, worker:task.worker, epoch:task.epoch, cancelled:task.cancelled }; })),
 ]);
 if (unallocated + totalAvailable + totalReserved + totalSpent + withdrawn !== deposited) throw new Error('Treasury accounting invariant mismatch');
 return { block: block.toString(), fromBlock: start.toString(), treasury: identity.treasury, chainId: identity.chainId,
  unallocated: unallocated.toString(), available: totalAvailable.toString(), reserved: totalReserved.toString(), spent: totalSpent.toString(), withdrawn: withdrawn.toString(), scheduler,
  tasks: tasks.filter(task => task.cap !== '0'), events: logs.map(log => ({ name: log.eventName, transaction: log.transactionHash, block: log.blockNumber.toString(), args: Object.fromEntries(Object.entries(log.args).map(([k,v]) => [k, typeof v === 'bigint' ? v.toString() : v])) })) };
}
export async function treasuryAction({ publicClient = client, identity = manifest, walletClient, action, taskId, replacement, onSubmitted = hash => { void hash; } }) {
 const read = await validateTreasury(publicClient, identity);
 const address = walletClient.account?.address;
 if (!address || await walletClient.getChainId() !== identity.chainId) throw new Error('Connect an authorized wallet on the treasury network');
 const owner = address.toLowerCase() === identity.owner.toLowerCase();
 if (!['cancelTask','assignWorker','releaseAvailable','withdrawUnallocated'].includes(action)) throw new Error('Unsupported treasury action');
 if (action === 'assignWorker') {
  if (!owner && address.toLowerCase() !== (await read('scheduler')).toLowerCase()) throw new Error('Owner or scheduler wallet required');
  if (!/^0x[0-9a-fA-F]{40}$/.test(replacement ?? '') || /^0x0{40}$/.test(replacement)) throw new Error('Enter a nonzero replacement wallet');
 } else if (!owner) throw new Error('Owner wallet required');
 let args;
 if (action === 'withdrawUnallocated') { const amount = await read('unallocated'); if (!amount) throw new Error('No unallocated reserve'); args = [amount]; }
 else {
  bytes32(taskId); const task = taskSnapshot(await read('tasks', [taskId]));
  if (task.cap === '0') throw new Error('Unknown task');
  if (action === 'cancelTask') args = [taskId];
  if (action === 'assignWorker') { if (task.cancelled) throw new Error('Task cancelled'); args = [taskId,replacement]; }
  if (action === 'releaseAvailable') { if (!task.cancelled) throw new Error('Cancel task before release'); if (task.available === '0') throw new Error('No available balance'); args = [taskId,BigInt(task.available)]; }
 }
 const hash = await walletClient.writeContract({ ...await transactionPolicy(publicClient, identity.chainId), address: identity.treasury, abi, functionName: action, args });
 onSubmitted(hash);
 const receipt = await publicClient.waitForTransactionReceipt({ hash });
 if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
 return { hash, block: receipt.blockNumber.toString() };
}
export function connectedWallet(provider, address) { return createWalletClient({ chain, account: address, transport: custom(provider) }); }
