import { AccountAllowanceApproveTransaction, Hbar } from '@hiero-ledger/sdk';
import { assertTestnet, loadDeployment, artifact, publicClient, TOKEN, BUDGET, saveEvidence, safeError } from '../lib/config.mjs';
import { sdkClient, execute } from '../lib/sdk.mjs';

const erc20 = [ { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'value' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }] } ];
let client;
try {
  await assertTestnet();
  const d = loadDeployment(); const owner = await sdkClient(); client = owner.client;
  const deposited = await publicClient.readContract({ address: d.vault, abi: artifact().abi, functionName: 'deposited' });
  if (deposited === BUDGET) { console.log('Vault already funded; no additional deposit made.'); }
  else {
    if (deposited !== 0n) throw new Error('Unexpected partial deposit; reconcile before continuing');
    const balance = await publicClient.readContract({ address: TOKEN, abi: erc20, functionName: 'balanceOf', args: [owner.signer.address] });
    if (balance < BUDGET) throw new Error(`Request testnet USDC at https://faucet.circle.com for Hedera account ${owner.id}; at least 0.10 USDC is required.`);
    const approval = await new AccountAllowanceApproveTransaction().approveTokenAllowance(d.tokenId, owner.id, d.contractId, BUDGET.toString()).setMaxTransactionFee(new Hbar(1)).execute(client);
    await approval.getReceipt(client);
    const deposit = await execute(client, d.contractId, 'deposit', [BUDGET]);
    await saveEvidence('funded.json', { network: 'hedera:testnet', fundedAt: new Date().toISOString(), amount: BUDGET.toString(), approvalTransaction: approval.transactionId.toString(), depositTransaction: deposit.transactionId });
    console.log(`Funded vault with 0.10 testnet USDC: ${deposit.transactionId}`);
  }
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
finally { client?.close(); }
