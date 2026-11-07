import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { addr, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import { and, asc, eq, gt } from '@arkiv-network/sdk/query';
import { http } from 'viem';
import spec from '../../shared/arkiv-worker.json' with { type: 'json' };
import { publicWorkerProfile } from '../../shared/public-worker-profile.mjs';

export { spec };
export const WorkerProfiles = defineSchema(spec.schema, {
 worker: addr().indexed(), role: str().indexed(), status: str().indexed(),
 capabilities: str().indexed(), network: str().indexed(), scheme: str().indexed(),
 validUntil: u64().indexed(), name: str(),
});

export function createArkivDirectory({ accessKey = process.env.ARKIV_ACCESS_KEY ?? '', transport } = {}) {
 const chain = rabdi({ accessKey });
 const rpc = transport ?? http(undefined, { timeout: 12000, retryCount: 0 });
 const client = createPublicClient({ chain, transport: rpc });
 return {
  async query({ network, capability = spec.capability, scheme = spec.scheme, now = BigInt(Math.floor(Date.now() / 1000)) }) {
   if (!/^eip155:[1-9][0-9]*$/.test(network) || capability !== spec.capability || scheme !== spec.scheme) throw new Error('Unsupported worker query');
   if (await client.getChainId() !== spec.chainId) throw new Error('Arkiv chain mismatch');
   const started = performance.now(), records = [], pages = [];
   // Bounded, ordered pagination. Never silently select from a truncated directory.
   for (let offset = 0; offset < 1000; offset += 100) {
    const page = await client.select({ $key: true, $owner: true, $expiresAt: true, $updatedAt: true,
     worker: true, role: true, status: true, capabilities: true, network: true, scheme: true, validUntil: true, name: true })
     .from(WorkerProfiles).where(and(eq('role', spec.role), eq('status', 'ready'), eq('capabilities', capability),
      eq('network', network), eq('scheme', scheme), gt('validUntil', u64(now))))
     .orderBy(asc('$key')).limit(100).offset(offset).fetch();
    pages.push({ block: String(page.blockNumber), skipped: page.skipped });
    records.push(...page.entities.map(row => ({ entityKey: row.$key, owner: row.$owner, expiresAtBlock: String(row.$expiresAt),
     updatedAtBlock: String(row.$updatedAt), address: row.worker.value, role: row.role.value, status: row.status.value,
     capabilities: [row.capabilities.value], network: row.network.value, scheme: row.scheme.value,
     validUntil: String(row.validUntil.value), name: row.name.value })));
    if (page.entities.length + page.skipped < 100) {
     return { source: 'arkiv-rabdi', chainId: spec.chainId, block: String(await client.getBlockNumber({ cacheTime: 0 })),
      queriedAt: now.toString(), latencyMs: Math.round(performance.now() - started), pages, records };
    }
   }
   throw new Error('Arkiv directory exceeds 1000 records; narrow the query');
  },
  async publish({ account, name, network }) {
   const profile = publicWorkerProfile({ worker: account.address, name, network });
   if (await client.getChainId() !== spec.chainId) throw new Error('Arkiv chain mismatch');
   const wallet = createWalletClient({ chain, transport: rpc, account });
   return wallet.createEntity(WorkerProfiles, { ...profile, worker: addr(profile.worker), validUntil: u64(BigInt(profile.validUntil)) },
    { expiration: ExpirationTime.fromHours(1) });
  },
 };
}
