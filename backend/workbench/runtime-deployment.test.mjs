import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import httpServer from 'node:http';
import { once } from 'node:events';
import { createPublicClient, createWalletClient, custom, defineChain, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createFixtureRpc } from '../../contracts/phase1/test/fixtures/local-rpc.mjs';
import { loadRuntimeDeployment } from '../lib/runtime-deployment.mjs';
import { runtimeDeployment } from '../../shared/runtime-deployment.mjs';
import descriptor from '../../shared/treasury-interface.json' with { type: 'json' };

test('runtime pins one deployment across service RPC, browser configuration and merchant', async t => {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-deployment-'));
 t.after(() => fs.rm(directory, { recursive: true, force: true }));
 const rpc = createFixtureRpc(); await rpc.listen(0, '127.0.0.1'); t.after(() => rpc.close());
 const rpcUrl = `http://127.0.0.1:${rpc.address().port}`;
 const chain = defineChain({ id: 1337, name: 'Local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
 const transport = custom(rpc.provider), client = createPublicClient({ chain, transport });
 const account = privateKeyToAccount(Object.values(rpc.provider.getInitialAccounts())[0].secretKey);
 const wallet = createWalletClient({ account, chain, transport });
 const artifact = async name => JSON.parse(await fs.readFile(new URL(`../../contracts/phase1/artifacts/${name}.json`, import.meta.url), 'utf8'));
 const receipt = hash => client.waitForTransactionReceipt({ hash });
 const token = (await receipt(await wallet.deployContract(await artifact('TestToken')))).contractAddress;
 const deployed = await receipt(await wallet.deployContract({ ...await artifact('TaskTreasury'), args: [token] }));
 const manifest = { mode: 'local', chainId: 1337, interfaceVersion: descriptor.interfaceVersion, abiHash: descriptor.abiHash,
  treasury: deployed.contractAddress, token, owner: account.address, runtimeCodeHash: keccak256(await client.getBytecode({ address: deployed.contractAddress })), deploymentBlock: deployed.blockNumber.toString(), secret: 'must-not-be-public' };
 let merchantManifest = manifest;
 const merchant = httpServer.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(merchantManifest)); });
 merchant.listen(0, '127.0.0.1'); await once(merchant, 'listening');
 t.after(() => { merchant.closeAllConnections(); return new Promise(resolve => merchant.close(resolve)); });
 const file = path.join(directory, 'deployment.json'); await fs.writeFile(file, JSON.stringify(manifest));
 const env = { JANUS_DEPLOYMENT_FILE: file, JANUS_RPC_URL: rpcUrl, JANUS_BROWSER_RPC_URL: 'http://localhost:18545', JANUS_MERCHANT_URL: `http://127.0.0.1:${merchant.address().port}` };
 const config = await loadRuntimeDeployment({ env });
 assert.equal(config.deployment.treasury, manifest.treasury);
 assert.equal(config.chain.rpcUrls.default.http[0], 'http://localhost:18545/');
 assert.equal(config.serviceRpcUrl, rpcUrl);
 assert.equal(config.deployment.secret, undefined);
 assert.equal(config.deployment.deploymentBlock, manifest.deploymentBlock);
 merchantManifest = { ...manifest, treasury: token };
 await assert.rejects(loadRuntimeDeployment({ env }), /Merchant deployment mismatch/);
 merchantManifest = manifest;
 for (const patch of [{ chainId: 31337 }, { owner: token }, { token: account.address }, { runtimeCodeHash: '0x' + '00'.repeat(32) }]) {
  await fs.writeFile(file, JSON.stringify({ ...manifest, ...patch }));
  await assert.rejects(loadRuntimeDeployment({ env }), /mismatch/);
 }
 await assert.rejects(loadRuntimeDeployment({ env: { JANUS_RPC_URL: rpcUrl } }), /require JANUS_DEPLOYMENT_FILE/);
 await assert.rejects(loadRuntimeDeployment({ env: { ...env, JANUS_BROWSER_RPC_URL: '' } }), /requires browser RPC/);
 assert.throws(() => runtimeDeployment({ manifest, browserRpcUrl: 'http://user:secret@localhost:8545' }), /without credentials/);
});
