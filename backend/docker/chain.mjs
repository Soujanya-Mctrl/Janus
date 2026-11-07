import fs from 'node:fs/promises';
import ganache from '../../contracts/node_modules/ganache/dist/node/core.js';
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { chain, mnemonic, account, rpcUrl } from './common.mjs';
import { validateTreasury } from '../../contracts/phase1/lib/recovery.mjs';

const directory = process.env.JANUS_CHAIN_STATE || '/state';
await fs.mkdir(directory, { recursive: true });
const server = ganache.server({ logging: { quiet: true }, wallet: { mnemonic }, chain: { chainId: 1337, hardfork: 'shanghai' }, database: { dbPath: `${directory}/db` } });
await server.listen(8545, '0.0.0.0');
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const wallet = createWalletClient({ chain, transport: http(rpcUrl), account: account(0) });
const file = `${directory}/deployment.json`;
try {
  await validateTreasury(publicClient, JSON.parse(await fs.readFile(file, 'utf8')));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // Fail closed after interrupted bootstrap; do not redeploy over unknown state.
  if (await publicClient.getTransactionCount({ address: wallet.account.address }) !== 0) throw new Error('Interrupted bootstrap: inspect chain before resetting both local volumes');
  const artifact = async name => JSON.parse(await fs.readFile(new URL(`../../contracts/phase1/artifacts/${name}.json`, import.meta.url), 'utf8'));
  const tokenArtifact = await artifact('TestToken'), treasuryArtifact = await artifact('TaskTreasury');
  const receipt = async hash => {
    const result = await publicClient.waitForTransactionReceipt({ hash });
    if (result.status !== 'success') throw new Error('Bootstrap transaction failed');
    return result;
  };
  const token = (await receipt(await wallet.deployContract(tokenArtifact))).contractAddress;
  const deploymentReceipt = await receipt(await wallet.deployContract({ ...treasuryArtifact, args: [token] }));
  const treasury = deploymentReceipt.contractAddress;
  await receipt(await wallet.writeContract({ address: token, abi: tokenArtifact.abi, functionName: 'approve', args: [treasury, 1000000n] }));
  await receipt(await wallet.writeContract({ address: treasury, abi: treasuryArtifact.abi, functionName: 'deposit', args: [1000000n] }));
  const taskId = keccak256(stringToHex('compose-demo'));
  await receipt(await wallet.writeContract({ address: treasury, abi: treasuryArtifact.abi, functionName: 'createTask', args: [taskId, account(1).address, account(3).address, 100000n, 20000n] }));
  const descriptor = JSON.parse(await fs.readFile(new URL('../../shared/treasury-interface.json', import.meta.url), 'utf8'));
  const manifest = { deploymentBlock: deploymentReceipt.blockNumber.toString(), mode: 'local', chainId: 1337, interfaceVersion: descriptor.interfaceVersion, abiHash: descriptor.abiHash, treasury, token, owner: wallet.account.address, runtimeCodeHash: keccak256(await publicClient.getBytecode({ address: treasury })), taskId, merchant: account(3).address, worker: account(1).address };
  await fs.writeFile(`${file}.tmp`, JSON.stringify(manifest, null, 2));
  await fs.rename(`${file}.tmp`, file);
}
console.log('Local contracts ready; manifest: /state/deployment.json');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
