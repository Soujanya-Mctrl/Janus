'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Check, GitBranch, KeyRound, Layers, Plus, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { useRelayAuth } from '@/context/privy-auth-context';
import { listArkivWorkers, registerArkivWorker, type WorkerProfile } from '@/lib/arkiv-directory';
import styles from './agent-workbench.module.css';

type Credential = { id: string; provider: string; label: string; createdAt: string };
type Agent = { id: string; name: string; responsibility: string; credentialId: string; model: string };
type Config = { workflow: 'research-v1'; agents: Agent[] };
type View = 'workflow' | 'credentials' | 'agents' | 'integrations';
const initial: Config = { workflow: 'research-v1', agents: [
  { id: 'orchestrator', name: 'Orchestrator', responsibility: 'Coordinate research, reuse paid sources and recover interrupted workers.', credentialId: '', model: '' },
  { id: 'alpha', name: 'Alpha', responsibility: 'Gather sources and preserve paid research artifacts.', credentialId: '', model: '' },
  { id: 'beta', name: 'Beta', responsibility: 'Resume unfinished research using the existing task checkpoint.', credentialId: '', model: '' },
  { id: 'gamma', name: 'Gamma', responsibility: 'Review evidence and assemble the research report.', credentialId: '', model: '' },
] };
const providers = [{ id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/api-keys' }, { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://aistudio.google.com/apikey' }, { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/keys' }, { id: 'groq', name: 'Groq', url: 'https://console.groq.com/keys' }, { id: 'nvidia', name: 'NVIDIA NIM', url: 'https://build.nvidia.com/' }];
export default function AgentWorkbench({ initialView = 'workflow' }: { initialView?: View }) {
  const auth = useRelayAuth();
  const { authenticated, getAccessToken } = auth;
  const [view, setView] = useState<View>(initialView), [config, setConfig] = useState<Config>(initial);
  const [credentials, setCredentials] = useState<Credential[]>([]), [provider, setProvider] = useState('openai');
  const [label, setLabel] = useState(''), [key, setKey] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [workers, setWorkers] = useState<Awaited<ReturnType<typeof listArkivWorkers>>>([]), [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [integrations, setIntegrations] = useState<{ hedera?: { chainId: number; deploymentPresent: boolean; treasury: string } }>({});
  const [selectedProfile, setSelectedProfile] = useState('');
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
  async function action(fn: () => Promise<void>) {
    setBusy(true); setMessage(''); try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); }
  }
  async function saveConfig() { await request({ action: 'saveConfig', config }); setMessage('Agent configuration saved.'); }
  const updateAgent = (id: string, field: keyof Agent, value: string) => setConfig(current => ({ ...current, agents: current.agents.map(agent => agent.id === id ? { ...agent, [field]: value } : agent) }));
  const title = { workflow: 'Agent workflow', credentials: 'Provider credentials', agents: 'Configure your agents', integrations: 'Network integrations' }[view];
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><span>J</span> JANUS</Link>
      <p className={styles.workspace}>Agent workspace<small>Research continuity</small></p>
      <nav aria-label="Agent workspace">
        {([{ id: 'workflow', label: 'Workflow', icon: GitBranch }, { id: 'credentials', label: 'Credentials', icon: KeyRound }, { id: 'agents', label: 'Agents', icon: Bot }, { id: 'integrations', label: 'Integrations', icon: Layers }] as const).map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)} className={view === item.id ? styles.active : ''}><item.icon size={17} />{item.label}</button>)}
      </nav>
      <div className={styles.sidebarBottom}><ShieldCheck size={20} /><p>Task-owned budgets.<br />Replaceable workers.</p><Link href="/dashboard">Treasury dashboard <ArrowRight size={14} /></Link></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.header}><span>Workspace <span className={styles.separator}>/</span> {title}</span><div><span className={styles.mode}>Configuration</span><button onClick={() => auth.authenticated ? void auth.logout() : auth.login()}>{auth.authenticated ? 'Sign out' : 'Sign in'}</button></div></header>
      <div className={styles.content}>
        <div className={styles.pageHeading}><div><p className={styles.eyebrow}>JANUS / {view.toUpperCase()}</p><h1>{title}</h1><p>{view === 'workflow' ? 'One orchestrator. Parallel workers. A budget that survives the handoff.' : view === 'credentials' ? 'Connect providers once. Assign credentials to agents without exposing keys to workers.' : view === 'agents' ? 'Prepare responsibilities and models for the research workflow.' : 'Prepare the connections, then verify them with your own accounts.'}</p></div></div>
        {message && <div className={styles.notice} role="status">{message}</div>}
        {!auth.authenticated && <div className={styles.signin}><KeyRound size={17} /><span>Sign in to save API keys and configure research agents.</span><Link href="/login">Sign in <ArrowRight size={14} /></Link></div>}

        {view === 'workflow' && <>
          <section className={styles.panel}><h2>Research task continuity</h2><p>Money, purchased sources and progress belong to the task. A replacement worker reuses paid artifacts, respects pending obligations and continues only unfinished work.</p><ol><li>Allocate a task budget through the treasury.</li><li>Purchase a source and checkpoint the result.</li><li>Interrupt a worker and reconcile its assignment.</li><li>Resume with a replacement without another charge.</li><li>Recover unused funds independently of application services.</li></ol></section>
          <section className={styles.panel}><h2>Run the verified local handoff</h2><code>npm run demo:handoff</code><p>The CLI demonstrates four logical tasks, five distinct purchases and 100 local base units spent. It does not call a model or spend live funds.</p><p>Replacement selection checks directory records, owner authorization and signed worker readiness. With a funded Rabdi test wallet, use <code>npm run demo:arkiv</code> for live discovery with local payments. Browser research execution remains integration work.</p><Link href="/dashboard">Open illustrative treasury dashboard <ArrowRight size={14} /></Link></section>
        </>}

        {view === 'credentials' && <div className={styles.twoColumns}><section className={styles.panel}><h2>Add provider credential</h2><p>Keys are encrypted on the server and scoped to your verified account. They are never returned to the browser or stored in browser storage.</p><form onSubmit={event => { event.preventDefault(); void action(async () => { await request({ action: 'saveCredential', credential: { provider, label, key } }); setKey(''); setLabel(''); const data = await request(); setCredentials(data.credentials); setMessage('Credential saved. Assign it on the Agents screen.'); }); }}>
          <label>Provider<select value={provider} onChange={event => setProvider(event.target.value)}>{providers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Credential label<input value={label} maxLength={60} required placeholder="Research team key" onChange={event => setLabel(event.target.value)} /></label><label>API key<input type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} minLength={16} maxLength={4096} required placeholder="Paste your provider API key" /></label><button type="submit" className={styles.primary} disabled={!auth.authenticated || busy}><Plus size={16} />Save credential</button></form><a href={providers.find(item => item.id === provider)?.url} target="_blank" rel="noreferrer">Get a key from {providers.find(item => item.id === provider)?.name} <ArrowRight size={14} /></a></section>
          <section className={styles.panel}><div className={styles.sectionHeading}><h2>Saved credentials</h2><span>{credentials.length} saved</span></div>{credentials.length ? credentials.map(item => <div className={styles.credential} key={item.id}><KeyRound size={20} /><div><strong>{item.label}</strong><p>{item.provider} · encrypted · not yet live-tested</p></div><button aria-label={`Remove ${item.label}`} disabled={busy} onClick={() => void action(async () => { await request({ action: 'removeCredential', id: item.id }); setCredentials(current => current.filter(record => record.id !== item.id)); })}><Trash2 size={16} /></button></div>) : <div className={styles.empty}><KeyRound size={28} /><p>No credentials saved. The CLI handoff demo works without them.</p></div>}<div className={styles.info}><ShieldCheck size={20} /><p>Saving a key does not call the provider. Browser model execution is not connected to the research runner yet.</p></div></section></div>}

        {view === 'agents' && <><section className={styles.budgetBar}><p>Prepare research roles and models. These settings do not grant spending authority or change on-chain budgets.</p><button className={styles.primary} disabled={!auth.authenticated || busy} onClick={() => void action(saveConfig)}><Check size={16} />Save configuration</button></section><div className={styles.agentForms}>{config.agents.map((agent, index) => <section className={styles.panel} key={agent.id}><div className={styles.sectionHeading}><h2>{index === 0 ? 'Orchestrator' : `Worker 0${index}`}</h2><Bot size={20} /></div><label>Name<input maxLength={50} value={agent.name} onChange={event => updateAgent(agent.id, 'name', event.target.value)} /></label><label>Responsibility<textarea maxLength={1500} rows={3} value={agent.responsibility} onChange={event => updateAgent(agent.id, 'responsibility', event.target.value)} /></label><label>Provider credential<select value={agent.credentialId} onChange={event => updateAgent(agent.id, 'credentialId', event.target.value)}><option value="">Select a saved credential</option>{credentials.map(item => <option key={item.id} value={item.id}>{item.label} · {item.provider}</option>)}</select></label><label>Model ID<input maxLength={100} placeholder="Exact model ID from your provider" value={agent.model} onChange={event => updateAgent(agent.id, 'model', event.target.value)} /></label><small>Saved configuration only; model execution is not connected yet.</small></section>)}</div></>}

        {view === 'integrations' && <><div className={styles.integrationGrid}><section className={styles.panel}><Wallet size={24} /><h2>Hedera</h2><span className={styles.mode}>Testnet · 296</span><p>Connect task budgets to the existing Hedera treasury. Checking the network is read-only and does not submit a payment.</p><button disabled={busy} onClick={() => void action(async () => { const response = await fetch('/api/integrations', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setIntegrations(data); })}><RefreshCw size={16} />Check testnet</button>{integrations.hedera && <p>Chain {integrations.hedera.chainId} · {integrations.hedera.deploymentPresent ? 'Contract code found' : 'No contract code found'}<br /><a href={`https://hashscan.io/testnet/contract/${integrations.hedera.treasury}`} target="_blank" rel="noreferrer">View treasury</a></p>}<p className={styles.caption}>Existing signed payment adapter is not a verified general x402 integration.</p></section>
          <section className={styles.panel}><Layers size={24} /><h2>Arkiv</h2><span className={styles.mode}>Rabdi · 7794095</span><p>Publish a temporary worker profile with your wallet, then query the directory. Profiles are public and expire after one hour.</p><button disabled={busy} onClick={() => void action(async () => { setWorkers(await listArkivWorkers()); setDirectoryLoaded(true); })}>Read worker directory</button><button disabled={busy || !auth.walletAddress} onClick={() => void action(async () => { const wallet = await auth.getWalletProvider(); if (!wallet || !auth.walletAddress) throw new Error('Connect a wallet first'); const result = await registerArkivWorker(wallet, auth.walletAddress as `0x${string}`, config.agents[1].name); setMessage(`Profile published: ${result.entityKey}. Transaction: ${result.txHash}`); setWorkers(await listArkivWorkers()); setDirectoryLoaded(true); })}>Publish Alpha profile</button><a href="https://hub.arkiv.network/faucet" target="_blank" rel="noreferrer">Get testnet tGLM</a><p className={styles.caption}>Publishing requests a wallet signature and spends testnet gas. Never publish API keys or private prompts.</p></section>
          </div>
          {directoryLoaded && <section className={styles.panel}><div className={styles.sectionHeading}><h2>Available worker profiles</h2><span>{workers.length} returned by Arkiv</span></div>{workers.length ? workers.map((worker: WorkerProfile) => <div className={styles.directoryRow} key={worker.entityKey}><div><strong>{worker.name}</strong><p>{worker.worker} · {worker.capabilities}</p></div><button onClick={() => { setSelectedProfile(worker.entityKey); updateAgent('alpha', 'name', worker.name); updateAgent('alpha', 'responsibility', `Use the public ${worker.capabilities} profile owned by ${worker.owner}. Gather and review research sources within the assigned task authority.`); setMessage('Public profile applied to Alpha configuration. Save the configuration to retain it. This does not grant financial authority.'); }}>{selectedProfile === worker.entityKey ? 'Profile applied' : 'Use profile'}</button></div>) : <p>No ready research workers returned. Publish a profile and read again.</p>}</section>}
        </>}
        <footer className={styles.footer}><span>Janus · Task continuity workspace</span><span>Task budgets and provider credentials remain separate.</span></footer>
      </div>
    </main>
  </div>;
}
