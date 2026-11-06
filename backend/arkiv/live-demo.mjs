import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { rabdi } from '@arkiv-network/sdk/chains';
import { createArkivDirectory } from './directory.mjs';

// Explicit opt-in command: only discovery publication is live; all payments are local.
const evidence = fileURLToPath(new URL('../.runner-state/arkiv-live/', import.meta.url));
await fs.mkdir(evidence, { recursive: true, mode: 0o700 });
try {
 const key = process.env.ARKIV_WRITER_PRIVATE_KEY;
 if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? '')) throw new Error('Configure ARKIV_WRITER_PRIVATE_KEY in backend/.env.arkiv first');
 const account = privateKeyToAccount(key);
 const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' }), transport: http(undefined, { timeout: 12000, retryCount: 0 }) });
 if (await client.getBalance({ address: account.address }) === 0n) throw new Error(`Fund dedicated Rabdi writer ${account.address} with test tGLM first`);
 const registry = createArkivDirectory();
 // Query before spending gas, then publish a profile explicitly advertising the LOCAL demo network.
 await registry.query({ network: 'eip155:1337' });
 const publication = await registry.publish({ account, name: 'Janus local-handoff test worker', network: 'eip155:1337' });
 await fs.writeFile(`${evidence}/publication.json`, JSON.stringify({ generatedAt: new Date().toISOString(), writer: account.address,
  network: 'Rabdi discovery only; local EVM treasury/payments', ...publication }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
 let found = false;
 for (let attempt = 0; attempt < 6; attempt++) {
  const snapshot = await registry.query({ network: 'eip155:1337' });
  if (snapshot.records.some(record => record.entityKey === publication.entityKey)) {
   await fs.writeFile(`${evidence}/query.json`, JSON.stringify(snapshot, null, 2) + '\n'); found = true; break;
  }
  await new Promise(resolve => setTimeout(resolve, 1500));
 }
 if (!found) throw new Error('Publication not discoverable yet; retain publication.json and retry the independent query before another publication');
 const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('../hedera/test/checkpoint-runner.test.mjs', import.meta.url))], {
  stdio: 'inherit', env: { ...process.env, JANUS_ARKIV_LIVE_DEMO: '1', JANUS_ARKIV_ENTITY_KEY: publication.entityKey, JANUS_DEMO_EVIDENCE_DIR: evidence },
 });
 process.exitCode = result.status ?? 1;
 console.log(`Evidence: ${evidence}. Discovery used Rabdi; treasury and paid results used a local EVM. No live Hedera payment occurred.`);
} catch (error) {
 const message = error.message ?? '';
 console.error(/^(Configure|Fund dedicated|Publication not)/.test(message) ? message : 'Live Arkiv demo failed. Retain any publication evidence and check RPC connectivity/configuration before retrying.');
 process.exitCode = 1;
}
