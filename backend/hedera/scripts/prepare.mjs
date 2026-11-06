import { Hbar, AccountId, TransferTransaction, TokenAssociateTransaction } from '@hiero-ledger/sdk';
import { assertTestnet, role, account, mirror, TOKEN_ID, tokenMetadata, saveEvidence, safeError } from '../lib/config.mjs';
import { sdkClient } from '../lib/sdk.mjs';

let ownerClient;
try {
  await assertTestnet();
  await tokenMetadata();
  const owner = await sdkClient(); ownerClient = owner.client;
  const funding = [];
  for (const name of ['WORKER', 'MERCHANT']) {
    const address = role(name).address;
    const info = await account(address).catch(() => null);
    const current = BigInt(info?.info.balance?.balance ?? 0);
    const minimum = name === 'MERCHANT' ? 100_000_000n : 10_000_000n;
    const target = name === 'MERCHANT' ? 150_000_000n : 50_000_000n;
    if (!info || current < minimum) {
      const amount = target - current;
      const recipient = info?.id ?? AccountId.fromEvmAddress(0, 0, address);
      const result = await new TransferTransaction().addHbarTransfer(owner.id, Hbar.fromTinybars((-amount).toString()))
        .addHbarTransfer(recipient, Hbar.fromTinybars(amount.toString())).setMaxTransactionFee(new Hbar(1)).execute(owner.client);
      await result.getReceipt(owner.client);
      funding.push({ role: name, transactionId: result.transactionId.toString(), tinybars: amount.toString() });
      for (let attempt = 0; attempt < 15; attempt++) {
        if (await account(address).catch(() => null)) break;
        await new Promise(resolve => setTimeout(resolve, 1_000));
      }
    }
  }
  const associations = [];
  for (const name of ['OWNER', 'MERCHANT']) {
    const holder = await sdkClient(name);
    try {
      const relation = await mirror(`/api/v1/accounts/${holder.id}/tokens?token.id=${TOKEN_ID}`);
      if (!relation?.tokens?.some(t => t.token_id === TOKEN_ID)) {
        const result = await new TokenAssociateTransaction().setAccountId(holder.id).setTokenIds([TOKEN_ID]).setMaxTransactionFee(new Hbar(1)).execute(holder.client);
        await result.getReceipt(holder.client);
        associations.push({ role: name, transactionId: result.transactionId.toString() });
      }
    } finally { holder.client.close(); }
  }
  const accounts = {};
  for (const name of ['OWNER', 'WORKER', 'MERCHANT']) {
    const info = await account(role(name).address);
    accounts[name] = { id: info.id, address: info.address };
  }
  await saveEvidence('prepared.json', { network: 'hedera:testnet', preparedAt: new Date().toISOString(), tokenId: TOKEN_ID, accounts, funding, associations });
  console.log('Testnet accounts and USDC associations prepared.');
  console.log(`Request testnet USDC at https://faucet.circle.com for Hedera account ${accounts.OWNER.id}`);
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
finally { ownerClient?.close(); }
