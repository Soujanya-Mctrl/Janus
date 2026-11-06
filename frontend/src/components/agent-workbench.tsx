'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Bot, Check, Cpu, GitBranch, KeyRound, Layers, Play, Plus, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { useRelayAuth } from '@/context/privy-auth-context';
import { listArkivWorkers, registerArkivWorker } from '@/lib/arkiv-directory';
import styles from './agent-workbench.module.css';

type Credential = { id: string; provider: string; label: string; createdAt: string };
type Agent = { id: string; name: string; responsibility: string; credentialId: string; model: string };
type Config = { totalBudget: string; taskBudget: string; interrupt: boolean; agents: Agent[] };
type Event = { type: string; bot?: string; epoch?: number; reason?: string; operationId?: string; from?: string; to?: string; amount?: string; requestId?: string };
type Portfolio = { cash: string; realizedPnl: string; operatingCostsPaid: string; fills: unknown[]; transferredIn: string; transferredOut: string };
type Result = { cash: string; realizedPnl: string; operatingCostsPaid: string; reserve: string; portfolios: Record<string, Portfolio>; decisionSource: string; disclaimer: string; analyses: { agent: string; text: string; provider: string; requestId: string | null }[] };
type View = 'workflow' | 'credentials' | 'agents' | 'integrations';
const initial: Config = { totalBudget: '100', taskBudget: '30', interrupt: true, agents: [
  { id: 'orchestrator', name: 'Orchestrator', responsibility: 'Coordinate the task, review risk and recover interrupted workers.', credentialId: '', model: '' },
  { id: 'alpha', name: 'Alpha', responsibility: 'Evaluate the DEMOA paper position and explain each decision.', credentialId: '', model: '' },
  { id: 'beta', name: 'Beta', responsibility: 'Evaluate the DEMOB paper position independently within its allowance.', credentialId: '', model: '' },
  { id: 'gamma', name: 'Gamma', responsibility: 'Test order limits on DEMOC and hold when risk checks reject an order.', credentialId: '', model: '' },
] };
const providers = [{ id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/api-keys' }, { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://aistudio.google.com/apikey' }, { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/keys' }, { id: 'groq', name: 'Groq', url: 'https://console.groq.com/keys' }];
const money = (value?: string) => value === undefined ? 'â€”' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(value) / 1000000);
const eventName = (value: string) => value.replaceAll('-', ' ');

export default function AgentWorkbench({ initialView = 'workflow' }: { initialView?: View }) {
  const auth = useRelayAuth();
  const { authenticated, getAccessToken } = auth;
  const [view, setView] = useState<View>(initialView), [config, setConfig] = useState<Config>(initial);
  const [credentials, setCredentials] = useState<Credential[]>([]), [provider, setProvider] = useState('openai');
  const [label, setLabel] = useState(''), [key, setKey] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [running, setRunning] = useState(false), [events, setEvents] = useState<Event[]>([]);
  const [result, setResult] = useState<Result | null>(null), [runId, setRunId] = useState(''), [billing, setBilling] = useState(false);
  const [workers, setWorkers] = useState<Awaited<ReturnType<typeof listArkivWorkers>>>([]), [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [integrations, setIntegrations] = useState<{ hedera?: { chainId: number; deploymentPresent: boolean; treasury: string } }>({});
  const [selectedProfile, setSelectedProfile] = useState('');
  const timeline = useRef<HTMLDivElement>(null);
  async function request(body?: unknown) {
    const token = await auth.getAccessToken();
    const response = await fetch('/api/workbench', { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data;
  }
  useEffect(() => {
    if (!authenticated) {
      const timer = setTimeout(() => { setCredentials([]); setKey(''); setLabel(''); }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        const response = await fetch('/api/workbench', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (!cancelled) { setCredentials(data.credentials); setConfig(data.config); }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not load workspace'); }
    })();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken]);
  useEffect(() => { timeline.current?.scrollTo({ top: timeline.current.scrollHeight }); }, [events]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setMessage(''); try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); }
  }
  async function saveConfig() { await request({ action: 'saveConfig', config }); setMessage('Agent configuration saved.'); }
  async function run(live: boolean, resume = false) {
    const savedRunId = runId;
    setRunning(true); setMessage(''); setEvents([]); setResult(null); if (!resume) setRunId('');
    try {
      let token: string | null = null;
      if (auth.authenticated) { if (!resume) await request({ action: 'saveConfig', config }); token = await auth.getAccessToken(); }
      const response = await fetch('/api/workbench', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(resume ? { action: 'resume', runId: savedRunId, confirmProviderBilling: billing } : auth.authenticated ? { action: 'run', mode: live ? 'llm' : 'fixture', confirmProviderBilling: billing } : { action: 'runDemo', interrupt: config.interrupt }) });
      if (!response.ok) throw new Error((await response.json()).error);
      const reader = response.body?.getReader(); if (!reader) throw new Error('Run stream unavailable');
      const decoder = new TextDecoder(); let pending = '', ended = false;
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        for (;;) {
          const end = pending.indexOf('\n'); if (end < 0) break;
          const item = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
          if (item.kind === 'started') setRunId(item.runId);
          if (item.kind === 'event') setEvents(previous => [...previous, item.event].slice(-400));
          if (item.kind === 'result') { setResult(item.result); ended = true; }
          if (item.kind === 'error') { ended = true; setMessage(item.error); }
        }
      }
      if (!ended) throw new Error('Connection ended before a result. Keep the run ID; do not repeat billable inference blindly.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Run failed'); }
    finally { setRunning(false); }
  }
  const agentState = (id: string) => {
    const event = [...events].reverse().find(event => event.bot === id);
    return event ? eventName(event.type) : 'Ready to configure';
  };
  const updateAgent = (id: string, field: keyof Agent, value: string) => setConfig(current => ({ ...current, agents: current.agents.map(agent => agent.id === id ? { ...agent, [field]: value } : agent) }));
  const title = { workflow: 'Agent workflow', credentials: 'Provider credentials', agents: 'Configure your agents', integrations: 'Network integrations' }[view];
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><span>J</span> JANUS</Link>
      <p className={styles.workspace}>Agent workspace<small>Paper trading</small></p>
      <nav aria-label="Agent workspace">
        {([{ id: 'workflow', label: 'Workflow', icon: GitBranch }, { id: 'credentials', label: 'Credentials', icon: KeyRound }, { id: 'agents', label: 'Agents', icon: Bot }, { id: 'integrations', label: 'Integrations', icon: Layers }] as const).map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)} className={view === item.id ? styles.active : ''}><item.icon size={17} />{item.label}</button>)}
      </nav>
      <div className={styles.sidebarBottom}><ShieldCheck size={20} /><p>Task-owned budgets.<br />Replaceable workers.</p><Link href="/dashboard">Treasury dashboard <ArrowRight size={14} /></Link></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.header}><span>Workspace <span className={styles.separator}>/</span> {title}</span><div><span className={styles.mode}>Simulation</span><button onClick={() => auth.authenticated ? void auth.logout() : auth.login()}>{auth.authenticated ? 'Sign out' : 'Sign in'}</button></div></header>
      <div className={styles.content}>
        <div className={styles.pageHeading}><div><p className={styles.eyebrow}>JANUS / {view.toUpperCase()}</p><h1>{title}</h1><p>{view === 'workflow' ? 'One orchestrator. Parallel workers. A budget that survives the handoff.' : view === 'credentials' ? 'Connect providers once. Assign credentials to agents without exposing keys to workers.' : view === 'agents' ? 'Give every agent a responsibility, a model and a bounded task allowance.' : 'Prepare the connections, then verify them with your own accounts.'}</p></div>{view === 'workflow' && <button className={styles.primary} disabled={running || busy} onClick={() => void run(false)}><Play size={16} />{running ? 'Runningâ€¦' : 'Run simulation'}</button>}</div>
        {message && <div className={styles.notice} role="status">{message}</div>}
        {!auth.authenticated && <div className={styles.signin}><KeyRound size={17} /><span>Try the preset simulation now. Sign in to save API keys and customize agents.</span><Link href="/login">Sign in <ArrowRight size={14} /></Link></div>}

        {view === 'workflow' && <>
          <div className={styles.metrics}>{[{ label: 'Total paper budget', value: `$${config.totalBudget}` }, { label: 'Cash after run', value: money(result?.cash) }, { label: 'Realized trading PnL', value: money(result?.realizedPnl) }, { label: 'Simulated operating fees', value: money(result?.operatingCostsPaid) }].map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
          <section className={styles.workflow} aria-label="Orchestrator and parallel worker flow">
            <div className={styles.flowHeading}><h2>Execution graph</h2><span>{result?.decisionSource ?? 'Synthetic quotes Â· no real trades'}</span></div>
            <div className={styles.orchestrator}><div className={styles.nodeIcon}><GitBranch size={22} /></div><div><strong>{config.agents[0].name}</strong><p>Allocate Â· enforce limits Â· reconcile Â· replace</p></div><span>{running ? 'Coordinating' : result ? 'Run complete' : 'Orchestrator'}</span></div>
            <div className={styles.connectors} aria-hidden="true"><span /><ArrowDown size={20} /><span /></div>
            <div className={styles.workerGrid}>{config.agents.slice(1).map((agent, index) => <article className={styles.worker} key={agent.id}><header><span className={styles.workerNumber}>0{index + 1}</span><Bot size={20} /></header><h3>{agent.name}</h3><p>{agent.responsibility}</p><div className={styles.workerMeta}><span>Allowance</span><strong>${config.taskBudget} paper</strong></div><div className={styles.workerMeta}><span>Provider</span><strong>{credentials.find(item => item.id === agent.credentialId)?.provider ?? 'Scripted fixture'}</strong></div><footer><span className={styles.dot} />{agentState(agent.id)}</footer>{result?.portfolios[agent.id] && <div className={styles.workerResult}><span>{result.portfolios[agent.id].fills.length} fills</span><strong>{money(result.portfolios[agent.id].cash)} cash</strong></div>}</article>)}</div>
            <p className={styles.flowNote}>Funds remain attached to tasks. A replacement reuses saved results; only configured free cash can move between tasks.</p>
          </section>
          <div className={styles.bottomGrid}><section className={styles.panel}><div className={styles.sectionHeading}><h2>Execution timeline</h2><span>{events.length} events</span></div><div ref={timeline} className={styles.timeline} aria-live="polite">{events.length === 0 ? <p className={styles.empty}>Run the simulation to watch worker startup, risk decisions, cash reallocation and recovery.</p> : events.map((event, index) => <div className={styles.event} key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{eventName(event.type)}</strong><p>{[event.bot, event.from && `${event.from} â†’ ${event.to}`, event.amount && money(event.amount), event.reason, event.operationId, event.requestId].filter(Boolean).join(' Â· ')}</p></div></div>)}</div>{runId && <p className={styles.runId}>Run ID: {runId}</p>}</section>
            <section className={styles.panel}><h2>Run controls</h2><label className={styles.check}><input type="checkbox" checked={config.interrupt} disabled={running} onChange={event => setConfig({ ...config, interrupt: event.target.checked })} /><span>Interrupt Alpha after a saved fill</span></label><p>Fixture mode makes no provider calls. Live mode asks the orchestrator and workers for proposals on the same synthetic quotes.</p><label className={styles.check}><input type="checkbox" checked={billing} onChange={event => setBilling(event.target.checked)} /><span>I understand live inference is billed by my providers, separately from paper funds.</span></label><button className={styles.primary} disabled={!auth.authenticated || !billing || running || busy} onClick={() => void run(true)}><Cpu size={16} />Run with LLM providers</button><button disabled={busy || !runId || !auth.authenticated} onClick={() => void action(async () => { const token = await auth.getAccessToken(); const response = await fetch(`/api/workbench?run=${runId}`, { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data.result); setEvents(data.result.events); })}>Retrieve saved result</button><label>Saved run ID<input value={runId} maxLength={36} disabled={running} placeholder="Paste a previous run ID" onChange={event => setRunId(event.target.value)} /></label><button disabled={busy || running || !runId || !auth.authenticated} onClick={() => void run(false, true)}>Resume saved run</button><p className={styles.caption}>A provider timeout may still be billed. Retry only after checking the saved run.</p></section></div>
          {result && result.analyses.length > 0 && <section className={styles.panel}><h2>Agent reasoning</h2>{result.analyses.map(analysis => <details key={analysis.agent}><summary>{analysis.agent} Â· {analysis.provider}</summary><p className={styles.reasoning}>{analysis.text}</p><small>Provider request: {analysis.requestId ?? 'Not returned'}</small></details>)}</section>}
        </>}

        {view === 'credentials' && <div className={styles.twoColumns}><section className={styles.panel}><h2>Add provider credential</h2><p>Keys are encrypted on the server and scoped to your verified account. They are never returned to the browser or stored in browser storage.</p><form onSubmit={event => { event.preventDefault(); void action(async () => { await request({ action: 'saveCredential', credential: { provider, label, key } }); setKey(''); setLabel(''); const data = await request(); setCredentials(data.credentials); setMessage('Credential saved. Assign it on the Agents screen.'); }); }}>
          <label>Provider<select value={provider} onChange={event => setProvider(event.target.value)}>{providers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Credential label<input value={label} maxLength={60} required placeholder="Research team key" onChange={event => setLabel(event.target.value)} /></label><label>API key<input type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} minLength={16} maxLength={4096} required placeholder="Paste your provider API key" /></label><button type="submit" className={styles.primary} disabled={!auth.authenticated || busy}><Plus size={16} />Save credential</button></form><a href={providers.find(item => item.id === provider)?.url} target="_blank" rel="noreferrer">Get a key from {providers.find(item => item.id === provider)?.name} <ArrowRight size={14} /></a></section>
          <section className={styles.panel}><div className={styles.sectionHeading}><h2>Saved credentials</h2><span>{credentials.length} saved</span></div>{credentials.length ? credentials.map(item => <div className={styles.credential} key={item.id}><KeyRound size={20} /><div><strong>{item.label}</strong><p>{item.provider} Â· encrypted Â· not yet live-tested</p></div><button aria-label={`Remove ${item.label}`} disabled={busy} onClick={() => void action(async () => { await request({ action: 'removeCredential', id: item.id }); setCredentials(current => current.filter(record => record.id !== item.id)); })}><Trash2 size={16} /></button></div>) : <div className={styles.empty}><KeyRound size={28} /><p>No credentials saved. The fixture simulation works without them.</p></div>}<div className={styles.info}><ShieldCheck size={20} /><p>Use provider-side spending limits. The paper task budget does not cap your external API bill. Saving a key does not make a provider call.</p></div></section></div>}

        {view === 'agents' && <><section className={styles.budgetBar}><label>Total paper budget (USD)<input inputMode="decimal" value={config.totalBudget} onChange={event => setConfig({ ...config, totalBudget: event.target.value })} /></label><label>Allowance per worker (USD)<input inputMode="decimal" value={config.taskBudget} onChange={event => setConfig({ ...config, taskBudget: event.target.value })} /></label><button className={styles.primary} disabled={!auth.authenticated || busy || running} onClick={() => void action(saveConfig)}><Check size={16} />Save configuration</button></section><div className={styles.agentForms}>{config.agents.map((agent, index) => <section className={styles.panel} key={agent.id}><div className={styles.sectionHeading}><h2>{index === 0 ? 'Orchestrator' : `Worker 0${index}`}</h2><Bot size={20} /></div><label>Name<input maxLength={50} value={agent.name} onChange={event => updateAgent(agent.id, 'name', event.target.value)} /></label><label>Responsibility<textarea maxLength={1500} rows={3} value={agent.responsibility} onChange={event => updateAgent(agent.id, 'responsibility', event.target.value)} /></label><label>Provider credential<select value={agent.credentialId} onChange={event => updateAgent(agent.id, 'credentialId', event.target.value)}><option value="">Select a saved credential</option>{credentials.map(item => <option key={item.id} value={item.id}>{item.label} Â· {item.provider}</option>)}</select></label><label>Model ID<input maxLength={100} placeholder="Exact model ID from your provider" value={agent.model} onChange={event => updateAgent(agent.id, 'model', event.target.value)} /></label><small>Responsibilities guide the model. Spending limits are enforced independently.</small></section>)}</div></>}

        {view === 'integrations' && <><div className={styles.integrationGrid}><section className={styles.panel}><Wallet size={24} /><h2>Hedera</h2><span className={styles.mode}>Testnet Â· 296</span><p>Connect task budgets to the existing Hedera treasury. Checking the network is read-only and does not submit a payment.</p><button disabled={busy} onClick={() => void action(async () => { const response = await fetch('/api/integrations', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setIntegrations(data); })}><RefreshCw size={16} />Check testnet</button>{integrations.hedera && <p>Chain {integrations.hedera.chainId} Â· {integrations.hedera.deploymentPresent ? 'Contract code found' : 'No contract code found'}<br /><a href={`https://hashscan.io/testnet/contract/${integrations.hedera.treasury}`} target="_blank" rel="noreferrer">View treasury</a></p>}<p className={styles.caption}>Existing signed payment adapter is not a verified general x402 integration.</p></section>
          <section className={styles.panel}><Layers size={24} /><h2>Arkiv</h2><span className={styles.mode}>Rabdi Â· 7794095</span><p>Publish a temporary worker profile with your wallet, then query the directory. Profiles are public and expire after one hour.</p><button disabled={busy} onClick={() => void action(async () => { setWorkers(await listArkivWorkers()); setDirectoryLoaded(true); })}>Read worker directory</button><button disabled={busy || !auth.walletAddress} onClick={() => void action(async () => { const wallet = await auth.getWalletProvider(); if (!wallet || !auth.walletAddress) throw new Error('Connect a wallet first'); const result = await registerArkivWorker(wallet, auth.walletAddress as `0x${string}`, config.agents[1].name); setMessage(`Profile published: ${result.entityKey}. Transaction: ${result.txHash}`); setWorkers(await listArkivWorkers()); setDirectoryLoaded(true); })}>Publish Alpha profile</button><a href="https://hub.arkiv.network/faucet" target="_blank" rel="noreferrer">Get testnet tGLM</a><p className={styles.caption}>Publishing requests a wallet signature and spends testnet gas. Never publish API keys or private prompts.</p></section>
          <section className={styles.panel}><GitBranch size={24} /><h2>Chainlink CRE</h2><span className={styles.mode}>Account setup pending</span><p>The workflow source connects an on-chain read with an external risk API. Install the CLI and sign in before running the official simulation.</p><code>npm run cre:simulate --prefix backend/cre</code><a href="https://docs.chain.link/cre/getting-started/overview" target="_blank" rel="noreferrer">Setup guide <ArrowRight size={14} /></a><p className={styles.caption}>The Node trading simulation is not a CRE CLI simulation. No deployed workflow or successful CRE run is claimed.</p></section></div>
          {directoryLoaded && <section className={styles.panel}><div className={styles.sectionHeading}><h2>Available worker profiles</h2><span>{workers.length} returned by Arkiv</span></div>{workers.length ? workers.map(worker => <div className={styles.directoryRow} key={worker.entityKey}><div><strong>{worker.name}</strong><p>{worker.worker} Â· {worker.capabilities}</p></div><button onClick={() => { setSelectedProfile(worker.entityKey); updateAgent('alpha', 'name', worker.name); updateAgent('alpha', 'responsibility', `Use the public ${worker.capabilities} profile owned by ${worker.owner}. Evaluate synthetic DEMOA quotes within task limits.`); setMessage('Public profile applied to Alpha configuration. Save the configuration to retain it. This does not grant financial authority.'); }}>{selectedProfile === worker.entityKey ? 'Profile applied' : 'Use profile'}</button></div>) : <p>No ready trading workers returned. Publish a profile and read again.</p>}</section>}
        </>}
        <footer className={styles.footer}><span>Janus Â· Task continuity workspace</span><span>Paper funds never pay real provider invoices.</span></footer>
      </div>
    </main>
  </div>;
}
