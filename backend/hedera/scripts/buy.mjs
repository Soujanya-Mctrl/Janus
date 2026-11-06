import fs from 'node:fs';
import { keccak256, stringToHex, encodeAbiParameters } from 'viem';
import { assertTestnet, loadDeployment, artifact, publicClient, PRICE, saveEvidence, safeError } from '../lib/config.mjs';
import { sdkClient, execute } from '../lib/sdk.mjs';

let client;
try {
  await assertTestnet();
  const d = loadDeployment();
  const initial = await fetch('http://127.0.0.1:4022/premium', { signal: AbortSignal.timeout(10_000) });
  if (initial.status !== 402) throw new Error('Expected an HTTP 402 payment challenge');
  const challenge = JSON.parse(Buffer.from(initial.headers.get('payment-required') || '', 'base64').toString('utf8'));
  const accepted = challenge.accepts?.[0];
  if (challenge.x402Version !== 2 || accepted?.network !== 'hedera:testnet' || accepted?.asset !== d.tokenId || accepted?.amount !== PRICE.toString() || accepted?.payTo !== d.merchant.id || accepted?.extra?.assetTransferMethod !== 'transferExecutor' || accepted?.extra?.executors?.[0] !== d.contractId) throw new Error('Unexpected merchant quote; refusing payment');
  const operation = keccak256(stringToHex(`relaybudget-live-premium-v1:${d.vault}`));
  const paymentPayload = { x402Version: 2, resource: challenge.resource, accepted, payload: { payer: d.contractId, executor: d.contractId, authorization: encodeAbiParameters([{ type: 'bytes32' }], [operation]) } };
  const state = await publicClient.readContract({ address: d.vault, abi: artifact().abi, functionName: 'payments', args: [operation] });
  if (Number(state[4]) === 0) {
    const worker = await sdkClient('WORKER'); client = worker.client;
    const epoch = await publicClient.readContract({ address: d.vault, abi: artifact().abi, functionName: 'epoch' });
    const reserved = await execute(client, d.contractId, 'reserve', [operation, keccak256(stringToHex('GET:/premium:v1')), PRICE, epoch, 120n]);
    await saveEvidence('client-intent.json', { network: 'hedera:testnet', operation, paymentPayload, reservationTransaction: reserved.transactionId });
    console.log(`Reserved 0.02 testnet USDC: ${reserved.transactionId}`);
  } else if (Number(state[4]) !== 1) {
    throw new Error('Operation already settled or expired. Inspect the saved journal; do not create another purchase to hide an ambiguous result.');
  }
  const paid = await fetch('http://127.0.0.1:4022/premium', { headers: { 'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(paymentPayload)).toString('base64') }, signal: AbortSignal.timeout(120_000) });
  const body = await paid.json();
  await saveEvidence('paid-response.json', { receivedAt: new Date().toISOString(), status: paid.status, body });
  if (!paid.ok || !body.settlement?.success) throw new Error(`Payment is not confirmed: ${body.error || 'unknown'}. Inspect evidence before retrying.`);
  console.log(`Paid endpoint returned HTTP ${paid.status}.`);
  console.log(`Confirmed Hedera transaction: ${body.settlement.transaction}`);
  console.log(`https://hashscan.io/testnet/transaction/${body.settlement.transaction}`);
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
finally { client?.close(); }
