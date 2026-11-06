import { createPublicClient, createWalletClient, custom, http, defineChain } from 'viem';
import { planRecovery, executeRecovery } from '../lib/recovery-core.mjs';
import manifest from '../../../shared/deployments/hedera-testnet.json' with { type: 'json' };
import network from '../../../shared/network.json' with { type: 'json' };
const chain = defineChain({ ...network, id: network.chainId });
let publicClient = createPublicClient({ chain, transport: http() });
const el = id => document.getElementById(id);
let inspected = '';
if (window.ethereum?.on) {
 window.ethereum.on('accountsChanged', () => invalidate());
 window.ethereum.on('chainChanged', () => invalidate());
}
const inputs = () => ({ rpcUrl: el('rpc').value.trim(), taskId: el('task').value.trim(), operationIds: el('operations').value.split(/\s+/).filter(Boolean) });
const args = () => ({ publicClient, manifest, ...inputs() });
const invalidate = () => { inspected = ''; el('execute').disabled = true; };
for (const id of ['task', 'operations', 'rpc']) el(id).addEventListener('input', invalidate);
el('inspect').onclick = async () => {
  invalidate(); el('inspect').disabled = true;
  try {
    const rpc = el('rpc').value.trim();
    if (rpc) {
      const url = new URL(rpc);
      if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error('Use HTTPS or local HTTP without embedded credentials');
    }
    publicClient = createPublicClient({ chain, transport: http(rpc || undefined) });
    const snapshot = JSON.stringify(inputs());
    const plan = await planRecovery(args());
    el('plan').textContent = JSON.stringify(plan, null, 2);
    if (snapshot === JSON.stringify(inputs())) { inspected = snapshot; el('execute').disabled = false; }
  } catch (error) { el('plan').textContent = error.message; }
  finally { el('inspect').disabled = false; }
};
el('execute').onclick = async () => {
  if (!inspected || inspected !== JSON.stringify(inputs()) || !el('consent').checked) {
    el('status').textContent = 'Inspect the current plan and acknowledge the reserve withdrawal first.'; return;
  }
  el('execute').disabled = true; el('inspect').disabled = true;
  for (const id of ['task', 'operations', 'consent', 'rpc']) el(id).disabled = true;
  try {
    if (!window.ethereum) throw new Error('An injected EVM owner wallet is required.');
    const walletClient = createWalletClient({ chain, transport: custom(window.ethereum) });
    const [account] = await walletClient.requestAddresses();
    const ownerClient = createWalletClient({ chain, account, transport: custom(window.ethereum) });
    el('status').textContent = 'Review each transaction in your wallet. Waiting for confirmed receipts.';
    const result = await executeRecovery({ ...args(), walletClient: ownerClient });
    el('status').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    el('status').textContent = `${error.message}\nExecution stopped. If submission was uncertain, reconcile the transaction in your wallet/explorer before trying again.`;
  } finally { invalidate(); el('inspect').disabled = false; el('consent').checked = false;
    for (const id of ['task', 'operations', 'consent', 'rpc']) el(id).disabled = false; }
};
