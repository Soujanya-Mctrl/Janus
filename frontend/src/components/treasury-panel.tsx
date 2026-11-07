'use client';
import { useState } from 'react';
import { useRelayAuth } from '@/context/privy-auth-context';
import { readTreasury, treasuryAction, connectedWallet, deployment } from '@/lib/treasury-client.mjs';

type Snapshot = Awaited<ReturnType<typeof readTreasury>>;
export default function TreasuryPanel() {
 const auth = useRelayAuth();
 const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
 const [ids,setIds] = useState(''), [range,setRange] = useState(''), [selected,setSelected] = useState(''), [replacement,setReplacement] = useState('');
 const [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [hash,setHash] = useState(''), [consent,setConsent] = useState(false);
 const [stale,setStale] = useState(false);
 const explorer = (transaction:string) => deployment.chainId === 296 ? `https://hashscan.io/testnet/transaction/${transaction}` : undefined;
 async function refresh() {
  setBusy(true); setMessage('Reading validated treasury and confirmed events…');
  try { const data = await readTreasury(undefined,undefined,ids.trim().split(/\s+/).filter(Boolean),range.trim() || undefined); setSnapshot(data); setStale(false); setMessage('Confirmed chain state loaded.'); }
  catch(e) { setStale(true); setMessage(e instanceof Error ? e.message : 'Treasury unavailable'); }
  finally { setBusy(false); }
 }
 async function act(action:string) {
  setBusy(true); setHash(''); setMessage('Review the transaction in your wallet.');
  try {
   if (!consent) throw new Error('Acknowledge the action effects first');
   const provider = await auth.getWalletProvider();
   if (!provider || !auth.walletAddress) throw new Error('Connect your authorized wallet');
   if (!snapshot || stale) throw new Error('Refresh chain state before acting');
   const receipt = await treasuryAction({ expectedDeployment: snapshot.deployment, walletClient: await connectedWallet(provider,auth.walletAddress), action, taskId:selected, replacement, onSubmitted: (transaction:string) => { setHash(transaction); setMessage('Submitted; waiting for a successful receipt.'); } });
   setHash(receipt.hash); setMessage(`Confirmed at block ${receipt.block}. Refreshing…`);
   setStale(true);
   const data = await readTreasury(undefined,undefined,ids.trim().split(/\s+/).filter(Boolean),range.trim() || undefined);
   setSnapshot(data); setStale(false); setMessage(`Confirmed at block ${receipt.block}. State refreshed.`);
  } catch(e) { setStale(true); setMessage(`${e instanceof Error ? e.message : 'Action failed'}. Reconcile any submitted hash before retrying.`); }
  finally { setBusy(false); setConsent(false); }
 }
 const inputStyle = { width:'100%',padding:10,background:'#15151c',color:'white',border:'1px solid #555',borderRadius:8 };
 return <section className="spotlight-card" style={{padding:24,marginTop:20}}>
  <h2>Authoritative treasury</h2>
  <p>Hedera testnet · {deployment.treasury} · USDC base units (1 USDC = 1,000,000).</p>
  <p>Every read validates the configured chain, bytecode, owner and token. RPC failures show an error; no sample balances are substituted.</p>
  <label>Task IDs (optional; one per line)<textarea style={inputStyle} value={ids} onChange={e=>{setIds(e.target.value);setStale(true);}} disabled={busy}/></label>
  <label>Events from block (optional; default last 1,000; maximum 10,000)<input style={inputStyle} value={range} onChange={e=>{setRange(e.target.value);setStale(true);}} disabled={busy}/></label>
  <button className="btn-secondary-pill" onClick={()=>void refresh()} disabled={busy}>Refresh chain state</button>
  <p role="status">{message}</p>{hash && (explorer(hash) ? <a href={explorer(hash)} target="_blank" rel="noreferrer">Inspect submitted transaction</a> : <code>Transaction: {hash}</code>)}
  {snapshot && <>
   <p>{stale ? 'STALE — refresh before acting. ' : ''}Observed block {snapshot.block}; events {snapshot.fromBlock}–{snapshot.block}. Task list covers this range plus supplied IDs.</p>
   <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>{Object.entries({Available:snapshot.available,Reserved:snapshot.reserved,Spent:snapshot.spent,Withdrawn:snapshot.withdrawn,'Unallocated reserve':snapshot.unallocated}).map(([name,value])=><div key={name}><strong>{name}</strong><p>{value}</p></div>)}</div>
   <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr>{['Task','Worker','Epoch','Available','Reserved','Spent','Released to reserve','Status'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{snapshot.tasks.map(task=><tr key={task.id}><td><button onClick={()=>setSelected(task.id)} disabled={busy}>{task.id.slice(0,12)}…</button></td><td>{task.worker}</td><td>{task.epoch}</td><td>{task.available}</td><td>{task.reserved}</td><td>{task.spent}</td><td>{task.returned}</td><td>{task.cancelled?'Cancelled':'Active'}</td></tr>)}</tbody></table></div>
   {!snapshot.tasks.length && <p>No tasks discovered in this event window. Supply task IDs or choose an earlier block.</p>}
   <h3>Owner / scheduler actions</h3>
   <label>Selected task ID<input style={inputStyle} value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy}/></label>
   <label>Replacement worker wallet<input style={inputStyle} value={replacement} onChange={e=>setReplacement(e.target.value)} disabled={busy}/></label>
   <p>Cancel stops new commitments; reserved obligations survive. Release moves available funds to the reserve. Withdraw takes the entire unallocated reserve. Reassignment changes financial authority; it does not launch a remote research process.</p>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/> I understand these action effects and will review the wallet request.</label>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>{[['cancelTask','Cancel task'],['assignWorker','Assign replacement'],['releaseAvailable','Release available'],['withdrawUnallocated','Withdraw entire reserve']].map(([action,label])=><button className="btn-secondary-pill" key={action} disabled={busy||stale||!consent} onClick={()=>void act(action)}>{label}</button>)}</div>
   <h3>Confirmed event timeline</h3><ul>{snapshot.events.slice(-50).reverse().map((event,index)=><li key={index}>{event.name} · block {event.block} · {explorer(event.transaction) ? <a href={explorer(event.transaction)} target="_blank" rel="noreferrer">Receipt</a> : <code>{event.transaction}</code>}</li>)}</ul>
  </>}
  <h3>Independent owner recovery</h3><p>Build the separate static recovery client using the documented command. Save and serve that artifact independently; this dashboard link alone is not an independent copy.</p>
  <p><a href="/recovery/index.html" target="_blank" rel="noreferrer">Open static recovery client</a> · <a href="/recovery/index.html" download>Save recovery HTML</a> · <a href="/recovery/recovery.js" download>Save recovery JavaScript</a></p>
  <a href="https://github.com/VanshDeo/Janus/blob/main/shared/RECOVERY.md" target="_blank" rel="noreferrer">Recovery setup and pending-reservation rules</a>
 </section>;
}
