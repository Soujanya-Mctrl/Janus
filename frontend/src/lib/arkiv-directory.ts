import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { addr, defineSchema, str } from '@arkiv-network/sdk/schema';
import { and, eq } from '@arkiv-network/sdk/query';
import { custom, http, type Address, type EIP1193Provider } from 'viem';

export const WorkerProfiles = defineSchema('janus.worker.v1', {
  worker: addr().indexed(), role: str().indexed(), status: str().indexed(),
  capabilities: str().indexed(), name: str(),
});
export async function listArkivWorkers() {
  const client = createPublicClient({ chain: rabdi({ accessKey: process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY ?? '' }), transport: http(undefined, { timeout: 12000, retryCount: 0 }) });
  const result = await client.select({ $key: true, $owner: true, $expiresAt: true, worker: true, role: true, status: true, capabilities: true, name: true })
    .from(WorkerProfiles).where(and(eq('role', 'researcher'), eq('status', 'ready'))).limit(20).fetch();
  return result.entities.map(row => ({ entityKey: row.$key, owner: row.$owner, expiresAt: String(row.$expiresAt),
    worker: row.worker.value, role: row.role.value, status: row.status.value, capabilities: row.capabilities.value, name: row.name.value }));
}
export async function registerArkivWorker(provider: Pick<EIP1193Provider, 'request'>, address: Address, name: string) {
  if (!name.trim() || name.length > 50) throw new Error('Enter a worker name of up to 50 characters');
  const chain = rabdi({ accessKey: '' });
  const wallet = createWalletClient({ chain, transport: custom(provider), account: address });
  await wallet.addChain({ chain });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chain.id.toString(16)}` }] });
  return wallet.createEntity(WorkerProfiles, { worker: addr(address), role: 'researcher', status: 'ready', capabilities: 'research', name: name.trim() },
    { expiration: ExpirationTime.fromHours(1) });
}
