import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createPaperTrader, validatePolicy } from './engine.mjs';
import { baseUnits } from '../../shared/protocol.mjs';
import { createPaperFinance } from './finance.mjs';

const interrupted = 'Controlled interruption after durable fill';
class WorkerFailure extends Error {}

export function validateSimulation(plan) {
  if (plan?.mode !== 'paper' || !Array.isArray(plan.bots) || !plan.bots.length || plan.bots.length > 8
    || new Set(plan.bots.map(bot => bot.id)).size !== plan.bots.length) throw new Error('Invalid simulation plan');
  if (baseUnits(plan.totalBudget) === 0n) throw new Error('Invalid total budget');
  let allocated = 0n;
  for (const bot of plan.bots) {
    if (typeof bot.id !== 'string' || !/^[a-zA-Z0-9_-]{1,30}$/.test(bot.id)
      || typeof bot.responsibility !== 'string' || !bot.responsibility.trim()
      || !Array.isArray(bot.steps) || !bot.steps.length || bot.steps.length > 20) throw new Error('Invalid bot definition');
    validatePolicy(bot.policy);
    // Every task is independently funded; it cannot borrow from another bot.
    allocated += baseUnits(bot.policy.initialCash);
    for (const step of bot.steps) {
      if (!step || !step.proposal || !step.quote || !bot.policy.assets.includes(step.proposal.asset)
        || step.quote.asset !== step.proposal.asset) throw new Error('Invalid bot market assignment');
    }
  }
  if (allocated > baseUnits(plan.totalBudget)) throw new Error('Allocations exceed shared budget');
  for (const [key, fields] of [['failureTransfers', ['from', 'to']], ['operatingCosts', ['task']]]) {
    const rules = plan[key] ?? [];
    if (!Array.isArray(rules) || rules.length > 20 || new Set(rules.map(rule => rule.id)).size !== rules.length) throw new Error('Invalid finance rules');
    for (const rule of rules) {
      if (typeof rule.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(rule.id)
        || fields.some(field => !plan.bots.some(bot => bot.id === rule[field])) || baseUnits(rule.amount) === 0n
        || (key === 'failureTransfers' && rule.from === rule.to)) throw new Error('Invalid finance allocation');
    }
  }
  return allocated;
}

