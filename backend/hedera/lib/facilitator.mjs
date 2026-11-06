import fs from 'node:fs';
import { ContractExecuteTransaction, Hbar, TransactionId } from '@hiero-ledger/sdk';
import { encodeFunctionData, hexToBytes, keccak256, stringToHex } from 'viem';
import { NETWORK, TOKEN_ID, TOKEN, PRICE, GAS, loadDeployment, artifact, account, tokenMetadata, mirror, saveEvidence, publicClient } from './config.mjs';
import { sdkClient, consensusRecord } from './sdk.mjs';
import { normalizeSdkRecord, checkSettlement } from './settlement-check.mjs';

export async function createFacilitator() {
  const deployment = loadDeployment();
  const code = await publicClient.getBytecode({ address: deployment.vault });
  if (!code || keccak256(code) !== deployment.runtimeCodeHash) throw new Error('Admitted executor runtime code differs from recorded deployment');
  const owner = await sdkClient();
  const abi = artifact().abi;
  const journalPath = new URL('../evidence/payment-journal.json', import.meta.url);
  const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : {};
  const inFlight = new Set();
  const requirements = { scheme: 'exact', network: NETWORK, amount: PRICE.toString(), asset: TOKEN_ID, payTo: deployment.merchant.id, maxTimeoutSeconds: 120,
    extra: { assetTransferMethod: 'transferExecutor', executors: [deployment.contractId] } };
  const supported = { kinds: [{ x402Version: 2, scheme: 'exact', network: NETWORK, extra: { assetTransferMethods: ['transferExecutor'], executors: [deployment.contractId] } }] };
  const fail = code => { const e = new Error(code); e.code = code; throw e; };
  const keyOf = payload => keccak256(stringToHex(JSON.stringify([NETWORK, payload.executor, payload.payer, payload.authorization.toLowerCase()])));
  const persist = () => saveEvidence('payment-journal.json', journal);

  function validateEnvelope(paymentPayload, paymentRequirements) {
    if (paymentPayload?.x402Version !== 2) fail('invalid_x402_version');
    const q = paymentRequirements;
    if (!q || q.network !== NETWORK || q.scheme !== 'exact' || q.asset !== TOKEN_ID || q.amount !== PRICE.toString() || q.payTo !== deployment.merchant.id || q.maxTimeoutSeconds !== 120) fail('invalid_payment_requirements');
    if (q.extra?.assetTransferMethod !== 'transferExecutor' || !Array.isArray(q.extra.executors) || q.extra.executors.length !== 1 || q.extra.executors[0] !== deployment.contractId) fail('invalid_exact_hedera_executor_not_admitted');
    const a = paymentPayload.accepted;
    if (!a || a.network !== q.network || a.scheme !== q.scheme || a.asset !== q.asset || a.amount !== q.amount || a.payTo !== q.payTo || a.maxTimeoutSeconds !== q.maxTimeoutSeconds || a.extra?.assetTransferMethod !== 'transferExecutor' || !Array.isArray(a.extra.executors) || a.extra.executors.length !== 1 || a.extra.executors[0] !== deployment.contractId) fail('invalid_payload');
    const p = paymentPayload.payload;
    if (!p || p.executor !== deployment.contractId || p.payer !== deployment.contractId || !/^0x(?:[0-9a-fA-F]{2}){1,4096}$/.test(p.authorization ?? '')) fail('invalid_payload');
    return p;
  }
  async function validate(paymentPayload, paymentRequirements) {
    const p = validateEnvelope(paymentPayload, paymentRequirements);
    const q = paymentRequirements;
    // Reload admission before every verification/submission. An omitted list never admits anything.
    const current = loadDeployment();
    if (current.contractId !== p.executor || current.vault !== deployment.vault) fail('invalid_exact_hedera_executor_not_admitted');
    await tokenMetadata();
    const [payer, payee] = await Promise.all([account(p.payer), account(q.payTo)]);
    const relations = await mirror(`/api/v1/accounts/${q.payTo}/tokens?token.id=${TOKEN_ID}`);
    const relation = relations?.tokens?.find(t => t.token_id === TOKEN_ID);
    if (!relation || relation.freeze_status === 'FROZEN') fail('invalid_payment_requirements');
    const args = [payer.address, TOKEN, payee.address, PRICE, p.authorization];
    const data = encodeFunctionData({ abi, functionName: 'executeTransfer', args });
    // Mirror contract-call supports transient read-write execution, including HTS.
    // Do not replace this with ContractCallLocalQuery (read-only HTS semantics).
    try {
      const simulated = await mirror('/api/v1/contracts/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: 'latest', from: owner.signer.address, to: deployment.vault, gas: GAS, estimate: false, data }) });
      if (!simulated || typeof simulated.result !== 'string') fail('simulation_reverted');
    } catch { fail('simulation_reverted'); }
    return { payload: p, args, data, key: keyOf(p) };
  }
  async function verify(paymentPayload, paymentRequirements) {
    try { const v = await validate(paymentPayload, paymentRequirements); return { isValid: true, payer: v.payload.payer }; }
    catch (e) { return { isValid: false, invalidReason: e.code || 'unexpected_verify_error' }; }
  }
  async function reconcile(entry) {
    try {
      const raw = await consensusRecord(owner.client, entry.transaction);
      const record = normalizeSdkRecord(raw);
      const effects = checkSettlement(record, { payer: deployment.contractId, payTo: deployment.merchant.id, feePayer: owner.id, tokenId: TOKEN_ID, amount: PRICE,
        controlledAddresses: [owner.signer.address, deployment.worker.address, deployment.merchant.address] });
      const result = { success: true, transaction: entry.transaction, network: NETWORK, payer: deployment.contractId };
      entry.status = 'settled'; entry.result = result; entry.record = record; entry.effects = effects;
      await persist();
      await saveEvidence('live-settlement.json', { network: NETWORK, verifiedAt: new Date().toISOString(), result, effects, record, hashscan: `https://hashscan.io/testnet/transaction/${entry.transaction}` });
      return result;
    } catch (error) {
      if (error.code?.startsWith('settlement_')) {
        entry.status = 'failed'; entry.result = { success: false, errorReason: error.code, transaction: entry.transaction, network: NETWORK, payer: deployment.contractId };
        await persist(); return entry.result;
      }
      return { success: false, errorReason: 'settlement_pending', transaction: entry.transaction, network: NETWORK, payer: deployment.contractId };
    }
  }
  async function settle(paymentPayload, paymentRequirements) {
    let raw;
    try { raw = validateEnvelope(paymentPayload, paymentRequirements); }
    catch (error) { return { success: false, errorReason: error.code || 'invalid_payload', network: NETWORK }; }
    const key = keyOf(raw);
    if (inFlight.has(key)) return { success: false, errorReason: 'settlement_pending', transaction: journal[key]?.transaction, network: NETWORK };
    inFlight.add(key);
    try {
      // Reconcile persisted ambiguous submissions before doing anything that might pay again.
      if (journal[key]) return journal[key].result ?? await reconcile(journal[key]);
      const verified = await validate(paymentPayload, paymentRequirements);
      const transactionId = TransactionId.generate(owner.id);
      const tx = new ContractExecuteTransaction().setContractId(deployment.contractId).setFunctionParameters(hexToBytes(verified.data)).setGas(GAS)
        .setTransactionId(transactionId).setMaxTransactionFee(new Hbar(2)).freezeWith(owner.client);
      const entry = { status: 'submitting', transaction: transactionId.toString(), createdAt: new Date().toISOString() };
      journal[key] = entry;
      await persist(); // Write intent before broadcast; never automatically create another tx ID.
      try { await tx.execute(owner.client); }
      catch { return { success: false, errorReason: 'settlement_pending', transaction: entry.transaction, network: NETWORK, payer: deployment.contractId }; }
      return await reconcile(entry);
    } catch (error) { return { success: false, errorReason: error.code || 'unexpected_settle_error', network: NETWORK }; }
    finally { inFlight.delete(key); }
  }
  return { supported, requirements, verify, settle, close: () => owner.client.close() };
}
