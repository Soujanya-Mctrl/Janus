import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { baseUnits } from '../../shared/protocol.mjs';

// This local journal also contains safe-integer timestamps and basis points;
// the financial wire protocol intentionally accepts only string amounts.
function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  throw new Error('Expected plain JSON with safe-integer numeric metadata');
}

const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const fail = message => { throw new Error(message); };
const positive = value => baseUnits(value) > 0n || fail('Expected positive base units');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const bps = value => integer(value) && value <= 10000;
const ceil = (a, b) => (a + b - 1n) / b;

export function validatePolicy(policy) {
  if (policy?.mode !== 'paper' || !Array.isArray(policy.assets) || !policy.assets.length
    || new Set(policy.assets).size !== policy.assets.length
    || policy.assets.some(asset => typeof asset !== 'string' || !/^[A-Z][A-Z0-9]{0,15}$/.test(asset))
    || !bps(policy.maxSlippageBps) || !bps(policy.maxFeeBps)
    || !integer(policy.maxQuoteAgeMs) || !policy.maxQuoteAgeMs
    || !integer(policy.maxTrades) || !policy.maxTrades) fail('Invalid paper policy');
  for (const field of ['initialCash', 'maxOrder', 'maxPositionCost', 'maxTotalSpend']) positive(policy[field]);
  if (baseUnits(policy.maxTotalSpend) > baseUnits(policy.initialCash)) fail('Spend cap exceeds cash');
  baseUnits(policy.operatingCostCap ?? '0');
}

function assessAdjustment(policy, state, kind, amount) {
  positive(amount);
  if (!['transfer-in', 'transfer-out', 'operating-cost'].includes(kind)) fail('Invalid cash adjustment');
  const n = baseUnits(amount);
  if (kind === 'transfer-in') return { approved: true };
  if (n > baseUnits(state.cash)) return { approved: false, reason: 'Insufficient available cash' };
  if (kind === 'operating-cost') {
    if (n > BigInt(state.realizedPnl) - baseUnits(state.profitConsumed)) return { approved: false, reason: 'Insufficient unspent realized profit' };
    if (n + baseUnits(state.operatingCostsPaid) > baseUnits(policy.operatingCostCap ?? '0')) return { approved: false, reason: 'Operating cost cap exceeded' };
  }
  return { approved: true };
}

function applyAdjustment(state, operation) {
  const n = baseUnits(operation.amount);
  if (operation.kind === 'transfer-in') {
    state.cash = (baseUnits(state.cash) + n).toString();
    state.transferredIn = (baseUnits(state.transferredIn) + n).toString();
  } else {
    state.cash = (baseUnits(state.cash) - n).toString();
    if (operation.kind === 'operating-cost') {
      state.operatingCostsPaid = (baseUnits(state.operatingCostsPaid) + n).toString();
      state.profitConsumed = (baseUnits(state.profitConsumed) + n).toString();
    } else {
      state.transferredOut = (baseUnits(state.transferredOut) + n).toString();
      // Outgoing cash consumes available profit first, so transferred earnings
      // cannot be claimed again for operating costs after receiving fresh capital.
      const remaining = BigInt(state.realizedPnl) - baseUnits(state.profitConsumed);
      const used = remaining <= 0n ? 0n : remaining < n ? remaining : n;
      state.profitConsumed = (baseUnits(state.profitConsumed) + used).toString();
    }
  }
}

