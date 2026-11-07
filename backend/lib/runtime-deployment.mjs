import fs from 'node:fs/promises';
import { createPublicClient, defineChain, http } from 'viem';
import { runtimeDeployment, sameDeployment } from '../../shared/runtime-deployment.mjs';
import { validateTreasury } from '../../contracts/phase1/lib/recovery-core.mjs';

export async function loadRuntimeDeployment({ env = process.env, verify = true } = {}) {
 const file = env.JANUS_DEPLOYMENT_FILE;
 if (!file && (env.JANUS_BROWSER_RPC_URL || env.JANUS_RPC_URL || env.JANUS_MERCHANT_URL)) throw new Error('Custom services require JANUS_DEPLOYMENT_FILE');
 const manifest = file ? JSON.parse(await fs.readFile(file, 'utf8')) : undefined;
 if (manifest?.mode === 'local' && (!env.JANUS_BROWSER_RPC_URL || !env.JANUS_RPC_URL || !env.JANUS_MERCHANT_URL)) throw new Error('Local deployment requires browser RPC, service RPC and merchant URL');
 const config = runtimeDeployment({ manifest, browserRpcUrl: env.JANUS_BROWSER_RPC_URL });
 const serviceRpcUrl = env.JANUS_RPC_URL || config.chain.rpcUrls.default.http[0];
 const publicClient = createPublicClient({ chain: defineChain(config.chain), transport: http(serviceRpcUrl, { timeout: 10000, retryCount: 0 }), cacheTime: 0 });
 if (verify) {
  await validateTreasury(publicClient, config.deployment);
  if (env.JANUS_MERCHANT_URL) {
   const response = await fetch(new URL('/deployment', env.JANUS_MERCHANT_URL), { signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store' });
   if (!response.ok || !sameDeployment(config.deployment, await response.json())) throw new Error('Merchant deployment mismatch');
  }
 }
 return { ...config, publicClient, serviceRpcUrl, merchantUrl: env.JANUS_MERCHANT_URL };
}
