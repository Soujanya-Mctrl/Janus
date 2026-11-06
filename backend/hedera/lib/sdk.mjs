import { Client, PrivateKey, Hbar, ContractExecuteTransaction, TransactionRecordQuery } from '@hiero-ledger/sdk';
import { hexToBytes, encodeFunctionData } from 'viem';
import { account, role, artifact } from './config.mjs';

export async function sdkClient(name = 'OWNER') {
  const signer = role(name);
  const info = await account(signer.address);
  const client = Client.forTestnet();
  client.setMaxAttempts(3);
  client.setGrpcDeadline(10_000);
  client.setRequestTimeout(35_000);
  client.setDefaultRegenerateTransactionId(false);
  client.setOperator(info.id, PrivateKey.fromStringECDSA(signer.key.slice(2)));
  client.setDefaultMaxTransactionFee(new Hbar(2));
  client.setDefaultMaxQueryPayment(new Hbar(1));
  return { client, signer, id: info.id };
}
export async function execute(client, contractId, functionName, args, gas = 500_000, abi = artifact().abi) {
  const data = encodeFunctionData({ abi, functionName, args });
  const response = await new ContractExecuteTransaction().setContractId(contractId)
    .setGas(gas).setFunctionParameters(hexToBytes(data)).setMaxTransactionFee(new Hbar(2)).execute(client);
  const receipt = await response.getReceipt(client);
  if (receipt.status.toString() !== 'SUCCESS') throw new Error('Contract transaction failed');
  return { response, transactionId: response.transactionId.toString() };
}
export async function consensusRecord(client, transactionId) {
  return new TransactionRecordQuery().setTransactionId(transactionId).setIncludeChildren(true).execute(client);
}
