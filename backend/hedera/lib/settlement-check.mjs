// Pure consensus-effect validation for the deliberately restricted USDC route.
// No receipt status, simulation result or balance snapshot can replace this check.
export function checkSettlement(record, expected) {
  const reject = code => { const error = new Error(code); error.code = code; throw error; };
  if (record.status !== 'SUCCESS') reject('settlement_status_not_success');
  const amount = BigInt(expected.amount);
  const fee = BigInt(record.feeTinybars);
  if (amount <= 0n || fee < 0n || expected.payer === expected.payTo || expected.payTo === expected.feePayer) reject('settlement_check_failed');
  const token = new Map();
  const hbar = new Map();
  const add = (map, key, value) => map.set(key, (map.get(key) ?? 0n) + BigInt(value));
  for (const item of record.tokenTransfers) {
    if (item.tokenId !== expected.tokenId && BigInt(item.amount) !== 0n) reject('settlement_unexpected_transfer');
    if (item.tokenId === expected.tokenId) add(token, item.accountId, item.amount);
  }
  for (const item of record.hbarTransfers) add(hbar, item.accountId, item.amount);
  if (record.nftTransfers.length) reject('settlement_unexpected_transfer');
  if ((token.get(expected.payTo) ?? 0n) !== amount) reject('settlement_payee_credit_mismatch');
  if ((token.get(expected.payer) ?? 0n) !== -amount) reject('settlement_payer_debit_mismatch');
  for (const [id, delta] of token) {
    if (delta !== 0n && id !== expected.payer && id !== expected.payTo) reject('settlement_unexpected_transfer');
  }
  if ((hbar.get(expected.feePayer) ?? 0n) !== -fee) reject('settlement_fee_payer_debit_mismatch');
  let credits = 0n;
  for (const [id, delta] of hbar) {
    if (delta < 0n && id !== expected.feePayer) reject('settlement_unexpected_debit');
    if (delta > 0n) credits += delta;
  }
  if (credits !== fee) reject('settlement_fee_payer_debit_mismatch');
  // Inspect transfer logs as well as native HTS lists. This catches non-HTS
  // movements from controlled accounts even when no native transfer list exists.
  const controlled = new Set(expected.controlledAddresses.map(x => x.toLowerCase()));
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  for (const log of record.logs) {
    if (log.topics?.[0]?.toLowerCase() !== transferTopic) continue;
    if (log.topics.length === 4) reject('settlement_unexpected_transfer');
    if (log.topics.length !== 3) reject('settlement_check_failed');
    const from = `0x${log.topics[1].slice(-40)}`.toLowerCase();
    if (controlled.has(from)) reject('settlement_unexpected_transfer');
  }
  return { verified: true, amount: amount.toString(), feeTinybars: fee.toString(), tokenNet: Object.fromEntries([...token].map(([k, v]) => [k, v.toString()])), hbarNet: Object.fromEntries([...hbar].map(([k, v]) => [k, v.toString()])) };
}

export function normalizeSdkRecord(record) {
  const flatten = r => [r, ...(r.children ?? []).flatMap(flatten)];
  const records = flatten(record);
  return {
    status: record.receipt.status.toString(),
    feeTinybars: record.transactionFee.toTinybars().toString(),
    transactionId: record.transactionId.toString(),
    consensusTimestamp: record.consensusTimestamp.toString(),
    childRecordCount: records.length - 1,
    tokenTransfers: records.flatMap(r => r.tokenTransfersList.map(t => ({ tokenId: t.tokenId.toString(), accountId: t.accountId.toString(), amount: t.amount.toString() }))),
    hbarTransfers: records.flatMap(r => r.transfers.map(t => ({ accountId: t.accountId.toString(), amount: t.amount.toTinybars().toString() }))),
    nftTransfers: records.flatMap(r => r.nftTransfers._toProtobuf().flatMap(t => t.nftTransfers ?? [])),
    logs: records.flatMap(r => (r.contractFunctionResult?.logs ?? []).map(log => ({ contractId: log.contractId.toString(), topics: log.topics.map(t => `0x${Buffer.from(t).toString('hex')}`), data: `0x${Buffer.from(log.data).toString('hex')}` }))),
  };
}
