'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Plus, ArrowRight, KeyRound, X, Play, Pause, RefreshCw, Archive, Activity, GitBranch } from 'lucide-react';
import { useRelayAuth } from '@/context/privy-auth-context';
import './agent-control-center.css';

type Agent = { id: string; name: string; responsibility: string; credentialId: string; model: string; archived?: boolean };
type Config = { workflow: 'research-v1'; agents: Agent[] };
type Credential = { id: string; label: string; provider: string };
type RunSummary = { id: string; question: string; status: string; mode: string; createdAt: string };
type Artifact = { text: string; agentId: string; provider: string; model: string; requestId: string | null; step: string };
type Run = RunSummary & { config: Config; events: { sequence: number; at: string; agentId: string; type: string; summary: string; pid?: number; transaction?: string; discovery?: { source: string; recordsRead: string; selected?: { entityKey: string; address: string } | null } }[]; workers: Record<string, { status: string; attempt: number; pid: number | null; heartbeat: string | null }>; artifacts: Record<string, Artifact>; report: Artifact | null; error?: string; paid?: boolean; discoveryMode?: string; deployment?: { chainId: number }; financeError?: string; finance?: { block: string; chainId: number; tasks: Record<string, { taskId: string; available: string; reserved: string; spent: string; worker: string; epoch: string }> } | null };
const providers = ['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'nvidia'];
const emptyAgent = (): Agent => ({ id: crypto.randomUUID(), name: '', responsibility: '', credentialId: '', model: '' });
const terminal = ['completed', 'cancelled', 'failed'];

export default function AgentControlCenter({ view }: { view: 'Agents' | 'Runs' | 'Credentials' | 'Integrations' }) {
  const auth = useRelayAuth();
  const { getAccessToken, authenticated } = auth;
  const [config, setConfig] = useState<Config | null>(null), [credentials, setCredentials] = useState<Credential[]>([]);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null), [provider, setProvider] = useState('openai'), [label, setLabel] = useState(''), [key, setKey] = useState('');
  const [runs, setRuns] = useState<RunSummary[]>([]), [run, setRun] = useState<Run | null>(null), [runId, setRunId] = useState('');
  const [question, setQuestion] = useState('Compare the benefits and limitations of task-owned budgets for research agents.');
  const [mode, setMode] = useState('fixture'), [billing, setBilling] = useState(false), [interrupt, setInterrupt] = useState(true);
  const [filter, setFilter] = useState('all');
  const [paidRuntime, setPaidRuntime] = useState(false), [paid, setPaid] = useState(true), [spending, setSpending] = useState(false), [discoveryMode, setDiscoveryMode] = useState('local');
  const [profiles, setProfiles] = useState<{ entityKey: string; name: string; owner: string; worker: string; capabilities: string }[] | null>(null);
  const [network, setNetwork] = useState<{ chainId: number; deploymentPresent: boolean } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useCallback(async (url: string, body?: unknown) => {
    const token = await getAccessToken();
    const response = await fetch(url, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data;
  }, [getAccessToken]);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void request('/api/workbench').then(data => { if (active) { setConfig(data.config); setCredentials(data.credentials); } }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [request, authenticated]);
  useEffect(() => {
    if (view !== 'Runs' || !authenticated) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const data = await request('/api/research');
        if (!active) return;
        setRuns(data.runs); setPaidRuntime(Boolean(data.paidRuntime));
        const selected = runId || data.runs[0]?.id;
        if (selected) {
          const detail = await request('/api/research?id=' + encodeURIComponent(selected));
          if (active) { setRun(detail.run); if (!runId) setRunId(selected); }
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Could not refresh monitor'); }
      if (active) timer = setTimeout(() => void update(), 2000);
    };
    void update();
    return () => { active = false; clearTimeout(timer); };
  }, [view, request, authenticated, runId]);
  useEffect(() => { if (agent) dialog.current?.showModal(); else dialog.current?.close(); }, [agent]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setMessage(''); try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); }
  }
  async function save(next: Config) {
    const data = await request('/api/workbench', { action: 'saveConfig', config: next });
    setConfig(data.config); setMessage('Agent configuration saved. On-chain authority is unchanged.');
  }
  const agents = config?.agents || [], activeAgents = agents.filter(item => !item.archived);
  const filteredEvents = (run?.events || []).filter(event => filter === 'all' || filter === event.agentId);
  return <div className="agent-control-center">
    {message && <div className="notice" role="status">{message}</div>}
    {!config && <p className="agent-muted">Loading your workspace…</p>}
    {view === 'Agents' && <>
      <div className="agent-section-bar"><div><h3>Agent directory</h3><p className="agent-muted">One Janus coordinator. Up to six independently running research workers.</p></div><button className="btn-secondary-pill" disabled={!config || busy || agents.length >= 7} onClick={() => setAgent(emptyAgent())}><Plus size={15} />Create agent</button></div>
      <div className="dashboard-metrics-grid">{[{ label: 'Active agents', value: activeAgents.length }, { label: 'Parallel workers', value: activeAgents.filter(item => item.id !== 'orchestrator').length }, { label: 'Saved credentials', value: credentials.length }, { label: 'Settlement', value: 'Hedera' }].map(metric => <div className="spotlight-card" key={metric.label}><span className="agent-muted">{metric.label}</span><strong className="agent-metric">{metric.value}</strong></div>)}</div>
      <div className="agent-card-grid">{agents.map(item => <article className="spotlight-card" key={item.id}>
        <div className="agent-section-bar"><Bot size={20} /><span className="hash-tag">{item.archived ? 'ARCHIVED' : item.id === 'orchestrator' ? 'COORDINATOR' : 'RESEARCH WORKER'}</span></div>
        <h3>{item.name}</h3><p className="agent-muted">{item.responsibility}</p>
        <dl className="agent-facts"><div><dt>Provider</dt><dd>{credentials.find(record => record.id === item.credentialId)?.provider || 'Not assigned'}</dd></div><div><dt>Model</dt><dd>{item.model || 'Fixture only'}</dd></div></dl>
        <div className="agent-actions"><button className="btn-secondary-pill" disabled={busy} onClick={() => setAgent({ ...item })}>Configure <ArrowRight size={13} /></button>{item.id !== 'orchestrator' && <button className="btn-secondary-pill" disabled={!config || busy} onClick={() => void action(() => save({ ...config!, agents: agents.map(a => a.id === item.id ? { ...a, archived: !a.archived } : a) }))}><Archive size={13} />{item.archived ? 'Restore' : 'Archive'}</button>}</div>
      </article>)}</div>
      <p className="agent-muted">Worker definitions do not hold a fresh allowance. Task budgets and spending authority remain with the treasury.</p>
    </>}
    {view === 'Credentials' && <div className="dashboard-two-col-grid">
      <section className="spotlight-card"><KeyRound size={20} /><h3>Add provider credential</h3><p className="agent-muted">Encrypted on the server and scoped to your verified account. Janus decrypts keys to call your provider. Saving makes no provider request.</p>
        <form onSubmit={event => { event.preventDefault(); void action(async () => { await request('/api/workbench', { action: 'saveCredential', credential: { provider, label, key } }); setKey(''); setLabel(''); setCredentials((await request('/api/workbench')).credentials); setMessage('Credential saved. Assign it to an agent.'); }); }}>
          <label>Provider<select value={provider} onChange={event => setProvider(event.target.value)}>{providers.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Label<input required maxLength={60} value={label} onChange={event => setLabel(event.target.value)} placeholder="Research team key" /></label>
          <label>API key<input required type="password" autoComplete="new-password" spellCheck={false} minLength={16} maxLength={4096} value={key} onChange={event => setKey(event.target.value)} placeholder="Your provider API key" /></label>
          <button className="btn-secondary-pill" disabled={busy}><Plus size={14} />Save credential</button>
        </form>
      </section>
      <section className="spotlight-card"><h3>Saved credentials</h3>{credentials.length === 0 && <p className="agent-muted">No keys saved. Local research fixtures need none.</p>}{credentials.map(item => <div className="agent-list-row" key={item.id}><div><strong>{item.label}</strong><p className="agent-muted">{item.provider} · encrypted</p></div><button className="btn-secondary-pill" disabled={busy} onClick={() => void action(async () => { await request('/api/workbench', { action: 'removeCredential', id: item.id }); setCredentials(current => current.filter(record => record.id !== item.id)); })}>Revoke</button></div>)}<p className="agent-muted">Provider API calls are billed externally. Treasury tool-payment limits do not cap your provider invoice.</p></section>
    </div>}
    {view === 'Integrations' && <>
      <div className="dashboard-two-col-grid"><section className="spotlight-card"><h3>Treasury deployment</h3><p className="agent-muted">Read-only chain and deployment-code check. This does not submit a payment or establish general x402 compliance.</p><button className="btn-secondary-pill" disabled={busy} onClick={() => void action(async () => { const response = await fetch('/api/integrations', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setNetwork(data.hedera); })}><RefreshCw size={14} />Check deployment</button>{network && <p>Chain {network.chainId} · {network.deploymentPresent ? 'Contract code found' : 'No contract code found'}</p>}</section>
      <section className="spotlight-card"><h3>Arkiv research directory</h3><p className="agent-muted">Your wallet address, generic worker label, capability and availability are public. Expiry does not guarantee erasure of historical copies. A profile grants no spending permission.</p><div className="agent-actions"><button className="btn-secondary-pill" disabled={busy} onClick={() => void action(async () => { const directory = await import('@/lib/arkiv-directory'); setProfiles(await directory.listArkivWorkers()); })}>Read directory</button><button className="btn-secondary-pill" disabled={busy || !auth.walletAddress} onClick={() => void action(async () => { const wallet = await auth.getWalletProvider(); if (!wallet || !auth.walletAddress) throw new Error('Connect a dedicated testnet wallet'); const directory = await import('@/lib/arkiv-directory'); const result = await directory.registerArkivWorker(wallet, auth.walletAddress as `0x${string}`, 'Research worker'); setMessage(`Profile published: ${result.entityKey}. Transaction: ${result.txHash}`); setProfiles(await directory.listArkivWorkers()); })}>Publish worker</button></div><p className="agent-muted">Publishing requests a wallet signature and testnet gas. Never publish secrets or private prompts. Research-run automatic reassignment is not connected yet.</p></section></div>
      {profiles && <section className="spotlight-card"><h3>Worker profiles</h3>{profiles.length === 0 && <p className="agent-muted">No eligible profiles returned. Do not assume a replacement is available.</p>}{profiles.map(profile => <div className="agent-list-row" key={profile.entityKey}><div><strong>{profile.name}</strong><p className="agent-muted">{profile.worker} · {profile.capabilities}</p></div><button className="btn-secondary-pill" disabled={busy || !config || agents.length >= 7} onClick={() => setAgent({ ...emptyAgent(), name: profile.name.slice(0, 50), responsibility: `Research using the public ${profile.capabilities} worker profile ${profile.entityKey}. Check evidence and respect task authority.` })}>Configure worker</button></div>)}</section>}
    </>}
    {view === 'Runs' && <>
      <div className="dashboard-two-col-grid"><section className="spotlight-card"><div className="agent-section-bar"><h3>Start research</h3><GitBranch size={20} /></div>
        <form onSubmit={event => { event.preventDefault(); void action(async () => { if (!config) throw new Error('Workspace is not loaded'); const data = await request('/api/research', { action: 'create', question, mode, confirmProviderBilling: billing, interrupt, paid: paidRuntime && paid, confirmTaskSpending: spending, discoveryMode }); setRun(data.run); setRunId(data.run.id); setRuns(current => [data.run, ...current]); }); }}>
          <label>Research question<textarea rows={3} required minLength={10} maxLength={6000} value={question} onChange={event => setQuestion(event.target.value)} /></label>
          <label>Execution mode<select value={mode} onChange={event => { setMode(event.target.value); setBilling(false); }}><option value="fixture">Local fixture · no provider calls</option><option value="llm">Live models · your saved API keys</option></select></label>
          {paidRuntime && <><label className="agent-checkbox"><input type="checkbox" checked={paid} onChange={event => { setPaid(event.target.checked); setSpending(false); }} />Purchase reference sources with local treasury tasks</label>{paid && <><p className="agent-muted">Each active research worker receives a 100,000-unit local test-token task budget. One reference source costs 20,000 units. Model provider charges are separate.</p><label>Replacement directory<select value={discoveryMode} onChange={event => setDiscoveryMode(event.target.value)}><option value="local">Local executor registry · no live Arkiv claim</option><option value="arkiv">Live Arkiv · wait if no eligible executor</option></select></label><label className="agent-checkbox"><input type="checkbox" checked={spending} onChange={event => setSpending(event.target.checked)} />I approve allocating these local test-token budgets and purchasing one reference source per worker.</label></>}</>}
          {mode === 'fixture' ? <label className="agent-checkbox"><input type="checkbox" checked={interrupt} onChange={event => setInterrupt(event.target.checked)} />{paidRuntime && paid ? 'Wait after the first source payment for Interrupt worker' : 'Interrupt first worker after checkpoint; demonstrate replacement'}</label> : <label className="agent-checkbox"><input type="checkbox" checked={billing} onChange={event => setBilling(event.target.checked)} />I approve sending my question, assigned research context and purchased source content to the configured model providers, with separate provider billing: one planning call, one per active worker, and one report call (up to 800 output tokens each).</label>}
          <button className="btn-secondary-pill" disabled={busy || !config || (mode === 'llm' && !billing) || (paidRuntime && paid && !spending)}><Play size={14} />Start run</button>
        </form><p className="agent-muted">{paidRuntime && paid ? 'Source purchases use the shared local treasury and merchant. The source is a reference dataset, not live web research. Replacement resumes only after confirmed assignment.' : 'Research-only mode uses supplied context without purchasing sources.'}</p>
      </section><section className="spotlight-card"><h3>Saved runs</h3><div className="agent-run-list">{runs.length === 0 && <p className="agent-muted">Your research runs will appear here.</p>}{runs.map(item => <button aria-pressed={runId === item.id} className="agent-run-option" key={item.id} onClick={() => { setRunId(item.id); setFilter('all'); }}><span>{item.question}</span><small>{item.status} · {item.mode === 'fixture' ? 'LOCAL FIXTURE' : 'LIVE MODELS'}</small></button>)}</div></section></div>
      {run && <>
        <div className="agent-section-bar"><div><h3>Janus orchestrator <span className="hash-tag">{run.status.toUpperCase()}</span></h3><p className="agent-muted">Run {run.id} · {run.paid ? `Paid local tasks · ${run.discoveryMode === 'arkiv' ? 'live Arkiv discovery' : 'local executor registry'} · ` : ''}{run.mode === 'fixture' ? 'Local fixture — no live spending' : 'Provider research — externally billed'}</p></div><div className="agent-actions">{!terminal.includes(run.status) && <><button className="btn-secondary-pill" disabled={busy || !['running', 'queued'].includes(run.status)} onClick={() => void action(async () => { await request('/api/research', { action: 'pause', id: run.id }); setMessage('Pause requested. In-flight calls finish before the run pauses.'); })}><Pause size={13} />Pause</button><button className="btn-secondary-pill" disabled={busy || !['paused', 'waiting'].includes(run.status)} onClick={() => void action(async () => { await request('/api/research', { action: 'resume', id: run.id }); setMessage('Resume requested for the original run.'); })}><RefreshCw size={13} />Resume</button><button className="btn-secondary-pill" disabled={busy} onClick={() => void action(async () => { await request('/api/research', { action: 'cancel', id: run.id }); setMessage('Cancellation requested. No treasury cancellation or refund is implied.'); })}><X size={13} />Cancel</button></>}</div></div>
        {['completed', 'cancelled'].includes(run.status) && <div className="agent-actions"><button className="btn-secondary-pill" disabled={busy} onClick={() => {
          if (!window.confirm('Permanently delete this local research run and its report? Provider copies, backups and financial records remain.')) return;
          void action(async () => {
            await request('/api/research', { action: 'delete', id: run.id, confirmDelete: true });
            setRuns(current => current.filter(item => item.id !== run.id)); setRun(null); setRunId('');
            setMessage('Local research deleted. Provider copies, backups and financial records are unchanged.');
          });
        }}>Delete local research</button></div>}
        {run.financeError && <div className="notice" role="alert">{run.financeError}</div>}
        {run.error && <div className="notice" role="alert">{run.error}</div>}
        <div className="agent-card-grid">{run.config.agents.map(item => { const state = run.workers[item.id], finance = run.finance?.tasks[item.id]; return <article className="spotlight-card" key={item.id}><div className="agent-section-bar"><Bot size={18} /><span className="hash-tag">{item.id === 'orchestrator' ? 'COORDINATOR' : state?.status || 'WAITING'}</span></div><h3>{item.name}</h3><p className="agent-muted">{item.responsibility}</p><dl className="agent-facts"><div><dt>Process</dt><dd>{state?.pid ?? 'Supervisor'}</dd></div><div><dt>Heartbeat</dt><dd>{state?.heartbeat ? new Date(state.heartbeat).toLocaleTimeString() : "—"}</dd></div><div><dt>Attempt</dt><dd>{state?.attempt ?? 1}</dd></div><div><dt>Artifacts</dt><dd>{Object.values(run.artifacts).filter(a => a.agentId === item.id).length}</dd></div></dl>{finance && <dl className="agent-facts"><div><dt>Available</dt><dd>{finance.available}</dd></div><div><dt>Reserved</dt><dd>{finance.reserved}</dd></div><div><dt>Spent</dt><dd>{finance.spent}</dd></div><div><dt>Epoch</dt><dd>{finance.epoch}</dd></div></dl>}{finance && <p className="agent-muted">Task {finance.taskId} · worker {finance.worker} · block {run.finance?.block}</p>}{item.id !== 'orchestrator' && <button className="btn-secondary-pill" disabled={busy || run.status !== 'running' || !state || !['running', 'holding'].includes(state.status)} onClick={() => void action(async () => { await request('/api/research', { action: 'interrupt-worker', id: run.id, agentId: item.id }); setMessage('Interrupt requested. Waiting for process exit, reconciliation and replacement assignment.'); })}>Interrupt worker · {item.name}</button>}</article>; })}</div>
        <section className="spotlight-card"><div className="agent-section-bar"><h3><Activity size={16} /> Activity timeline</h3><label className="agent-filter">Filter agent<select aria-label="Filter activity by agent" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All agents</option>{run.config.agents.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><ol className="agent-timeline" aria-live="polite">{filteredEvents.map(event => <li key={event.sequence}><span className="agent-event-number">{String(event.sequence).padStart(2, '0')}</span><div><strong>{event.type.replaceAll('-', ' ')}</strong><p>{event.summary}</p>{event.transaction && <a href={run.deployment?.chainId === 296 ? `https://hashscan.io/testnet/transaction/${event.transaction}` : `/api/receipt?transaction=${event.transaction}`} target="_blank" rel="noreferrer">Receipt · {event.transaction.slice(0, 12)}…</a>}{event.discovery && <p className="agent-muted">Directory: {event.discovery.source} · {event.discovery.recordsRead} records · {event.discovery.selected ? `selected ${event.discovery.selected.address} (${event.discovery.selected.entityKey})` : 'No eligible executor'}</p>}<small>{run.config.agents.find(a => a.id === event.agentId)?.name} · {new Date(event.at).toLocaleTimeString()}{event.pid ? ` · process ${event.pid}` : ''}</small></div></li>)}</ol></section>
        <section className="spotlight-card"><h3>Research artifacts</h3>{Object.values(run.artifacts).map(artifact => <details key={artifact.step}><summary>{run.config.agents.find(item => item.id === artifact.agentId)?.name} · {artifact.step} · {artifact.provider}</summary><pre className="agent-artifact">{artifact.text}</pre><small className="agent-muted">{artifact.model} · request {artifact.requestId || 'local fixture'}</small></details>)}</section>
        {run.report && <section className="spotlight-card"><h3>Final report</h3><pre className="agent-artifact">{run.report.text}</pre></section>}
      </>}
    </>}
    <dialog ref={dialog} className="task-dialog agent-control-center" onCancel={() => setAgent(null)} onClick={event => { if (event.target === event.currentTarget) setAgent(null); }}>
      {agent && <form onSubmit={event => { event.preventDefault(); void action(async () => { if (!config) return; const exists = agents.some(item => item.id === agent.id); await save({ ...config, agents: exists ? agents.map(item => item.id === agent.id ? agent : item) : [...agents, agent] }); setAgent(null); }); }}>
        <div className="agent-section-bar"><h2>{agents.some(item => item.id === agent.id) ? 'Configure agent' : 'Create agent'}</h2><button type="button" className="btn-secondary-pill" aria-label="Close agent form" onClick={() => setAgent(null)}><X size={16} /></button></div>
        <label>Name<input required maxLength={50} value={agent.name} onChange={event => setAgent({ ...agent, name: event.target.value })} /></label>
        <label>Research responsibility<textarea required rows={3} maxLength={1500} value={agent.responsibility} onChange={event => setAgent({ ...agent, responsibility: event.target.value })} /></label>
        <label>Provider credential<select value={agent.credentialId} onChange={event => setAgent({ ...agent, credentialId: event.target.value })}><option value="">None · fixture only</option>{credentials.map(item => <option key={item.id} value={item.id}>{item.label} · {item.provider}</option>)}</select></label>
        <label>Model ID<input maxLength={100} value={agent.model} placeholder="Exact model ID from your provider" onChange={event => setAgent({ ...agent, model: event.target.value })} /></label>
        <p className="agent-muted">Saving creates a worker definition. It does not make a model call, grant financial authority, or allocate new funds.</p><button className="btn-secondary-pill" disabled={busy}>Save agent <ArrowRight size={14} /></button>
      </form>}
    </dialog>
  </div>;
}
