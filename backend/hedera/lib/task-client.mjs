import { validateTreasury } from '../../../contracts/phase1/lib/recovery.mjs';
import { verifyMessage } from 'viem';
import { operationId, encodeAuthorization, baseUnits } from '../../../shared/protocol.mjs';
import { taskTreasuryAbi as abi } from './treasury.mjs';
import { accessMessage, quoteMessage, requestHash } from './task-merchant.mjs';

export async function buyTaskDataset({ publicClient, walletClient, endpoint, taskId, stepId, request, manifest }) {
 await validateTreasury(publicClient, manifest);
 if (request.treasury.toLowerCase() !== manifest.treasury.toLowerCase() || request.token.toLowerCase() !== manifest.token.toLowerCase()) throw new Error('Client deployment mismatch');
 if (await publicClient.getChainId() !== Number(request.chainId) || await walletClient.getChainId() !== Number(request.chainId)) throw new Error('Client chain mismatch');
 const opId = await operationId({ chainId: request.chainId, treasury: request.treasury, taskId, stepId });
 const read = (functionName, args) => publicClient.readContract({ address: request.treasury, abi, functionName, args });
 const op = await read('getOperation', [taskId, opId]);
 const attempt = Number(op.status) === 0 || Number(op.status) === 3 ? op.attempt + 1n : op.attempt;
 const authorization = encodeAuthorization(taskId, opId, attempt.toString());
 const post = async (route, value) => {
  const response = await fetch(new URL(route, endpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value), signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!response.ok) throw new Error('Merchant rejected request or payment requires reconciliation; do not blindly retry');
  return response.json();
 };
 const quote = await post('/quote', { authorization, request });
 const { signature, ...signed } = quote;
 if (quote.authorization !== authorization || quote.requestHash !== requestHash(request) || quote.merchant.toLowerCase() !== request.merchant.toLowerCase()
   || baseUnits(quote.expiresAt) <= BigInt(Math.floor(Date.now() / 1000)) || !await verifyMessage({ address: request.merchant, message: quoteMessage(signed), signature })) throw new Error('Invalid quoted payment');
 if (Number(op.status) === 0 || Number(op.status) === 3) {
  const task = await read('tasks', [taskId]);
  const hash = await walletClient.writeContract({ address: request.treasury, abi, functionName: 'reserve', args: [taskId, opId, requestHash(request), baseUnits(request.amount), task[8], attempt, 120n] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Reservation failed');
 } else if (op.requestHash !== requestHash(request) || op.amount !== baseUnits(request.amount)) throw new Error('Operation conflict');
 const expiresAt = String(Math.floor(Date.now() / 1000) + 120);
 const principal = { address: walletClient.account.address, expiresAt, signature: await walletClient.signMessage({ message: accessMessage(authorization, request, expiresAt) }) };
 return post('/purchase', { quote, authorization, request, principal });
}
