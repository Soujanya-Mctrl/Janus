import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { baseUnits } from '../../shared/protocol.mjs';

const checksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// This coordinator is used only by the orchestrator, never by bot workers.
// Intent precedes debit; debit and credit have independent idempotency keys.
export function createPaperFinance({ directory, traders, allowedTransfers }) {
  allowedTransfers = structuredClone(allowedTransfers);
  if (!Array.isArray(allowedTransfers) || new Set(allowedTransfers.map(item => item.id)).size !== allowedTransfers.length) throw new Error('Invalid transfer plan');
  for (const item of allowedTransfers) {
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id) || item.from === item.to || !traders.has(item.from)
      || !traders.has(item.to) || baseUnits(item.amount) === 0n) throw new Error('Invalid transfer allocation');
  }
  const file = path.join(directory, 'finance.json');
  const save = async state => {
    const handle = await fs.open(file + '.tmp', 'w', 0o600);
    try { await handle.writeFile(JSON.stringify({ state, checksum: checksum(state) }) + '\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(file + '.tmp', file);
  };
  const load = async () => {
    try {
      const envelope = JSON.parse(await fs.readFile(file, 'utf8')), state = envelope.state;
      if (!state || envelope.checksum !== checksum(state) || state.version !== 1
        || JSON.stringify(state.allowedTransfers) !== JSON.stringify(allowedTransfers)
        || !Array.isArray(state.transfers) || new Set(state.transfers.map(item => item.id)).size !== state.transfers.length
        || state.transfers.some(item => !allowedTransfers.some(rule => rule.id === item.id) || !['intent', 'completed', 'rejected'].includes(item.status))) throw new Error('Corrupt or incompatible finance journal');
      return state;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { version: 1, allowedTransfers, transfers: [] };
    }
  };
  const locked = async action => {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = await fs.open(file + '.lock', 'wx', 0o600).catch(error => {
      if (error.code === 'EEXIST') throw new Error('Finance coordinator busy; reconcile stale lock');
      throw error;
    });
    try { return await action(); }
    finally { await lock.close(); await fs.unlink(file + '.lock'); }
  };
  const execute = async (state, id, { afterDebit = async () => {}, afterCredit = async () => {} } = {}) => {
    const rule = allowedTransfers.find(item => item.id === id);
    if (!rule) throw new Error('Transfer not authorized in allocation plan');
    const source = traders.get(rule.from), target = traders.get(rule.to);
    let record = state.transfers.find(item => item.id === id);
    const replayed = Boolean(record);
    if (record?.status === 'completed') {
      for (const [trader, suffix, kind] of [[source, 'out', 'transfer-out'], [target, 'in', 'transfer-in']]) {
        const portfolio = await trader.inspect();
        if (!portfolio.operations.some(item => item.operationId === `finance-${id}-${suffix}` && item.kind === kind
          && item.amount === rule.amount && item.status === 'completed')) throw new Error('Completed transfer missing matching portfolio entry');
      }
      return { replayed: true, ...record, ...rule };
    }
    if (record?.status === 'rejected') return { replayed: true, ...record, ...rule };
    // Check both task journals before beginning a new transfer.
    for (const trader of [source, target]) {
      const portfolio = await trader.inspect();
      if (portfolio.operations.some(item => item.status === 'executed')) throw new Error('Reconcile pending trade before transferring funds');
    }
    if (!record) { record = { id, status: 'intent' }; state.transfers.push(record); await save(state); }
    const debit = await source.adjust({ operationId: `finance-${id}-out`, kind: 'transfer-out', amount: rule.amount });
    if (!debit.operation.decision.approved) {
      record.status = 'rejected'; record.reason = debit.operation.decision.reason; await save(state);
      return { replayed, ...record, ...rule };
    }
    await afterDebit(); // deterministic interruption leaves a recoverable intent
    const credit = await target.adjust({ operationId: `finance-${id}-in`, kind: 'transfer-in', amount: rule.amount });
    if (!credit.operation.decision.approved) throw new Error('Transfer credit requires reconciliation');
    await afterCredit();
    record.status = 'completed'; await save(state);
    return { replayed, ...record, ...rule };
  };
  return {
    inspect: () => locked(load),
    transfer: (id, hooks = {}) => locked(async () => execute(await load(), id, hooks)),
    recover: () => locked(async () => {
      const state = await load(), results = [];
      for (const record of state.transfers) {
        if (record.status === 'intent') results.push(await execute(state, record.id));
      }
      return results;
    }),
  };
}
