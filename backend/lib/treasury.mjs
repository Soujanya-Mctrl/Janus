import { encodeAbiParameters, getAddress } from 'viem';
import abi from '../../shared/protocol/task-treasury-abi.json' with { type: 'json' };
import network from '../../shared/protocol/network.json' with { type: 'json' };

export { abi as treasuryAbi };
export const encodeAuthorization = (taskId, operationId, attempt) => encodeAbiParameters(
  [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }], [taskId, operationId, attempt],
);
const fields = ['cap', 'available', 'reserved', 'spent', 'returned', 'perOperationLimit', 'worker', 'merchant', 'epoch', 'cancelled'];

// Uses RPC and an owner wallet only: no application, facilitator or login dependency.
export function treasuryClient({ publicClient, walletClient, address, chainId = network.id }) {
  address = getAddress(address);
  const read = (functionName, args = []) => publicClient.readContract({ address, abi, functionName, args });
  async function verify() {
    if (await publicClient.getChainId() !== chainId) throw new Error('Treasury network mismatch');
    const code = await publicClient.getCode({ address });
    if (!code || code === '0x') throw new Error('Treasury contract not deployed');
  }
  async function task(taskId) {
    await verify();
    const result = Object.fromEntries((await read('tasks', [taskId])).map((value, index) => [fields[index], value]));
    if (result.cap === 0n) throw new Error('Unknown task');
    if (result.cap !== result.available + result.reserved + result.spent + result.returned) throw new Error('Task accounting mismatch');
    return result;
  }
  async function send(functionName, args) {
    await verify();
    if (!walletClient?.account) throw new Error('Owner wallet required');
    if (getAddress(walletClient.account.address) !== getAddress(await read('owner'))) throw new Error('Owner wallet mismatch');
    const hash = await walletClient.writeContract({ address, abi, functionName, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Treasury action reverted');
    return receipt;
  }
  return {
    read, task, verify,
    cancel: taskId => send('cancelTask', [taskId]),
    release: (taskId, amount) => send('releaseAvailable', [taskId, amount]),
    withdraw: amount => send('withdrawUnallocated', [amount]),
    // Separate confirmed actions preserve an auditable recovery path. A partial
    // failure never triggers an automatic second withdrawal on retry.
    async recoverAvailable(taskId) {
      await send('cancelTask', [taskId]);
      const state = await task(taskId);
      if (state.available === 0n) return { released: 0n, withdrawn: 0n, reserved: state.reserved };
      await send('releaseAvailable', [taskId, state.available]);
      await send('withdrawUnallocated', [state.available]);
      return { released: state.available, withdrawn: state.available, reserved: state.reserved };
    },
  };
}
