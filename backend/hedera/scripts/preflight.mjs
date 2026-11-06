import { assertTestnet, role, account, publicClient, TOKEN_ID, tokenMetadata, saveEvidence, safeError } from '../lib/config.mjs';

try {
  await assertTestnet();
  const owner = role('OWNER');
  const balance = await publicClient.getBalance({ address: owner.address });
  const info = await account(owner.address).catch(() => null);
  const token = await tokenMetadata();
  const report = { checkedAt: new Date().toISOString(), network: 'hedera:testnet', owner: owner.address, accountId: info?.id ?? null, balanceWeibar: balance.toString(), funded: balance > 0n, tokenId: TOKEN_ID, tokenSymbol: token.symbol, tokenDecimals: token.decimals, liveSettlement: false };
  await saveEvidence('preflight.json', report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.funded) { console.log('Waiting for test HBAR from https://portal.hedera.com/faucet'); process.exitCode = 2; }
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
