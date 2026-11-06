import { getAddress, verifyMessage } from 'viem';
import { treasuryAbi, encodeAuthorization } from './treasury.mjs';
import { canonicalJson } from './paid-merchant.mjs';

export function accessMessage(input, identity, { epoch, expiresAt }) {
  return `Janus task purchase access v1\n${canonicalJson({ chainId: input.chainId, treasury: input.treasury.toLowerCase(), taskId: input.taskId.toLowerCase(), operationId: identity.operationId, requestHash: identity.requestHash, epoch, expiresAt })}`;
}

export function taskPaymentAdapter({ publicClient, gasWallet, treasury, chainId, merchant, token, now = () => Math.floor(Date.now() / 1000) }) {
  const read = (functionName, args = []) => publicClient.readContract({ address: treasury, abi: treasuryAbi, functionName, args });
  async function validateScope(input) {
    if (await publicClient.getChainId() !== chainId || input.chainId !== chainId || getAddress(input.treasury) !== getAddress(treasury)) throw new Error('Wrong treasury network or deployment');
    if (getAddress(input.merchant) !== getAddress(merchant) || getAddress(input.token) !== getAddress(token) || getAddress(await read('token')) !== getAddress(token)) throw new Error('Wrong merchant or asset');
  }
  return {
    async authenticate(input, identity, authorization) {
      await validateScope(input);
      const task = await read('tasks', [input.taskId]);
      if (task[0] === 0n || !authorization || typeof authorization.epoch !== 'string' || !/^[1-9][0-9]*$/.test(authorization.epoch)) throw new Error('Invalid task authority');
      if (BigInt(authorization.epoch) !== task[8] || !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= now() || authorization.expiresAt > now() + 300) throw new Error('Expired or stale task authority');
      const owner = await read('owner');
      const signer = getAddress(authorization.signer);
      if (signer !== getAddress(owner) && (task[9] || signer !== getAddress(task[6]))) throw new Error('Worker no longer authorized');
      if (!await verifyMessage({ address: signer, message: accessMessage(input, identity, authorization), signature: authorization.signature })) throw new Error('Invalid task access signature');
    },
    async inspect(input, identity) {
      await validateScope(input);
      const task = await read('tasks', [input.taskId]);
      const op = await read('getOperation', [input.taskId, identity.operationId]);
      if (getAddress(task[7]) !== getAddress(merchant)) throw new Error('Task merchant mismatch');
      if (op.status === 0) return { state: 'none' };
      if (op.requestHash.toLowerCase() !== identity.requestHash.toLowerCase() || op.amount !== BigInt(input.amount)) throw new Error('Reservation does not match request');
      if (op.status === 2) return { state: 'settled', receipt: { chainId, treasury, taskId: input.taskId, operationId: identity.operationId, amount: op.amount.toString(), attempt: op.attempt.toString() } };
      if (op.status === 3 || op.deadline <= (await publicClient.getBlock()).timestamp) return { state: 'expired' };
      return { state: 'reserved', attempt: op.attempt };
    },
    async settle(input, identity, observed) {
      if (observed.state !== 'reserved') throw new Error('No payable reservation');
      const hash = await gasWallet.writeContract({ address: treasury, abi: treasuryAbi, functionName: 'executeTransfer', args: [treasury, token, merchant, BigInt(input.amount), encodeAuthorization(input.taskId, identity.operationId, observed.attempt)] });
      return { transactionId: hash };
    },
  };
}
