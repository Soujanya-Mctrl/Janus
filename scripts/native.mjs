// Persistent local demo services, no Docker or live-network signing required.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadRuntimeDeployment } from '../backend/lib/runtime-deployment.mjs';
import { validateTreasury } from '../contracts/phase1/lib/recovery-core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.resolve(process.env.JANUS_NATIVE_DIR || path.join(root, '.tools/native'));
const chainPort = process.env.JANUS_NATIVE_RPC_PORT || '18545', merchantPort = process.env.JANUS_NATIVE_MERCHANT_PORT || '14023';
const rpc = `http://127.0.0.1:${chainPort}`, merchant = `http://127.0.0.1:${merchantPort}`;
await fs.mkdir(path.join(directory, 'keys'), { recursive: true });
for (const [file, value] of [['data.json', JSON.stringify({ active: 'native', keys: { native: randomBytes(32).toString('base64') } })], ['vault.key', randomBytes(32).toString('base64')]]) {
 try { await fs.writeFile(path.join(directory, 'keys', file), value, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
const nativeEnv = { JANUS_BIND_HOST: '127.0.0.1', JANUS_CHAIN_PORT: chainPort, JANUS_MERCHANT_PORT: merchantPort,
 JANUS_CHAIN_STATE: path.join(directory, 'chain'), JANUS_DEPLOYMENT_FILE: path.join(directory, 'chain/deployment.json'),
 JANUS_MERCHANT_STATE: path.join(directory, 'merchant'), JANUS_RPC_URL: rpc, JANUS_BROWSER_RPC_URL: rpc, JANUS_MERCHANT_URL: merchant,
 JANUS_WORKSPACE_ROOT: root, JANUS_WORKBENCH_STATE_DIR: path.join(directory, 'workbench'), JANUS_LOCAL_RESEARCH: '1', JANUS_LOCAL_DEPOSIT: '1000000000',
 JANUS_DATA_KEYRING_FILE: path.join(directory, 'keys/data.json'), JANUS_VAULT_KEY_FILE: path.join(directory, 'keys/vault.key'),
};
const env = { ...process.env, ...nativeEnv };
const children = [];
let closing = false;
const stop = () => {
 if (closing) return; closing = true;
 for (const child of children.reverse()) {
  if (child.nativeService && child.connected) child.send({ type: 'shutdown' }); else child.kill();
  const timer = setTimeout(() => { if (child.exitCode === null) child.kill(); }, 5000); timer.unref();
 }
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
function launch(script, args = [], cwd = root) {
 const nativeService = path.dirname(script) === path.join(root, 'backend/docker');
 const child = spawn(process.execPath, [script, ...args], { cwd, env, windowsHide: true, stdio: nativeService ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit' }); child.nativeService = nativeService; children.push(child);
 child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
 child.once('exit', code => { if (!closing) { process.exitCode = code || 1; stop(); } });
 return child;
}
async function ready(url) {
 for (let attempt = 0; attempt < 120; attempt++) {
  if (closing) throw new Error('Native service exited before readiness');
  try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch { /* wait for startup */ }
  await new Promise(resolve => setTimeout(resolve, 500));
 }
 throw new Error(`Native service readiness timeout: ${url}`);
}
try {
 // Refuse to attach to unrelated processes using the selected ports.
 for (const url of [rpc, merchant]) {
  try { await fetch(url, { signal: AbortSignal.timeout(500) }); throw new Error(`Port already in use: ${url}`); }
  catch (error) { if (error.message.startsWith('Port already')) throw error; }
 }
 launch(path.join(root, 'backend/docker/chain.mjs'));
 let validated = false;
 for (let attempt = 0; attempt < 120; attempt++) {
  if (closing) throw new Error('Chain exited during startup');
  try { const runtime = await loadRuntimeDeployment({ env, verify: false }); await validateTreasury(runtime.publicClient, runtime.deployment); validated = true; break; }
  catch { await new Promise(resolve => setTimeout(resolve, 500)); }
 }
 if (!validated) throw new Error('Chain deployment validation timed out');
 launch(path.join(root, 'backend/docker/server.mjs')); await ready(merchant + '/health');
 await fs.writeFile(path.join(directory, 'runtime.json'), JSON.stringify(nativeEnv, null, 2));
 console.log(`Native merchant ready: ${merchant}; chain: ${rpc}. State retained at ${directory}`);
 if (!process.argv.includes('--no-frontend')) {
  launch(path.join(root, 'frontend/node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', process.env.JANUS_NATIVE_FRONTEND_PORT || '3000'], path.join(root, 'frontend'));
 }
} catch (error) { console.error(error.message); process.exitCode = 1; stop(); }
