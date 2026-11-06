import { TransferTransaction, Hbar } from '@hiero-ledger/sdk';
import { assertTestnet, account, role, saveEvidence, safeError } from '../lib/config.mjs';
import { sdkClient } from '../lib/sdk.mjs';

let client;
try {
  await assertTestnet();
  const owner = await account(role('OWNER').address);
  const worker = await account(role('WORKER').address);
  if (BigInt(owner.info.balance.balance) >= 300_000_000n) console.log('Owner has sufficient test HBAR reserve; no transfer made.');
  else {
    if (BigInt(worker.info.balance.balance) < 700_000_000n) throw new Error('Waiting for worker faucet funding before sharing gas reserve.');
    const signer = await sdkClient('WORKER'); client = signer.client;
    const response = await new TransferTransaction().addHbarTransfer(worker.id, new Hbar(-3)).addHbarTransfer(owner.id, new Hbar(3)).setMaxTransactionFee(new Hbar(1)).execute(client);
    await response.getReceipt(client);
    await saveEvidence('gas-refill.json', { network: 'hedera:testnet', transactionId: response.transactionId.toString(), from: worker.id, to: owner.id, tinybars: '300000000' });
    console.log('Shared 3 faucet test HBAR from worker to owner for facilitator and recovery fees.');
  }
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
finally { client?.close(); }
