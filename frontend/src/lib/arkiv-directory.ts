import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { addr, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import { and, eq, gt } from '@arkiv-network/sdk/query';
import { custom, http, type Address, type EIP1193Provider } from 'viem';
import spec from '../../../shared/arkiv-worker.json';
import { loadBrowserDeployment } from './runtime-deployment.mjs';
import { publicWorkerProfile } from '../../../shared/public-worker-profile.mjs';

export interface ArkivProfileRecord {
  $key: string;
  $owner?: string;
  $expiresAt?: bigint | number;
  worker: { value: string };
  role: { value: string };
  status: { value: string };
  capabilities: { value: string };
  validUntil: { value: bigint | number };
  name: { value: string };
}

export interface WorkerProfile {
  entityKey: string;
  owner: string;
  expiresAt: string;
  validUntil: string;
  worker: string;
  role: string;
  status: string;
  capabilities: string;
  name: string;
}

export const WorkerProfiles = defineSchema(spec.schema, {
  worker: addr().indexed(), role: str().indexed(), status: str().indexed(),
  capabilities: str().indexed(), network: str().indexed(), scheme: str().indexed(), validUntil: u64().indexed(), name: str(),
});
export async function listArkivWorkers(): Promise<WorkerProfile[]> {
  const { deployment } = await loadBrowserDeployment();
  const client = createPublicClient({ chain: rabdi({ accessKey: process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY ?? '' }), transport: http(undefined, { timeout: 12000, retryCount: 0 }) });
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const result = await client.select({ $key: true, $owner: true, $expiresAt: true, worker: true, role: true, status: true, capabilities: true, validUntil: true, name: true })
    .from(WorkerProfiles).where(and(eq('role', spec.role), eq('status', 'ready'), eq('capabilities', spec.capability),
      eq('network', `eip155:${deployment.chainId}`), eq('scheme', spec.scheme), gt('validUntil', u64(BigInt(Math.floor(Date.now() / 1000)))))).limit(20).fetch();
  const entities = result.entities as unknown as ArkivProfileRecord[];
  return entities.filter(row => row.$owner?.toLowerCase() === row.worker.value.toLowerCase() && row.$expiresAt !== undefined && row.$expiresAt > block)
    .map(row => ({ entityKey: row.$key, owner: row.$owner ?? '', expiresAt: String(row.$expiresAt), validUntil: String(row.validUntil.value),
    worker: row.worker.value, role: row.role.value, status: row.status.value, capabilities: row.capabilities.value, name: row.name.value }));
}
export async function registerArkivWorker(provider: Pick<EIP1193Provider, 'request'>, address: Address, name: string) {
  const { deployment } = await loadBrowserDeployment();
  const profile = publicWorkerProfile({ worker: address, name, network: `eip155:${deployment.chainId}` });
  const chain = rabdi({ accessKey: '' });
  const wallet = createWalletClient({ chain, transport: custom(provider), account: address });
  await wallet.addChain({ chain });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chain.id.toString(16)}` }] });
  return wallet.createEntity(WorkerProfiles, { ...profile, worker: addr(address), validUntil: u64(BigInt(profile.validUntil)) },
    { expiration: ExpirationTime.fromHours(1) });
}
