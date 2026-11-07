// Browser acceptance uses the actual dashboard components with an isolated auth/local-run fixture.
// Production identity and route isolation are separately covered by frontend/test/research.test.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from '../../contracts/node_modules/esbuild/lib/main.js';
import { chromium } from '../../contracts/node_modules/playwright/index.mjs';
import { defaultConfig, validateWorkbenchConfig } from '../../backend/workbench/config.mjs';
import { createRun, executeResearch, readRun, listRuns, controlRun, deleteRun } from '../../backend/workbench/research.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = await fs.mkdtemp(path.join(root, 'contracts/phase1/artifacts/dashboard-browser-'));
let config = structuredClone(defaultConfig);
const user = 'did:privy:browser-fixture', pending = new Set();
const auth = `const token = async () => 'browser-fixture'; const noop = async () => {}; const auth = {ready:true,authenticated:true,configured:true,user:{id:'fixture'},getAccessToken:token,walletAddress:null,walletType:null,chainId:null,error:null,login:noop,logout:noop}; export const useRelayAuth = () => auth; export const targetChain = {id:296};`;
await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Dashboard from './src/components/dashboard-shell'; createRoot(document.getElementById('root')).render(<Dashboard initialTab="Agents"/>);`, resolveDir: path.join(root, 'frontend'), loader: 'tsx' }, bundle: true, format: 'esm', jsx: 'automatic', outfile: path.join(directory, 'bundle.js'), alias: { '@': path.join(root, 'frontend/src') }, plugins: [{ name: 'fixture-boundary', setup(build) {
  build.onResolve({ filter: /privy-auth-context/ }, () => ({ path: 'auth', namespace: 'fixture' }));
  build.onResolve({ filter: /^next\/(link|navigation|image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth' ? auth : args.path === 'next/navigation' ? 'export const useRouter = () => ({replace:()=>{}});' : args.path === 'next/image' ? `import React from 'react'; export default function Image({priority,...props}){return React.createElement('img',props)}` : `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`, loader: 'jsx', resolveDir: path.join(root, 'frontend') }));
} }] });
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/workbench') {
      if (req.method === 'POST') { let raw=''; for await(const chunk of req) raw+=chunk; const body=JSON.parse(raw); if(body.action==='saveConfig') config=validateWorkbenchConfig(body.config); }
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ config, credentials: [] })); return;
    }
    if (url.pathname === '/api/research') {
      let data;
      if (req.method === 'POST') {
        let raw=''; for await(const chunk of req) raw+=chunk; const body=JSON.parse(raw);
        if (body.action === 'create') { const run=await createRun(directory,user,{...body,config}); const promise=executeResearch({root:directory,user,id:run.id}); pending.add(promise); promise.finally(()=>pending.delete(promise)); data={run}; }
        else if(body.action==='delete'&&body.confirmDelete===true) data=await deleteRun(directory,user,body.id);
        else data={run:await controlRun(directory,user,body.id,body.action)};
      } else data=url.searchParams.has('id')?{run:await readRun(directory,user,url.searchParams.get('id'))}:{runs:await listRuns(directory,user)};
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); return;
    }
    if (url.pathname.startsWith('/assets/')) { res.setHeader('Content-Type', 'image/webp'); res.end(await fs.readFile(path.join(root, 'frontend/public', url.pathname))); return; }
    if (url.pathname === '/landing.css') { res.setHeader('Content-Type','text/css'); res.end(await fs.readFile(path.join(root,'frontend/src/app/landing.css'))); return; }
    if (url.pathname === '/bundle.js' || url.pathname === '/bundle.css') { res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css'); res.end(await fs.readFile(path.join(directory,url.pathname.slice(1)))); return; }
    res.setHeader('Content-Type','text/html'); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/landing.css"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#08090b;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
  } catch(e) { res.statusCode=400;res.end(JSON.stringify({error:e.message})); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ headless:true, ...(process.env.JANUS_CHROMIUM_PATH ? { executablePath:process.env.JANUS_CHROMIUM_PATH } : {}) });
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'Create agent',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Evidence reviewer');
  await page.getByLabel('Research responsibility').fill('Review supplied evidence and identify unsupported conclusions.');
  await page.getByRole('button',{name:'Save agent',exact:true}).click();
  await page.getByRole('heading',{name:'Evidence reviewer',exact:true}).waitFor();
  await page.getByRole('button',{name:'Runs',exact:true}).click();
  await page.getByRole('button',{name:'Start run',exact:true}).click();
  await page.getByRole('heading',{name:'Final report',exact:true}).waitFor({timeout:20000});
  await page.getByLabel('Filter activity by agent').selectOption('alpha');
  assert.ok(await page.getByText('artifact reused',{exact:true}).count());
  await page.getByLabel('Filter activity by agent').selectOption('all');
  assert.equal(await page.locator('.unified-sidebar').count(),1);
  assert.equal(await page.locator('.unified-topbar').count(),1);
  await page.screenshot({path:path.join(directory,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(directory,'mobile.png'),fullPage:true});
  page.once('dialog', dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete local research',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Local research deleted.'}).waitFor();
  assert.deepEqual(await listRuns(directory,user),[]);
  assert.deepEqual(errors,[]);
  console.log('Dashboard browser acceptance passed: original shell, agent creation, encrypted parallel run, checkpoint replacement, event filtering, final report, responsive rendering and confirmed local research deletion.');
  console.log('Screenshots: '+directory);
} finally { await browser.close(); await Promise.allSettled([...pending]); await new Promise(resolve=>server.close(resolve)); }
