// Real React controls + authenticated production routes + real local EVM/merchant.
// Only the browser identity is a signed, isolated test account; no production auth bypass.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from '../../contracts/node_modules/esbuild/lib/main.js';
import { chromium } from '../../contracts/node_modules/playwright/index.mjs';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { paidFixture } from '../../backend/workbench/paid-fixture.mjs';
import { listRuns, controlRun } from '../../backend/workbench/research.mjs';
import { GET, POST } from '../src/app/api/research/route.ts';
import { GET as workbenchGET } from '../src/app/api/workbench/route.ts';
import { GET as receiptGET } from '../src/app/api/receipt/route.ts';

const root = fileURLToPath(new URL('../../', import.meta.url)), fixture = await paidFixture();
const user = 'did:privy:paid-browser', saved = { ...process.env };
const { privateKey, publicKey } = await generateKeyPair('ES256');
Object.assign(process.env, fixture.env, { JANUS_WORKSPACE_ROOT: root, NEXT_PUBLIC_PRIVY_APP_ID: 'paid-browser-test', PRIVY_VERIFICATION_KEY: await exportSPKI(publicKey) });
const token = await new SignJWT({ sub: user, iss: 'privy.io', aud: 'paid-browser-test', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600 }).setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
const auth = `export const useRelayAuth=()=>({authenticated:true,getAccessToken:async()=>${JSON.stringify(token)}});`;
const bundled = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/components/agent-control-center';createRoot(document.getElementById('root')).render(<Panel view="Runs"/>);`, resolveDir: path.join(root,'frontend'), loader:'tsx' }, bundle:true,jsx:'automatic',write:false,outfile:path.join(root,'.tools/paid-browser/bundle.js'),alias:{'@':path.join(root,'frontend/src')},plugins:[{name:'test-identity',setup(b){
 b.onResolve({filter:/privy-auth-context/},()=>({path:'auth',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:auth,loader:'js'}));
}}]});
const js = bundled.outputFiles.find(file=>file.path.endsWith('.js') || file.path==='<stdout>');
const css = bundled.outputFiles.find(file=>file.path.endsWith('.css'));
const server = http.createServer(async (req,res)=>{
 try {
  const base=`http://127.0.0.1:${server.address().port}`;
  if(req.url.startsWith('/api/')) {
   const chunks=[];for await(const chunk of req) chunks.push(chunk);
   const request=new Request(base+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?Buffer.concat(chunks):undefined});
   const response=req.url.startsWith('/api/research')?await(req.method==='POST'?POST(request):GET(request)):req.url.startsWith('/api/receipt')?await receiptGET(request):await workbenchGET(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':req.url==='/bundle.css'?'text/css':'text/html');
  res.end(req.url==='/bundle.js'?js.contents:req.url==='/bundle.css'?(css?.contents||''):'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{background:#101018;color:white;font-family:Arial;padding:20px}button,input,select,textarea{font:inherit}button{padding:10px}article{border:1px solid #444;padding:16px}.agent-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}dd{margin:0}.agent-facts{display:flex;gap:18px}pre{white-space:pre-wrap}a{color:#aaccff}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
 } catch(error){res.writeHead(500);res.end(JSON.stringify({error:error.message}));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser, page;
try {
 browser=await chromium.launch({headless:true,...(process.env.JANUS_CHROMIUM_PATH?{executablePath:process.env.JANUS_CHROMIUM_PATH}:{})});
 page=await browser.newPage({viewport:{width:1400,height:1000}}); const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByLabel('I approve allocating these local test-token budgets and purchasing one reference source per worker.').check();
 await page.getByRole('button',{name:'Start run',exact:true}).click();
 await page.waitForTimeout(5000);
 console.log((await page.locator('body').innerText()).slice(0,2200));
 const alpha=page.locator('article').filter({has:page.getByRole('heading',{name:'Alpha',exact:true})});
 await alpha.getByText('holding',{exact:true}).waitFor({timeout:60000});
 const gamma=page.locator('article').filter({has:page.getByRole('heading',{name:'Gamma',exact:true})});
 await gamma.getByText('completed',{exact:true}).waitFor({timeout:30000});
 await alpha.getByRole('button',{name:'Interrupt worker · Alpha',exact:true}).click();
 await page.getByRole('heading',{name:'Final report',exact:true}).waitFor({timeout:60000});
 await page.getByText('Paid result reused—no additional charge',{exact:true}).waitFor();
 const response=await GET(new Request(`http://localhost/api/research?id=${(await listRuns(fixture.root,user))[0].id}`,{headers:{authorization:`Bearer ${token}`}}));
 const {run}=await response.json();assert.equal(run.status,'completed',run.error);assert.equal(run.finance.tasks.alpha.epoch,'2');
 for(const task of Object.values(run.finance.tasks)){assert.equal(task.spent,'20000');assert.equal(task.available,'80000');assert.equal(task.reserved,'0');}
 const first=run.events.find(e=>e.type==='tool-payment-confirmed'&&e.agentId==='alpha'),reuse=run.events.find(e=>e.type==='paid-result-reused'&&e.agentId==='alpha');assert.equal(first.transaction,reuse.transaction);
 const receipt=await page.request.get(`http://127.0.0.1:${server.address().port}/api/receipt?transaction=${first.transaction}`);assert.equal(receipt.status(),200);assert.equal((await receipt.json()).status,'success');
 assert.deepEqual(errors,[]);
 await fs.mkdir(path.join(root,'.tools'),{recursive:true});await page.screenshot({path:path.join(root,'.tools/paid-dashboard-browser.png'),fullPage:true});
 console.log('Paid browser acceptance passed: authenticated create, funded task cards, actual interrupt, continued Gamma, confirmed assignment/epoch, original receipt reuse, zero extra debit and receipt link. Local registry; local model fixture.');
} catch (error) {
 if(page)console.error((await page.locator('body').innerText()).slice(0,3000));
 console.error(JSON.stringify((await listRuns(fixture.root,user)).map(run=>({status:run.status,error:run.error,paid:run.paid,hold:run.holdAfterPayment,workers:run.workers,events:run.events.slice(-6).map(event=>({type:event.type,summary:event.summary}))}))));
 throw error;
} finally {
 await browser?.close();
 for(const run of await listRuns(fixture.root,user))if(!['completed','cancelled'].includes(run.status))await controlRun(fixture.root,user,run.id,'cancel').catch(()=>{});
 for(let attempt=0;attempt<100;attempt++) {
  const runs=await listRuns(fixture.root,user);
  if(runs.every(run=>['completed','cancelled','failed','reconciling','waiting'].includes(run.status)))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fixture.close();
 for(const name of Object.keys(process.env))if(!(name in saved))delete process.env[name];Object.assign(process.env,saved);
}
