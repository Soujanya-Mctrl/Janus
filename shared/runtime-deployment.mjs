import network from './network.json' with { type: 'json' };
import historical from './deployments/hedera-testnet.json' with { type: 'json' };
import descriptor from './treasury-interface.json' with { type: 'json' };

const address = value => /^0x[0-9a-fA-F]{40}$/.test(value ?? '') && !/^0x0{40}$/.test(value);
export function runtimeDeployment({ manifest = historical, browserRpcUrl = network.rpcUrls.default.http[0] } = {}) {
 if (manifest.interfaceVersion !== descriptor.interfaceVersion || manifest.abiHash !== descriptor.abiHash) throw new Error('Treasury interface/version mismatch');
 if (![manifest.treasury, manifest.token, manifest.owner].every(address) || !/^0x[0-9a-fA-F]{64}$/.test(manifest.runtimeCodeHash ?? '')) throw new Error('Invalid deployment identity');
 const local = manifest.mode === 'local' && [1337, 31337].includes(manifest.chainId);
 if (manifest.mode === 'local' && !local) throw new Error('Unsupported local treasury network');
 if (!local && (manifest.chainId !== network.chainId || manifest.token.toLowerCase() !== network.token.address.toLowerCase())) throw new Error('Unsupported treasury network/token');
 const url = new URL(browserRpcUrl);
 if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Browser RPC must be a public HTTP URL without credentials');
 // Explicit projection: never return arbitrary fields from a host configuration file.
 if (manifest.deploymentBlock !== undefined && !/^(0|[1-9][0-9]*)$/.test(manifest.deploymentBlock)) throw new Error('Invalid deployment block');
 const deployment = Object.fromEntries(['mode', 'chainId', 'interfaceVersion', 'abiHash', 'treasury', 'token', 'owner', 'runtimeCodeHash', 'deploymentBlock', 'taskId', 'worker', 'merchant'].filter(key => manifest[key] !== undefined).map(key => [key, manifest[key]]));
 return { deployment, chain: local ? { id: manifest.chainId, name: 'Janus local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [url.href] } }, testnet: true }
  : { id: network.chainId, name: network.name, nativeCurrency: network.nativeCurrency, rpcUrls: { default: { http: [url.href] } }, blockExplorers: network.blockExplorers, testnet: true } };
}

export function sameDeployment(left, right) {
 return ['chainId', 'interfaceVersion', 'abiHash', 'treasury', 'token', 'owner', 'runtimeCodeHash'].every(key =>
  typeof left?.[key] === 'string' ? left[key].toLowerCase() === String(right?.[key]).toLowerCase() : left?.[key] === right?.[key]);
}
