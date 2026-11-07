// Test-only, actual local chain and merchant; no remote provider or public-network writes.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import httpServer from 'node:http';
import { once } from 'node:events';
import { createPublicClient, createWalletClient, defineChain, custom, keccak256 } from 'viem';
import { createFixtureRpc } from '../../contracts/phase1/test/fixtures/local-rpc.mjs';
import { account, mnemonic } from '../docker/common.mjs';
import { createTaskMerchant, taskMerchantHandler, requestHash } from '../hedera/lib/task-merchant.mjs';
import descriptor from '../../shared/treasury-interface.json' with { type: 'json' };

export async function paidFixture() {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-paid-dashboard-'));
 const rpc = createFixtureRpc({ mnemonic }); await rpc.listen(0, '127.0.0.1');
 const rpcUrl = `http://127.0.0.1:${rpc.address().port}`;
 const chain = defineChain({ id: 1337, name: 'Local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
 const transport = custom(rpc.provider), client = createPublicClient({ chain, transport, cacheTime: 0, pollingInterval: 100 });
 const wallet = index => createWalletClient({ account: account(index), chain, transport });
 const artifact = async name => JSON.parse(await fs.readFile(new URL(`../../contracts/phase1/artifacts/${name}.json`, import.meta.url), 'utf8'));
 const receipt = hash => client.waitForTransactionReceipt({ hash });
 const tokenArtifact = await artifact('TestToken'), treasuryArtifact = await artifact('TaskTreasury');
 const token = (await receipt(await wallet(0).deployContract(tokenArtifact))).contractAddress;
 const deployed = await receipt(await wallet(0).deployContract({ ...treasuryArtifact, args: [token] }));
 const manifest = { mode: 'local', chainId: 1337, interfaceVersion: descriptor.interfaceVersion, abiHash: descriptor.abiHash,
  treasury: deployed.contractAddress, token, owner: account(0).address, runtimeCodeHash: keccak256(await client.getBytecode({ address: deployed.contractAddress })), deploymentBlock: deployed.blockNumber.toString() };
 await receipt(await wallet(0).writeContract({ address: token, abi: tokenArtifact.abi, functionName: 'approve', args: [manifest.treasury, 1000000000n] }));
 await receipt(await wallet(0).writeContract({ address: manifest.treasury, abi: treasuryArtifact.abi, functionName: 'deposit', args: [1000000000n] }));
 const manifestFile = path.join(directory, 'deployment.json'); await fs.writeFile(manifestFile, JSON.stringify(manifest));
 const merchant = await createTaskMerchant({ directory: path.join(directory, 'merchant'), publicClient: client, walletClient: wallet(3), manifest, confirmations: 1,
  produce: async ({ request }) => ({ schemaVersion: '1', requestHash: requestHash(request), dataset: request.body, content: 'Reference source: available funds exclude reserved commitments and settled spending; epochs fence old workers.' }) });
 const handler = taskMerchantHandler(merchant);
 const server = httpServer.createServer((req, res) => { if (req.url === '/deployment') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(manifest)); } else void handler(req, res); });
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const env = { JANUS_LOCAL_RESEARCH: '1', JANUS_DEPLOYMENT_FILE: manifestFile, JANUS_RPC_URL: rpcUrl,
  JANUS_BROWSER_RPC_URL: rpcUrl, JANUS_MERCHANT_URL: `http://127.0.0.1:${server.address().port}`, JANUS_WORKBENCH_STATE_DIR: path.join(directory, 'workbench') };
 return { directory, root: env.JANUS_WORKBENCH_STATE_DIR, env, manifest, client, wallet,
  async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rpc.close(); await fs.rm(directory, { recursive: true, force: true }); } };
}
