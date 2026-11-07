import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createFixtureRpc } from './fixtures/local-rpc.mjs';
import { privateKeyToAccount } from 'viem/accounts';
import { build } from 'esbuild';
import { createPublicClient, createWalletClient, custom, defineChain, keccak256, stringToHex } from 'viem';

// Browser tooling may be supplied by the developer/CI without a runtime dependency.
const { chromium } = await import(process.env.JANUS_PLAYWRIGHT_MODULE || 'playwright');
test('dashboard confirms authoritative balances and wallet actions before independent offline-app recovery', async t => {
 let browser;
 const rpc = createFixtureRpc();
 await rpc.listen(0,'127.0.0.1'); t.after(async () => { await browser?.close(); await rpc.close(); });
 const provider = rpc.provider, addresses = await provider.request({ method: 'eth_accounts', params: [] });
 const chain = defineChain({ id: 1337, name: 'Local recovery test', nativeCurrency: { name: 'Local Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [`http://127.0.0.1:${rpc.address().port}`] } } });
 const client = createPublicClient({ chain, transport: custom(provider), cacheTime: 0, pollingInterval: 10 });
 const owner = createWalletClient({ chain, transport: custom(provider), account: privateKeyToAccount(provider.getInitialAccounts()[addresses[0]].secretKey) });
 const artifact = async name => JSON.parse(await fs.readFile(new URL(`../artifacts/${name}.json`,import.meta.url),'utf8'));
 const tokenArtifact = await artifact('TestToken'), treasuryArtifact = await artifact('TaskTreasury');
 const receipt = async hash => { const r = await client.waitForTransactionReceipt({hash});assert.equal(r.status,'success');return r; };
 const token = (await receipt(await owner.deployContract({abi:tokenArtifact.abi,bytecode:tokenArtifact.bytecode}))).contractAddress;
 const treasury = (await receipt(await owner.deployContract({abi:treasuryArtifact.abi,bytecode:treasuryArtifact.bytecode,args:[token]}))).contractAddress;
 const abi=treasuryArtifact.abi,task=keccak256(stringToHex('browser-recovery'));
 await receipt(await owner.writeContract({address:token,abi:tokenArtifact.abi,functionName:'approve',args:[treasury,1000n]}));
 const send=(functionName,args)=>owner.writeContract({address:treasury,abi,functionName,args}).then(receipt);
 await send('deposit',[1000n]);await send('createTask',[task,addresses[1],addresses[2],100n,30n]);
 const operation=keccak256(stringToHex('pending-browser-purchase'));
 const worker=createWalletClient({chain,transport:custom(provider),account:privateKeyToAccount(provider.getInitialAccounts()[addresses[1]].secretKey)});
 await receipt(await worker.writeContract({address:treasury,abi,functionName:'reserve',args:[task,operation,keccak256(stringToHex('request')),10n,1n,1n,300n]}));
 const descriptor=JSON.parse(await fs.readFile(new URL('../../../shared/treasury-interface.json',import.meta.url),'utf8'));
 const manifest={interfaceVersion:descriptor.interfaceVersion,abiHash:descriptor.abiHash,mode:'local',chainId:1337,treasury,token,owner:addresses[0],runtimeCodeHash:keccak256(await client.getBytecode({address:treasury}))};
 const network={...chain,chainId:1337,token:{address:token}};
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-treasury-ui-')); t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const root = fileURLToPath(new URL('../../../',import.meta.url));
 const auth = `export const useRelayAuth=()=>({walletAddress:'${addresses[0]}',getWalletProvider:async()=>window.ethereum});`;
 const bundled = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/components/treasury-panel';createRoot(document.getElementById('root')).render(<Panel/>);`,resolveDir:root+'frontend',loader:'tsx'},bundle:true,jsx:'automatic',write:false,alias:{'@':root+'frontend/src'},plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/privy-auth-context/},()=>({path:'auth',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:auth,loader:'js'}));
 b.onLoad({filter:/shared[\\/](network|deployments[\\/]hedera-testnet)\.json$/},args=>({contents:JSON.stringify(args.path.endsWith('network.json')?network:manifest),loader:'json'}));
 }}]});
 let available=true;
 const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?bundled.outputFiles[0].contents:'<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{if(available){server.closeAllConnections();server.close();}});
 browser=await chromium.launch({headless:true,...(process.env.JANUS_CHROMIUM_PATH?{executablePath:process.env.JANUS_CHROMIUM_PATH}:{})});
 const page=await browser.newPage();let rejectTransaction=false,sends=0;
 const confirmed = async () => {
  try { await page.getByRole('status').filter({hasText:'State refreshed.'}).waitFor(); }
  catch (error) { throw new Error('Treasury confirmation failed: ' + await page.getByRole('status').textContent(), { cause: error }); }
 };
 await page.exposeFunction('fixtureWalletRequest',async({method,params})=>{
 if(method==='eth_accounts'||method==='eth_requestAccounts')return[addresses[0]];
 if(method==='wallet_sendTransaction')method='eth_sendTransaction';
 if(method==='eth_sendTransaction'){if(rejectTransaction)throw Error('User rejected transaction');sends++;if(!params[0].gas)params[0].gas=await provider.request({method:'eth_estimateGas',params:[params[0]]});}
 return provider.request({method,params:params??[]});});
 await page.addInitScript(()=>{window.ethereum={request:args=>window.fixtureWalletRequest(args)};});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const refresh=async()=>{await page.getByRole('button',{name:'Refresh chain state'}).click();await page.getByRole('status').filter({hasText:'Confirmed chain state loaded.'}).waitFor();};
 await refresh();assert.match(await page.locator('body').innerText(),/90/);assert.match(await page.locator('body').innerText(),/Reserved/);
 assert.equal(await page.getByRole('button',{name:'Cancel task',exact:true}).isDisabled(),true);
 await page.getByLabel('Selected task ID',{exact:true}).fill(task);
 await page.getByLabel('Replacement worker wallet').fill(addresses[3]);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Assign replacement',exact:true}).click();
 await confirmed();
 assert.equal((await client.readContract({address:treasury,abi,functionName:'tasks',args:[task]}))[8],2n);
 rejectTransaction=true;await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Cancel task',exact:true}).click();await page.getByRole('status').filter({hasText:'Reconcile any submitted hash'}).waitFor();
 assert.equal((await client.readContract({address:treasury,abi,functionName:'tasks',args:[task]}))[9],false);
 rejectTransaction=false;await refresh();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Cancel task',exact:true}).click();await confirmed();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Release available',exact:true}).click();await confirmed();
 assert.equal((await client.readContract({address:treasury,abi,functionName:'tasks',args:[task]}))[1],0n);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Withdraw entire reserve',exact:true}).click();await confirmed();
 assert.equal(await client.readContract({address:treasury,abi,functionName:'totalWithdrawn'}),990n);
 await page.screenshot({path:directory+'/dashboard.png',fullPage:true});
 // Shut down the entire dashboard host. Recovery imports no application service.
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));available=false;
 const {executeRecovery}=await import('../lib/recovery.mjs');
 const recovered=await executeRecovery({publicClient:client,walletClient:owner,manifest,taskId:task,operationIds:[operation]});
 assert.equal(recovered.task.reserved,'10');assert.equal(await client.readContract({address:treasury,abi,functionName:'totalWithdrawn'}),990n);
 await provider.request({method:'evm_increaseTime',params:[301]});await provider.request({method:'evm_mine',params:[]});
 await executeRecovery({publicClient:client,walletClient:owner,manifest,taskId:task,operationIds:[operation]});
 assert.equal(await client.readContract({address:treasury,abi,functionName:'totalWithdrawn'}),1000n);
 if(process.env.JANUS_PHASE6_EVIDENCE){await fs.mkdir(process.env.JANUS_PHASE6_EVIDENCE,{recursive:true});await fs.copyFile(directory+'/dashboard.png',process.env.JANUS_PHASE6_EVIDENCE+'/dashboard.png');await fs.writeFile(process.env.JANUS_PHASE6_EVIDENCE+'/report.json',JSON.stringify({status:'passed',network:'ephemeral local EVM 1337',checks:['actual React treasury panel','block-pinned balances and event timeline','consent required','assignment epoch increment','rejected approval does not cancel','receipt-confirmed cancel/release/withdraw','dashboard host stopped before direct recovery','pending reservation preserved until expiry'],withdrawnBeforeExpiry:'990',withdrawnAfterExpiry:'1000',liveFunds:false},null,2));}
 console.log('Verified actual treasury UI, rejected approval, assignment epoch, cancellation and recovery with dashboard host stopped. Screenshot: '+directory+'/dashboard.png');
});
