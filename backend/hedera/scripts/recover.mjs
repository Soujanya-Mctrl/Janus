import { assertTestnet, loadDeployment, artifact, publicClient, saveEvidence, safeError } from '../lib/config.mjs';
import { sdkClient, execute } from '../lib/sdk.mjs';

let client;
try {
  await assertTestnet();
  const d = loadDeployment(); const owner = await sdkClient(); client = owner.client;
  const merchantReachableAtRecovery = await fetch('http://127.0.0.1:4022/supported', { signal: AbortSignal.timeout(1_000) }).then(() => true, () => false);
  await execute(client, d.contractId, 'cancel', []);
  const available = await publicClient.readContract({ address: d.vault, abi: artifact().abi, functionName: 'available' });
  if (!available) { console.log('No available principal; pending reservations remain protected.'); }
  else {
    const result = await execute(client, d.contractId, 'withdrawAvailable', [available]);
    await saveEvidence('recovery.json', { network: 'hedera:testnet', recoveredAt: new Date().toISOString(), amount: available.toString(), transactionId: result.transactionId, requiresMerchantOrFacilitator: false, merchantReachableAtRecovery });
    console.log(`Recovered ${available} USDC base units directly: ${result.transactionId}`);
  }
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
finally { client?.close(); }