// All cash/price values are integer micro-USD. Quantity uses six decimal places.
export function assessTrade(policy, portfolio, proposal, quote, now) {
  validatePolicy(policy);
  if (!integer(now) || !proposal || !['buy', 'sell', 'hold'].includes(proposal.action)
    || !policy.assets.includes(proposal.asset) || typeof proposal.reason !== 'string'
    || !proposal.reason.trim() || proposal.reason.length > 2000) fail('Invalid research proposal');
  if (proposal.action === 'hold') return { approved: false, reason: 'Research chose hold' };
  const reject = reason => ({ approved: false, reason });
  positive(proposal.quantity);
  if (!quote || quote.asset !== proposal.asset || !integer(quote.timestamp)
    || quote.timestamp > now || now - quote.timestamp > policy.maxQuoteAgeMs) return reject('Stale or invalid quote');
  positive(quote.midPrice); positive(quote.executionPrice);
  if (!bps(quote.feeBps) || quote.feeBps > policy.maxFeeBps) return reject('Fee limit exceeded');
  const mid = baseUnits(quote.midPrice), price = baseUnits(quote.executionPrice);
  const adverse = proposal.action === 'buy' ? price - mid : mid - price;
  if (adverse > 0n && adverse * 10000n > mid * BigInt(policy.maxSlippageBps)) return reject('Slippage limit exceeded');
  if (portfolio.fills.length >= policy.maxTrades) return reject('Trade count limit reached');
  const quantity = baseUnits(proposal.quantity);
  const product = quantity * price;
  const notional = proposal.action === 'buy' ? ceil(product, 1000000n) : product / 1000000n;
  if (!notional) return reject('Order rounds to zero');
  const fee = ceil(notional * BigInt(quote.feeBps), 10000n);
  if (notional + fee > baseUnits(policy.maxOrder)) return reject('Order limit exceeded');
  const position = portfolio.positions[proposal.asset] ?? { quantity: '0', cost: '0' };
  if (proposal.action === 'buy') {
    const debit = notional + fee;
    if (debit > baseUnits(portfolio.cash)) return reject('Insufficient paper cash');
    if (baseUnits(portfolio.totalSpent) + debit > baseUnits(policy.maxTotalSpend)) return reject('Total spend limit exceeded');
    if (baseUnits(position.cost) + debit > baseUnits(policy.maxPositionCost)) return reject('Position cost limit exceeded');
  } else {
    if (quantity > baseUnits(position.quantity)) return reject('Short selling is disabled');
    if (fee >= notional) return reject('Fee consumes proceeds');
  }
  return { approved: true, notional: notional.toString(), fee: fee.toString() };
}

function applyFill(state, intent, decision) {
  const { proposal, quote, operationId } = intent;
  const quantity = baseUnits(proposal.quantity), notional = baseUnits(decision.notional), fee = baseUnits(decision.fee);
  const position = state.positions[proposal.asset] ?? { quantity: '0', cost: '0' };
  let realizedPnl = 0n;
  if (proposal.action === 'buy') {
    const debit = notional + fee;
    state.cash = (baseUnits(state.cash) - debit).toString();
    state.totalSpent = (baseUnits(state.totalSpent) + debit).toString();
    position.quantity = (baseUnits(position.quantity) + quantity).toString();
    position.cost = (baseUnits(position.cost) + debit).toString();
  } else {
    const removedCost = baseUnits(position.cost) * quantity / baseUnits(position.quantity);
    realizedPnl = notional - fee - removedCost;
    state.cash = (baseUnits(state.cash) + notional - fee).toString();
    position.quantity = (baseUnits(position.quantity) - quantity).toString();
    position.cost = (baseUnits(position.cost) - removedCost).toString();
  }
  state.positions[proposal.asset] = position;
  state.realizedPnl = (BigInt(state.realizedPnl) + realizedPnl).toString();
  state.fills.push({ operationId, action: proposal.action, asset: proposal.asset, quantity: proposal.quantity,
    executionPrice: quote.executionPrice, notional: decision.notional, fee: decision.fee, realizedPnl: realizedPnl.toString(), simulated: true });
}

