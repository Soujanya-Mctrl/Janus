// Optional live read acceptance: real UI and Arkiv SDK; isolated account/API fixture.
// No publication, provider billing, wallet signature or private user data.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from '../../contracts/node_modules/esbuild/lib/main.js';
import { chromium } from '../../contracts/node_modules/playwright/index.mjs';
import { defaultConfig } from '../../backend/workbench/config.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const publication=JSON.parse(await fs.readFile(path.join(root,'backend/arkiv/evidence/2026-11-07/hedera-profile.json')));
const directory=await fs.mkdtemp(path.join(root,'contracts/phase1/artifacts/arkiv-browser-'));
const auth="const auth={ready:true,authenticated:true,getAccessToken:async()=> 'isolated-fixture',walletAddress:null};export const useRelayAuth=()=>auth;";
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/components/agent-control-center';createRoot(document.getElementById('root')).render(<Panel view="Integrations"/>);`,resolveDir:path.join(root,'frontend'),loader:'tsx'},bundle:true,format:'esm',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY':JSON.stringify('')},outfile:path.join(directory,'bundle.js'),alias:{'@':path.join(root,'frontend/src')},plugins:[{name:'account-fixture-only',setup(b){b.onResolve({filter:/privy-auth-context/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:auth,loader:'js'}));}}]});
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/api/workbench'){res.setHeader('content-type','application/json');res.end(JSON.stringify({credentials:[],config:defaultConfig}));return;}
  if(req.url==='/bundle.js'||req.url==='/bundle.css'){res.setHeader('content-type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await fs.readFile(path.join(directory,req.url.slice(1))));return;}
  res.setHeader('content-type','text/html');res.end('<html><head><link rel="stylesheet" href="/bundle.css"><style>body{background:#101018;color:white;font:16px system-ui;padding:24px}button{color:white;background:#242438;padding:10px;border-radius:8px}section{padding:20px;border:1px solid #444;margin:16px 0}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
 }catch{res.statusCode=500;res.end('Fixture unavailable');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.JANUS_CHROMIUM_PATH?{executablePath:process.env.JANUS_CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];
 page.on('request',r=>{if(new URL(r.url()).hostname.endsWith('arkiv.network'))requests.push({host:new URL(r.url()).hostname,method:r.method()});});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Read directory',exact:true}).click();
 await page.getByRole('heading',{name:'Worker profiles',exact:true}).waitFor({timeout:20000}).catch(async error=>{console.error(JSON.stringify({body:await page.locator('body').innerText(),pageErrors:errors,rpcRequests:requests},null,2));throw error;});
 const body=await page.locator('body').innerText();
 assert.ok(body.toLowerCase().includes(publication.writer.toLowerCase()),'Published writer must appear in the actual UI');
 assert.ok(requests.length>0,'Browser must query the live Arkiv RPC');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(directory,'directory.png'),fullPage:true});
 const result={status:'passed',checkedAt:new Date().toISOString(),scope:'actual React component and live public Arkiv SDK reads; account/API fixture; no browser publication or authenticated-user proof',writer:publication.writer,expectedEntity:publication.entityKey,rpcRequests:requests,pageErrors:errors};
 await fs.writeFile(path.join(root,'backend/arkiv/evidence/2026-11-07/browser-read.json'),JSON.stringify(result,null,2)+'\n');
 await fs.copyFile(path.join(directory,'directory.png'),path.join(root,'backend/arkiv/evidence/2026-11-07/browser-directory.png'));
 console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
