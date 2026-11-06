import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadDeployment, publicClient, artifact, TOKEN, assertTestnet, saveEvidence, safeError } from '../lib/config.mjs';

try {
  await assertTestnet();
  const d = loadDeployment(); const abi = artifact().abi;
  const state = {};
  for (const name of ['deposited', 'available', 'reserved', 'spent', 'returned', 'cancelled']) state[name] = await publicClient.readContract({ address: d.vault, abi, functionName: name });
  assert.equal(state.deposited, 100_000n); assert.equal(state.spent, 20_000n); assert.equal(state.returned, 80_000n);
  assert.equal(state.available, 0n); assert.equal(state.reserved, 0n); assert.equal(state.cancelled, true);
  const balance = await publicClient.readContract({ address: TOKEN, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [d.vault] });
  assert.equal(balance, 0n);
  const merchantReachableNow = await fetch('http://127.0.0.1:4022/supported', { signal: AbortSignal.timeout(1_000) }).then(() => true, () => false);
  const recovery = JSON.parse(fs.readFileSync(new URL('../evidence/recovery.json', import.meta.url), 'utf8'));
  await saveEvidence('final-state.json', { network: 'hedera:testnet', checkedAt: new Date().toISOString(), status: 'passed', state, vaultTokenBalance: balance, merchantReachableNow, merchantReachableAtWithdrawal: recovery.merchantReachableAtRecovery, limitation: 'Withdrawal used direct owner calls; the merchant was still reachable at withdrawal. A backend-offline withdrawal was not demonstrated in this run.' });
  console.log('Final live state verified: 0.02 USDC spent, 0.08 recovered, vault empty and cancelled.');
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
