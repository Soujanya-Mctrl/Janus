import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { rabdi } from '@arkiv-network/sdk/chains';
import { createArkivDirectory, spec } from './directory.mjs';

const command = process.argv[2] ?? 'query';
const network = process.env.ARKIV_WORKER_NETWORK ?? 'eip155:296';
try {
 const directory = createArkivDirectory();
 if (command === 'query') console.log(JSON.stringify(await directory.query({ network }), null, 2));
 else if (command === 'preflight' || command === 'publish') {
  const key = process.env.ARKIV_WRITER_PRIVATE_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? '')) throw new Error('Configure a dedicated testnet ARKIV_WRITER_PRIVATE_KEY in backend/.env.arkiv');
  const account = privateKeyToAccount(key);
  const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' }), transport: http(undefined, { timeout: 12000, retryCount: 0 }) });
  if (await client.getChainId() !== spec.chainId) throw new Error('Arkiv chain mismatch');
  const balance = await client.getBalance({ address: account.address });
  if (balance === 0n) throw new Error(`Fund dedicated Rabdi writer ${account.address} with test tGLM through https://hub.arkiv.network/faucet`);
  if (command === 'preflight') console.log(JSON.stringify({ chainId: spec.chainId, writer: account.address, balanceWei: balance.toString(), network, writes: false }, null, 2));
  else console.log(JSON.stringify({ writer: account.address, network,
   ...await directory.publish({ account, name: process.env.ARKIV_WORKER_NAME ?? 'Janus research worker', network }) }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
 } else throw new Error('Use query, preflight or publish');
} catch (error) {
 // SDK transport errors can contain private RPC access URLs; only print our own setup errors.
 const message = error.message ?? '';
 console.error(/^(Configure|Fund dedicated|Arkiv chain mismatch|Use query)/.test(message) ? message : 'Arkiv request failed. Check connectivity, access-key configuration and testnet status. No fallback was used.');
 process.exitCode = 1;
}
