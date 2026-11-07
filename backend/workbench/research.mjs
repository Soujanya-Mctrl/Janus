import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkbenchStore } from './store.mjs';
import { validateWorkbenchConfig } from './config.mjs';
import { callProvider } from './providers.mjs';
import { createPrivateJsonStore } from '../lib/private-json.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const terminal = new Set(['completed', 'failed', 'cancelled']);
export const accountDirectory = (root, user) => path.join(root, 'research', digest(user));
export function runDirectory(root, user, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID');
  return path.join(accountDirectory(root, user), id);
}
export async function atomic(file, value) {
  const root = path.dirname(path.dirname(path.dirname(file)));
  return createPrivateJsonStore(root, { domain: 'research-v1' }).write(file, value);
}
const privateRead = file => createPrivateJsonStore(path.dirname(path.dirname(path.dirname(file))), { domain: 'research-v1' }).read(file);
export const readRun = async (root, user, id) => privateRead(path.join(runDirectory(root, user, id), 'run.json'));
export async function listRuns(root, user) {
  let names;
  try { names = await fs.readdir(accountDirectory(root, user)); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const results = await Promise.all(names.filter(name => /^[a-f0-9-]{36}$/.test(name)).map(id => readRun(root, user, id)));
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createRun(root, user, { config, question, mode, confirmProviderBilling, interrupt = false, deployment = null, paid = false, discoveryMode = 'arkiv', confirmTaskSpending = false }) {
  config = validateWorkbenchConfig(config);
  config.agents = config.agents.filter(agent => !agent.archived);
  if (typeof question !== 'string' || question.trim().length < 10 || question.length > 6000) throw new Error('Enter a research question of 10–6000 characters');
  if (!['fixture', 'llm'].includes(mode)) throw new Error('Choose fixture or provider mode');
  if (mode === 'llm' && confirmProviderBilling !== true) throw new Error('Confirm separate provider billing');
  if (paid && (confirmTaskSpending !== true || deployment?.mode !== 'local' || !['local', 'arkiv'].includes(discoveryMode))) throw new Error('Confirm local task spending and choose a replacement directory');
  const vault = createWorkbenchStore(path.join(root, 'vault'));
  if (mode === 'llm') for (const agent of config.agents) {
    if (!agent.credentialId || !agent.model) throw new Error('Assign a credential and model to every active agent');
    await vault.credential(user, agent.credentialId);
  }
  const directory = accountDirectory(root, user);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = await fs.open(path.join(directory, 'create.lock'), 'wx', 0o600).catch(() => { throw new Error('Run creation busy; retry'); });
  try {
    const runs = await listRuns(root, user);
    if (runs.filter(run => !terminal.has(run.status)).length >= 2) throw new Error('Two runs already active; finish or cancel one');
    if (runs.length >= 100) throw new Error('Run retention limit reached; operator archival required');
    const run = { id: randomUUID(), version: 1, createdAt: new Date().toISOString(), question: question.trim(), mode,
      config, deployment, paid: paid === true, discoveryMode: paid ? discoveryMode : null, tasks: null,
      holdAfterPayment: paid && mode === 'fixture' && interrupt === true,
      interrupt: !paid && mode === 'fixture' && interrupt === true, status: 'queued', events: [], artifacts: {}, workers: {}, report: null };
    await atomic(path.join(runDirectory(root, user, run.id), 'run.json'), run);
    return run;
  } finally { await lock.close(); await fs.unlink(path.join(directory, 'create.lock')); }
}
export async function controlRun(root, user, id, action) {
  if (!['pause', 'resume', 'cancel'].includes(action)) throw new Error('Invalid run action');
  const run = await readRun(root, user, id);
  if (terminal.has(run.status)) throw new Error('Run already finished');
  if (action === 'resume' && !['paused', 'queued', 'waiting'].includes(run.status)) throw new Error('Resume is allowed only for paused, waiting or queued runs; uncertain submissions require reconciliation');
  const dir = runDirectory(root, user, id);
  await atomic(path.join(dir, 'control.json'), { action, at: new Date().toISOString() });
  // When no supervisor owns the run, cancellation is a local execution action only.
  if (action === 'cancel') {
    let locked;
    try { locked = await fs.open(path.join(dir, 'supervisor.lock'), 'wx', 0o600); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    if (locked) { try { run.status = 'cancelled'; await atomic(path.join(dir, 'run.json'), run); } finally { await locked.close(); await fs.unlink(path.join(dir, 'supervisor.lock')); } }
  }
  return run;
}

export async function interruptRunWorker(root, user, id, agentId) {
 const run = await readRun(root, user, id);
 const worker = run.workers[agentId];
 if (run.status !== 'running' || !run.config.agents.some(agent => agent.id === agentId && agent.id !== 'orchestrator') || !worker || !['running', 'holding'].includes(worker.status)) throw new Error('Worker is not running in this account');
 await atomic(path.join(runDirectory(root, user, id), `interrupt-${agentId}-${worker.attempt}.json`), { agentId, attempt: worker.attempt, requestedAt: new Date().toISOString() });
 return { requested: true, agentId, attempt: worker.attempt };
}

// Deleting research never deletes the separate financial checkpoint/journal.
export async function deleteRun(root, user, id) {
  const directory = runDirectory(root, user, id), account = accountDirectory(root, user);
  const accountLock = await fs.open(path.join(account, 'create.lock'), 'wx', 0o600).catch(() => { throw new Error('Account busy; retry deletion'); });
  let supervisorLock;
  try {
    supervisorLock = await fs.open(path.join(directory, 'supervisor.lock'), 'wx', 0o600).catch(() => { throw new Error('Run active or unresolved; reconcile before deletion'); });
    const run = await readRun(root, user, id);
    if (!['completed', 'cancelled'].includes(run.status)) throw new Error('Only completed or cancelled runs can be deleted; reconcile other outcomes first');
    const quarantine = path.join(account, '.deleting-' + id);
    // Keep the exclusive lock FILE in place, but close its Windows handle before
    // renaming the directory. New supervisors still fail open(..., 'wx').
    await supervisorLock.close();
    await fs.rename(directory, quarantine);
    supervisorLock = null;
    await fs.rm(quarantine, { recursive: true });
    return { deleted: id };
  } finally {
    if (supervisorLock) { await supervisorLock.close(); await fs.unlink(path.join(directory, 'supervisor.lock')); }
    await accountLock.close(); await fs.unlink(path.join(account, 'create.lock'));
  }
}

export async function executeResearch({ root, user, id, providerCall = callProvider, paidTools, paidToolsFactory, interruptAfterPaid = false }) {
  const directory = runDirectory(root, user, id), lockPath = path.join(directory, 'supervisor.lock');
  const lock = await fs.open(lockPath, 'wx', 0o600).catch(() => { throw new Error('Supervisor already active or stale lock; reconcile before retry'); });
  let run, queue = Promise.resolve();
  const children = new Set();
  const liveWorkers = new Map();
  let controlTimer, controlWork = Promise.resolve();
  try {
    run = await readRun(root, user, id);
    if (terminal.has(run.status) || run.status === 'reconciling') return run;
    const save = () => { queue = queue.then(() => atomic(path.join(directory, 'run.json'), run)); return queue; };
    const event = async (type, agentId, summary, extra = {}) => {
      run.events.push({ sequence: run.events.length + 1, at: new Date().toISOString(), type, agentId, summary, ...extra });
      if (run.events.length > 2000) throw new Error('Run event limit exceeded');
      await save();
    };
    const control = async () => {
      try { return (await privateRead(path.join(directory, 'control.json'))).action; } catch (e) { if (e.code === 'ENOENT') return 'resume'; throw e; }
    };
    const stopped = async () => ['pause', 'cancel'].includes(await control());
    delete run.error;
    if (run.paid && !paidTools) {
      run.status = 'funding'; await save();
      if (!paidToolsFactory) throw new Error('Trusted paid tools are required for this run');
      paidTools = await paidToolsFactory({ root, user, run, onActivity: event });
      run.tasks = paidTools.tasks; await save();
    }
    controlTimer = setInterval(() => {
      controlWork = controlWork.then(async () => {
        for (const [agentId, worker] of liveWorkers) {
          if (worker.interrupted || worker.child.exitCode !== null || !worker.child.connected) continue;
          let command;
          try { command = await privateRead(path.join(directory, `interrupt-${agentId}-${worker.attempt}.json`)); }
          catch (error) { if (error.code === 'ENOENT') continue; throw error; }
          if (command.agentId !== agentId || command.attempt !== worker.attempt) continue;
          worker.interrupted = true;
          await event('worker-interrupted', agentId, 'Interrupt command accepted; stopping the actual worker process.', { pid: worker.child.pid, attempt: worker.attempt });
          worker.child.kill();
        }
      }).catch(error => { run.status = 'reconciling'; run.error = error.message; for (const child of children) child.kill(); });
    }, 150);
    run.status = 'running'; await event('run-started', 'orchestrator', paidTools ? 'Janus supervisor started with authorized paid research tools.' : 'Janus supervisor started. Research only; no wallet or payment calls.');
    const vault = createWorkbenchStore(path.join(root, 'vault'));
    const infer = async (agent, step, prompt) => {
      if (run.artifacts[step]) { await event('artifact-reused', agent.id, 'Reused the saved response without another provider request.', { step }); return run.artifacts[step]; }
      if (await stopped()) throw new Error('DISPATCH_STOPPED');
      const allowedSteps = new Set(['plan', 'report', ...run.config.agents.filter(item => item.id !== 'orchestrator').map(item => 'research:' + item.id)]);
      if (!allowedSteps.has(step) || run.events.filter(item => item.type === 'provider-requested').length >= allowedSteps.size) throw new Error('Research provider-call limit reached; owner review required');
      const intent = path.join(directory, digest(step) + '.intent.json');
      try {
        const handle = await fs.open(intent, 'wx', 0o600);
        await handle.close();
        await atomic(intent, { step, agentId: agent.id, mode: run.mode, at: new Date().toISOString() });
      }
      catch (e) { if (e.code === 'EEXIST') { run.status = 'reconciling'; throw new Error('Prior inference outcome uncertain. Reconcile provider history before any retry.'); } throw e; }
      await event('provider-requested', agent.id, run.mode === 'fixture' ? 'Local research fixture requested; no provider billing.' : `Request submitted to the configured model.`, { step });
      let result;
      if (run.mode === 'fixture') {
        await new Promise(resolve => setTimeout(resolve, 250));
        result = { text: step === 'report' ? `Research fixture report: ${run.question}\n\n${Object.values(run.artifacts).map(item => item.text).join('\n\n')}` : `${agent.name}: ${agent.responsibility}\nQuestion: ${run.question}\n${paidTools ? prompt : 'Local fixture artifact; no external sources were fetched or purchased.'}`, provider: 'local-fixture', model: 'deterministic', requestId: null, usage: null };
      } else {
        // Resolve credentials at dispatch time, allowing revocation to stop future calls.
        const credential = await vault.credential(user, agent.credentialId);
        try { result = await providerCall({ credential, model: agent.model, prompt }); }
        catch (error) { run.status = 'reconciling'; throw error; }
      }
      run.artifacts[step] = { ...result, text: result.text.slice(0, 24000), agentId: agent.id, step, savedAt: new Date().toISOString() };
      await event('artifact-saved', agent.id, 'Response persisted as a checkpoint artifact.', { step, requestId: result.requestId });
      return run.artifacts[step];
    };
    const coordinator = run.config.agents.find(agent => agent.id === 'orchestrator');
    const plan = await infer(coordinator, 'plan', `Plan research for this question: ${run.question}\nRoles: ${JSON.stringify(run.config.agents.map(a => ({ name: a.name, responsibility: a.responsibility })))}\nUse only the supplied context; distinguish missing evidence from established facts.`);
    const workers = run.config.agents.filter(agent => agent.id !== 'orchestrator');
    const launch = agent => new Promise((resolve, reject) => {
      const attempt = (run.workers[agent.id]?.attempt || 0) + 1;
      run.workers[agent.id] = { status: 'starting', attempt, pid: null, heartbeat: null };
      const child = fork(fileURLToPath(new URL('./research-worker.mjs', import.meta.url)), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { PATH: process.env.PATH || '' }, execArgv: [] });
      children.add(child);
      const liveWorker = { child, attempt, interrupted: false }; liveWorkers.set(agent.id, liveWorker);
      let settled = false, inflight = Promise.resolve(), requestSeen = false;
      const finish = (error) => { if (settled) return; settled = true; children.delete(child); liveWorkers.delete(agent.id); child.kill(); error ? reject(error) : resolve(); };
      child.on('message', message => {
        if (message.type === 'heartbeat') {
          run.workers[agent.id].heartbeat = new Date().toISOString();
          void save().catch(finish);
          return;
        }
        if (message.type === 'request' && !requestSeen) {
          requestSeen = true;
          inflight = (async () => {
            if (await stopped()) return child.send({ type: 'stop' });
            run.workers[agent.id] = { ...run.workers[agent.id], status: 'running', pid: child.pid, heartbeat: new Date().toISOString() };
            await event('worker-started', agent.id, 'Independent worker process started.', { pid: child.pid, attempt });
            let purchased = [];
            if (paidTools) {
              purchased = await paidTools.acquire(agent.id, async (result, stepId, metadata) => {
                const reused = metadata?.reused || run.events.some(item => item.agentId === agent.id && item.transaction === result.receipt.transaction && ['tool-payment-confirmed', 'paid-result-reused'].includes(item.type));
                await event(reused ? 'paid-result-reused' : 'tool-payment-confirmed', agent.id, reused ? 'Paid result reused—no additional charge' : 'Paid research artifact confirmed.', { transaction: result.receipt.transaction, resultHash: result.resultHash, stepId });
                if (run.holdAfterPayment && agent.id === workers[0].id && attempt === 1 && !liveWorker.interrupted) {
                  run.workers[agent.id].status = 'holding';
                  await event('worker-awaiting-interrupt', agent.id, 'Payment confirmed. Use Interrupt worker to demonstrate recovery before checkpoint acknowledgement.');
                  while (child.connected && !liveWorker.interrupted && !await stopped()) await new Promise(resolve => setTimeout(resolve, 100));
                }
                if (liveWorker.interrupted || interruptAfterPaid && agent.id === workers[0].id && attempt === 1) {
                  await event('worker-interrupted', agent.id, 'Worker stopped after paid result, before checkpoint acknowledgement.');
                  const fault = new Error('PAID_WORKER_INTERRUPTED'); fault.code = 'PAID_WORKER_INTERRUPTED'; throw fault;
                }
              }).catch(error => { if (error.code === 'PAID_WORKER_INTERRUPTED') { child.kill(); return null; } run.status = 'reconciling'; throw error; });
              if (purchased === null) return;
              await event('paid-artifacts-ready', agent.id, 'Purchased artifacts loaded from durable task checkpoints.');
            }
            const artifact = await infer(agent, 'research:' + agent.id, `Question: ${run.question}\nResponsibility: ${agent.responsibility}\nCoordinator plan: ${plan.text}\nPurchased source material: ${JSON.stringify(purchased)}\nProduce concise findings based only on supplied material. State limitations and do not invent web access or citations.`);
            if (run.interrupt && agent.id === workers[0].id && attempt === 1) {
              await event('worker-interrupted', agent.id, 'Fixture interruption after checkpoint, before worker acknowledgement.');
              child.kill(); return;
            }
            if (child.connected) child.send({ type: 'result', text: artifact.text });
          })().catch(finish);
        }
        if (message.type === 'complete') {
          inflight.then(async () => { run.workers[agent.id].status = 'completed'; await event('worker-completed', agent.id, 'Research branch completed.'); finish(); }).catch(finish);
        }
      });
      const timeout = setTimeout(() => finish(new Error('Worker response timeout; reconcile before resuming')), paidTools ? 180000 : 65000);
      child.once('error', finish);
      child.once('exit', () => {
        clearTimeout(timeout);
        if (settled) return;
        inflight.then(async () => {
          if (settled) return;
          children.delete(child); liveWorkers.delete(agent.id); settled = true;
          await event('worker-exited', agent.id, 'Worker process exited; in-flight supervisor calls have settled.', { pid: child.pid, attempt });
          if (await stopped()) { run.workers[agent.id].status = 'paused'; await save(); resolve(); }
          else if (attempt < 2 && (run.artifacts['research:' + agent.id] || paidTools)) {
            if (paidTools) {
              run.workers[agent.id].status = 'discovering'; await save();
              try { await paidTools.replace(agent.id); }
              catch (error) { if (error.code === 'DISCOVERY_WAITING') run.workers[agent.id].status = 'waiting'; throw error; }
            }
            run.workers[agent.id].status = 'replacing';
            await event('worker-replaced', agent.id, paidTools ? 'Replacement authority confirmed on chain; resuming original paid operations.' : 'Replacement resumes the saved local research checkpoint. No on-chain assignment is implied.');
            launch(agent).then(resolve, reject);
          } else reject(new Error('Worker stopped; reconcile its saved checkpoint before retry'));
        }).catch(reject);
      });
      child.send({ type: 'start' });
    });
    // All branches settle before terminal state, so no provider call continues after failure is reported.
    const outcomes = await Promise.allSettled(workers.map(async agent => {
      if (run.workers[agent.id]?.status === 'completed') return;
      if (run.workers[agent.id]?.status === 'waiting' && paidTools) await paidTools.replace(agent.id);
      return launch(agent);
    }));
    const failed = outcomes.find(outcome => outcome.status === 'rejected');
    if (failed) throw failed.reason;
    if (!await stopped()) {
      const sources = workers.map(agent => ({ agent: agent.name, artifact: run.artifacts['research:' + agent.id]?.text }));
      run.report = await infer(coordinator, 'report', `Answer the research question: ${run.question}\nSynthesize these worker findings: ${JSON.stringify(sources)}\nDistinguish evidence, uncertainties and missing external sources. ${paidTools ? 'Purchased sources were supplied to workers; distinguish them from model knowledge.' : 'No tool purchase has occurred.'}`);
    }
    const action = await control();
    run.status = action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : 'completed';
    await event('run-' + run.status, 'orchestrator', 'Run ' + run.status + '.');
    return run;
  } catch (error) {
    if (run) {
      let action; try { action = (await privateRead(path.join(directory, 'control.json'))).action; } catch { /* no control */ }
      run.status = error.code === 'DISCOVERY_WAITING' ? 'waiting' : error.message === 'DISPATCH_STOPPED' ? action === 'cancel' ? 'cancelled' : 'paused' : run.status === 'reconciling' ? 'reconciling' : 'failed';
      run.error = error.message;
      await queue.catch(() => {});
      run.events.push({ sequence: run.events.length + 1, at: new Date().toISOString(), type: 'run-' + run.status, agentId: 'orchestrator', summary: error.message });
      await atomic(path.join(directory, 'run.json'), run);
    }
    return run;
  } finally { clearInterval(controlTimer); await controlWork; for (const child of children) child.kill(); await lock.close(); await fs.unlink(lockPath); }
}