export async function runTradingSimulation({ directory, plan, now = Date.now, interruptTask = null, onEvent = () => {}, createWorker = (url, options) => new Worker(url, options) }) {
  plan = structuredClone(plan);
  const allocated = validateSimulation(plan);
  if (interruptTask !== null && !plan.bots.some(bot => bot.id === interruptTask)) throw new Error('Unknown interruption task');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(directory, 'orchestrator.lock');
  const lock = await fs.open(lockPath, 'wx', 0o600).catch(error => {
    if (error.code === 'EEXIST') throw new Error('Orchestrator busy; reconcile a stale process lock before restarting');
    throw error;
  });
  const workers = new Set(), assignments = new Map(), events = [];
  const emit = (type, details = {}) => {
    const event = { sequence: events.length + 1, type, ...details };
    events.push(event);
    // Display failures must not change execution/recovery decisions.
    try { onEvent(structuredClone(event)); } catch { /* isolated observer */ }
  };
  try {
    const manifest = path.join(directory, 'simulation.json'), content = JSON.stringify(plan) + '\n';
    try {
      const handle = await fs.open(manifest, 'wx', 0o600);
      try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await fs.readFile(manifest, 'utf8') !== content) throw new Error('Simulation plan changed; use the original plan or a new directory');
    }
    const traders = new Map(plan.bots.map(bot => [bot.id, createPaperTrader({ directory: path.join(directory, bot.id), policy: bot.policy, now })]));
    const finance = createPaperFinance({ directory, traders, allowedTransfers: plan.failureTransfers ?? [] });
    for (const transfer of await finance.recover()) emit('transfer-recovered', transfer);
    let readyCount = 0, releaseInitial;
    const initialBarrier = new Promise(resolve => { releaseInitial = resolve; });
    const initialReadiness = new Set();
    const markReady = id => {
      if (!initialReadiness.has(id)) { initialReadiness.add(id); readyCount += 1; }
      if (readyCount === plan.bots.length) releaseInitial();
    };
    let injected = false;
    const runWorker = (bot, epoch) => new Promise((resolve, reject) => {
      let worker;
      try { worker = createWorker(new URL('./bot-worker.mjs', import.meta.url), { workerData: { taskId: bot.id, steps: bot.steps, epoch } }); }
      catch (error) { markReady(bot.id); reject(new WorkerFailure('Worker could not start', { cause: error })); return; }
      workers.add(worker); assignments.set(bot.id, { worker, epoch });
      let settled = false, nextIndex = 0, busy = false, interrupting = false, commitInFlight = false, deferredFailure;
      const finish = async error => {
        if (settled) return;
        settled = true;
        markReady(bot.id); // release peers if startup failed
        await worker.terminate(); workers.delete(worker);
        if (error) reject(error); else resolve();
      };
      let timeout;
      const armTimeout = () => { timeout = setTimeout(() => { failWorker(new WorkerFailure('Simulation worker timed out')); }, 15000); };
      armTimeout();
      const finishAndClear = error => { clearTimeout(timeout); return finish(error); };
      const failWorker = error => {
        if (commitInFlight) { deferredFailure ??= error; return; }
        void finishAndClear(error);
      };
      worker.on('error', error => { failWorker(new WorkerFailure('Worker execution failed', { cause: error })); });
      worker.on('exit', code => { if (!settled && !interrupting) failWorker(new WorkerFailure(`Worker exited unexpectedly (${code})`)); });
      worker.on('message', message => {
        void (async () => {
          if (settled) return;
          const assignment = assignments.get(bot.id);
          if (assignment.worker !== worker || assignment.epoch !== message.epoch) throw new Error('Stale worker authority');
          if (message.type === 'ready') {
            emit('worker-ready', { bot: bot.id, epoch, threadId: worker.threadId });
            if (epoch === 1) { markReady(bot.id); await initialBarrier; }
            if (!settled) { emit('worker-started', { bot: bot.id, epoch }); worker.postMessage({ type: 'start' }); }
            return;
          }
          if (message.type === 'done') {
            if (busy || nextIndex !== bot.steps.length) throw new Error('Worker finished before completing its steps');
            emit('worker-completed', { bot: bot.id, epoch }); await finishAndClear(); return;
          }
          if (message.type !== 'proposal' || busy || message.index !== nextIndex) throw new Error('Invalid worker message order');
          busy = true;
          // Never release the run lock while an in-flight journal commit is still running.
          // The timer bounds worker responsiveness, not filesystem operations.
          clearTimeout(timeout);
          const step = bot.steps[nextIndex], operationId = `${bot.id}-step-${nextIndex + 1}`;
          // The parent controls quotes/allowed steps; workers cannot replace their market snapshot.
          if (JSON.stringify(message.proposal) !== JSON.stringify(step.proposal)) throw new Error('Worker changed its assigned simulation step');
          emit('proposal', { bot: bot.id, epoch, operationId, action: step.proposal.action });
          let result;
          commitInFlight = true;
          try { result = await traders.get(bot.id).execute({ operationId, proposal: message.proposal, quote: step.quote,
            afterFill: async () => {
              if (!injected && bot.id === interruptTask && epoch === 1) {
                injected = true;
                interrupting = true;
                emit('worker-interrupted', { bot: bot.id, epoch, operationId });
                await worker.terminate();
                throw new Error(interrupted);
              }
            } }); } finally { commitInFlight = false; }
          if (deferredFailure) throw deferredFailure;
          emit(result.replayed ? 'result-reused' : result.operation.decision.approved ? 'paper-fill' : 'risk-rejected', {
            bot: bot.id, epoch, operationId, reason: result.operation.decision.reason ?? 'Approved',
          });
          nextIndex += 1; busy = false;
          if (!settled) { armTimeout(); worker.postMessage({ type: 'result' }); }
        })().catch(failWorker);
      });
    });
    emit('budget-allocated', { totalBudget: plan.totalBudget, allocated: allocated.toString(), reserve: (baseUnits(plan.totalBudget) - allocated).toString() });
    // Worker threads run strategy loops concurrently. Each task has its own financial journal.
    const firstWave = plan.bots.map(bot => runWorker(bot, 1));
    const initial = await Promise.allSettled(firstWave);
    for (let index = 0; index < initial.length; index += 1) {
      const outcome = initial[index], bot = plan.bots[index];
      if (outcome.status === 'rejected') {
        // Worker availability failures get one replacement. Financial/storage
        // failures remain errors, never permission to place a fresh order.
        const demoFailure = bot.id === interruptTask && injected && outcome.reason.message === interrupted;
        if (!demoFailure && !(outcome.reason instanceof WorkerFailure)) throw outcome.reason;
        // The failed task has a known saved fill. Reconcile its acknowledgement
        // before moving free cash; its open position remains with the task.
        const pending = (await traders.get(bot.id).inspect()).operations.filter(operation => operation.status === 'executed');
        for (const operation of pending) {
          await traders.get(bot.id).execute({ operationId: operation.operationId, proposal: operation.proposal, quote: operation.quote });
          emit('pending-reconciled', { bot: bot.id, operationId: operation.operationId });
        }
        for (const rule of plan.failureTransfers ?? []) {
          if (rule.from === bot.id) {
            const transfer = await finance.transfer(rule.id);
            emit(transfer.status === 'completed' ? 'cash-reallocated' : 'reallocation-rejected', transfer);
          }
        }
        emit('worker-reassigned', { bot: bot.id, fromEpoch: 1, epoch: 2 });
        await runWorker(bot, 2);
      }
    }
    for (const cost of plan.operatingCosts ?? []) {
      const snapshots = await Promise.all([...traders.values()].map(trader => trader.inspect()));
      const payingPortfolio = snapshots[plan.bots.findIndex(bot => bot.id === cost.task)];
      const previous = payingPortfolio.operations.some(operation => operation.operationId === `cost-${cost.id}` && operation.kind === 'operating-cost');
      const poolProfit = snapshots.reduce((sum, portfolio) => sum + BigInt(portfolio.realizedPnl) - baseUnits(portfolio.operatingCostsPaid), 0n);
      if (!previous && baseUnits(cost.amount) > poolProfit) {
        emit('operating-cost-paused', { bot: cost.task, amount: cost.amount, operationId: `cost-${cost.id}`, reason: 'Shared pool has insufficient net realized profit' });
        continue;
      }
      const charge = await traders.get(cost.task).adjust({ operationId: `cost-${cost.id}`, kind: 'operating-cost', amount: cost.amount });
      emit(charge.replayed ? 'operating-cost-reused' : charge.operation.decision.approved ? 'operating-cost-paid' : 'operating-cost-paused', {
        bot: cost.task, amount: cost.amount, operationId: charge.operation.operationId,
        reason: charge.operation.decision.reason ?? 'Paid from realized profit',
      });
    }
    const portfolios = Object.fromEntries(await Promise.all(plan.bots.map(async bot => [bot.id, await traders.get(bot.id).inspect()])));
    const reserve = baseUnits(plan.totalBudget) - allocated;
    const cash = reserve + Object.values(portfolios).reduce((sum, portfolio) => sum + baseUnits(portfolio.cash), 0n);
    const positionCost = Object.values(portfolios).reduce((sum, portfolio) => sum + Object.values(portfolio.positions).reduce((n, position) => n + baseUnits(position.cost), 0n), 0n);
    const realizedPnl = Object.values(portfolios).reduce((sum, portfolio) => sum + BigInt(portfolio.realizedPnl), 0n);
    const operatingCostsPaid = Object.values(portfolios).reduce((sum, portfolio) => sum + baseUnits(portfolio.operatingCostsPaid), 0n);
    const transfers = (await finance.inspect()).transfers.map(record => ({ ...(plan.failureTransfers ?? []).find(rule => rule.id === record.id), ...record }));
    if (cash + positionCost + operatingCostsPaid !== baseUnits(plan.totalBudget) + realizedPnl) throw new Error('Simulation accounting invariant failed');
    return { mode: 'paper', strategy: 'scripted synthetic fixtures', events, portfolios, reserve: reserve.toString(),
      cash: cash.toString(), positionCost: positionCost.toString(), realizedPnl: realizedPnl.toString(),
      operatingCostsPaid: operatingCostsPaid.toString(), transfers, gasPaid: '0', networkCalls: 0 };
  } finally {
    await Promise.allSettled([...workers].map(worker => worker.terminate()));
    await lock.close(); await fs.unlink(lockPath);
  }
}
