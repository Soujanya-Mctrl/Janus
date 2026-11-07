import { runtimeDeployment, sameDeployment } from '../../../shared/runtime-deployment.mjs';

export async function loadBrowserDeployment() {
 const response = await fetch('/api/deployment', { cache: 'no-store' });
 if (!response.ok) throw new Error('Deployment unavailable or inconsistent');
 const data = await response.json();
 const config = runtimeDeployment({ manifest: data.deployment, browserRpcUrl: data.chain?.rpcUrls?.default?.http?.[0] });
 if (config.chain.id !== data.chain.id || !sameDeployment(config.deployment, data.deployment)) throw new Error('Deployment configuration mismatch');
 return config;
}