export function createPaperTrader({ directory, policy, now = Date.now }) {
  validatePolicy(policy);
  // Pin a copy so callers cannot mutate policy after identity validation.
  policy = structuredClone(policy);
  const policyHash = hash(policy), file = path.join(directory, 'portfolio.json');
  const fresh = () => ({ version: 2, mode: 'paper', policyHash, cash: policy.initialCash, totalSpent: '0',
    transferredIn: '0', transferredOut: '0', operatingCostsPaid: '0', profitConsumed: '0',
    realizedPnl: '0', positions: {}, fills: [], operations: [] });
  const save = async state => {
    const handle = await fs.open(file + '.tmp', 'w', 0o600);
    try { await handle.writeFile(JSON.stringify({ state, checksum: hash(state) }) + '\n'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(file + '.tmp', file);
  };
  const load = async () => {
    let envelope;
    try { envelope = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fresh(); throw error; }
    const state = envelope.state;
    if (!state || envelope.checksum !== hash(state) || state.policyHash !== policyHash || state.version !== 2
      || state.mode !== 'paper' || !Array.isArray(state.operations)) fail('Corrupt or incompatible paper journal');
    // Reconstruct accounting from accepted operations rather than trusting saved totals.
    const replay = fresh(), ids = new Set();
    for (const operation of state.operations) {
      if (!operation || typeof operation.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(operation.operationId)
        || ids.has(operation.operationId) || !['executed', 'completed', 'rejected'].includes(operation.status)) fail('Invalid operation history');
      ids.add(operation.operationId);
      if (operation.kind) {
        if (!['completed', 'rejected'].includes(operation.status)
          || operation.inputHash !== hash({ kind: operation.kind, amount: operation.amount })) fail('Invalid cash adjustment identity');
        const decision = assessAdjustment(policy, replay, operation.kind, operation.amount);
        if (canonicalJson(decision) !== canonicalJson(operation.decision)
          || decision.approved !== (operation.status === 'completed')) fail('Invalid cash adjustment history');
        if (decision.approved) applyAdjustment(replay, operation);
        replay.operations.push(operation);
        continue;
      }
      if (operation.inputHash !== hash({ proposal: operation.proposal, quote: operation.quote })) fail('Invalid operation identity');
      const decision = assessTrade(policy, replay, operation.proposal, operation.quote, operation.assessedAt);
      if (canonicalJson(decision) !== canonicalJson(operation.decision)
        || decision.approved === (operation.status === 'rejected')) fail('Invalid risk history');
      if (decision.approved) applyFill(replay, operation, decision);
      replay.operations.push(operation);
    }
    if (canonicalJson(replay) !== canonicalJson(state)) fail('Paper accounting mismatch');
    return state;
  };
  const locked = async action => {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = await fs.open(file + '.lock', 'wx', 0o600).catch(error => {
      if (error.code === 'EEXIST') fail('Paper trader busy; reconcile stale process lock before restart');
      throw error;
    });
    try { return await action(); }
    finally { await lock.close(); await fs.unlink(file + '.lock'); }
  };
  return {
    inspect: () => locked(load),
    adjust({ operationId, kind, amount }) {
      return locked(async () => {
        if (typeof operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(operationId)) fail('Invalid operation ID');
        const inputHash = hash({ kind, amount }), state = await load();
        const existing = state.operations.find(item => item.operationId === operationId);
        if (existing) {
          if (existing.inputHash !== inputHash) fail('Operation ID reused with different inputs');
          return { replayed: true, operation: existing, portfolio: state };
        }
        if (state.operations.some(item => item.status === 'executed')) fail('Reconcile pending trade before moving cash');
        const decision = assessAdjustment(policy, state, kind, amount);
        const operation = { operationId, kind, amount, inputHash, decision, status: decision.approved ? 'completed' : 'rejected' };
        if (decision.approved) applyAdjustment(state, operation);
        state.operations.push(operation); await save(state);
        return { replayed: false, operation, portfolio: state };
      });
    },
    execute({ operationId, proposal, quote, afterFill = async () => {} }) {
      return locked(async () => {
        if (typeof operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(operationId)) fail('Invalid operation ID');
        // Snapshot untrusted inputs before awaiting persistence or hooks.
        const input = structuredClone({ proposal, quote }), inputHash = hash(input);
        const state = await load(), existing = state.operations.find(item => item.operationId === operationId);
        if (existing) {
          if (existing.inputHash !== inputHash) fail('Operation ID reused with different inputs');
          if (existing.status === 'executed') { existing.status = 'completed'; await save(state); }
          return { replayed: true, operation: existing, portfolio: state };
        }
        // Do not start another operation while a prior fill awaits acknowledgement.
        if (state.operations.some(item => item.status === 'executed')) fail('Resume pending operation before new trades');
        const assessedAt = now(), decision = assessTrade(policy, state, input.proposal, input.quote, assessedAt);
        const operation = { operationId, inputHash, ...input, assessedAt, decision, status: decision.approved ? 'executed' : 'rejected' };
        if (decision.approved) applyFill(state, operation, decision);
        state.operations.push(operation);
        await save(state); // Fill and balances commit together, before acknowledgement.
        if (decision.approved) {
          await afterFill(structuredClone(operation));
          operation.status = 'completed'; await save(state);
        }
        return { replayed: false, operation, portfolio: state };
      });
    },
  };
}
