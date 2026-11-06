import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadDeployment, publicClient, artifact, saveEvidence, assertTestnet, safeError } from '../lib/config.mjs';

try {
  await assertTestnet();
  const d = loadDeployment();
  const intent = JSON.parse(fs.readFileSync(new URL('../evidence/client-intent.json', import.meta.url), 'utf8'));
  const settlement = JSON.parse(fs.readFileSync(new URL('../evidence/live-settlement.json', import.meta.url), 'utf8'));
  const checks = [];
  const challengeResponse = await fetch('http://127.0.0.1:4022/premium');
  assert.equal(challengeResponse.status, 402); checks.push('Unpaid request returns HTTP 402');
  const challenge = await challengeResponse.json();
  const post = async (path, body) => (await fetch(`http://127.0.0.1:4022/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })).json();
  const changed = structuredClone(challenge.accepts[0]); changed.payTo = d.owner.id;
  const altered = await post('verify', { paymentPayload: intent.paymentPayload, paymentRequirements: changed });
  assert.equal(altered.isValid, false); assert.equal(altered.invalidReason, 'invalid_payment_requirements'); checks.push('Changed merchant quote rejected');
  const replay = await post('verify', { paymentPayload: intent.paymentPayload, paymentRequirements: challenge.accepts[0] });
  assert.equal(replay.isValid, false); assert.equal(replay.invalidReason, 'simulation_reverted'); checks.push('Consumed authorization rejected by live simulation');
  const cached = await post('settle', { paymentPayload: intent.paymentPayload, paymentRequirements: challenge.accepts[0] });
  assert.equal(cached.success, true); assert.equal(cached.transaction, settlement.result.transaction); checks.push('Repeated settlement returns original transaction, without resubmission');
  const values = {};
  for (const name of ['deposited', 'available', 'reserved', 'spent', 'returned']) values[name] = await publicClient.readContract({ address: d.vault, abi: artifact().abi, functionName: name });
  assert.equal(values.deposited, 100_000n); assert.equal(values.spent, 20_000n); assert.equal(values.available, 80_000n); assert.equal(values.reserved, 0n); assert.equal(values.returned, 0n);
  checks.push('Live vault accounts for exactly 0.02 spent and 0.08 available USDC');
  await saveEvidence('live-checks.json', { network: 'hedera:testnet', checkedAt: new Date().toISOString(), status: 'passed', checks, state: values, settlementTransaction: settlement.result.transaction });
  console.log(`${checks.length} live checks passed; no new payment submitted.`);
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
