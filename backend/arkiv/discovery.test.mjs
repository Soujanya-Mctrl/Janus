import assert from 'node:assert/strict';
import { test } from 'node:test';
import { custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createArkivDirectory } from './directory.mjs';
import { discoverReplacement } from './discovery.mjs';

const worker = privateKeyToAccount(`0x${'12'.repeat(32)}`), impostor = privateKeyToAccount(`0x${'13'.repeat(32)}`);
const entityKey = `0x${'ab'.repeat(32)}`;
const profile = { entityKey, address: worker.address, owner: worker.address, updatedAtBlock: '90', expiresAtBlock: '110',
 validUntil: '2000', network: 'eip155:296', scheme: 'janus-task-v1', role: 'researcher', status: 'ready', capabilities: ['research'] };
const options = records => ({ directory: { query: async () => ({ chainId: 7794095, source: 'fixture-not-testnet', block: '100', queriedAt: '1000', records }) },
 network: 'eip155:296', taskId: `0x${'cd'.repeat(32)}`, treasury: `0x${'11'.repeat(20)}`, epoch: 1n,
 authorize: async () => true, probe: async ({ message }) => ({ busy: false, signature: await worker.signMessage({ message }) }), now: () => 1000n });

test('signed readiness is bound to the task, treasury, epoch, entity and fresh nonce', async () => {
 const messages = [];
 const run = () => discoverReplacement({ ...options([profile]), probe: async ({ message }) => {
  messages.push(message); return { busy: false, signature: await worker.signMessage({ message }) };
 } });
 assert.equal((await run()).selected.address, worker.address);
 await run();
 assert.notEqual(JSON.parse(messages[0]).nonce, JSON.parse(messages[1]).nonce);
 const data = JSON.parse(messages[0]);
 assert.equal(data.entityKey, entityKey); assert.equal(data.epoch, '1'); assert.equal(data.ready, true);
 assert.equal(data.taskId, options([]).taskId); assert.equal(data.treasury, options([]).treasury);
});

test('ownership, lease seconds, expiry blocks, compatibility and policy reject unsafe workers', async () => {
 const cases = [
  { owner: impostor.address }, { validUntil: '1000' }, { expiresAtBlock: '100' },
  { capabilities: ['other'] }, { network: 'eip155:1' }, { scheme: 'other' }, { status: 'busy' },
  { updatedAtBlock: '101' }, { validUntil: 'NaN' }, { entityKey: 'bad' },
 ];
 for (const change of cases) assert.equal((await discoverReplacement(options([{ ...profile, ...change }]))).status, 'waiting', JSON.stringify(change));
 assert.equal((await discoverReplacement({ ...options([profile]), failedWorker: worker.address })).status, 'waiting');
 assert.equal((await discoverReplacement({ ...options([profile]), authorize: async () => false })).status, 'waiting');
});

test('copied signatures, busy and unreachable workers cannot be selected; RPC failure has no fallback', async () => {
 const signature = await worker.signMessage({ message: 'unrelated readiness' });
 for (const probe of [async () => ({ signature, busy: false }), async ({ message }) => ({ signature: await impostor.signMessage({ message }), busy: false }),
  async ({ message }) => ({ signature: await worker.signMessage({ message }), busy: true }), async () => { throw new Error('offline'); }]) {
  assert.equal((await discoverReplacement({ ...options([profile]), probe })).status, 'waiting');
 }
 assert.equal((await discoverReplacement(options([]))).status, 'waiting');
 await assert.rejects(() => discoverReplacement({ ...options([profile]), directory: { query: async () => { throw new Error('RPC offline'); } } }), /RPC offline/);
});

test('duplicate publications resolve deterministically to the newest valid wallet record', async () => {
 const newer = { ...profile, entityKey: `0x${'ef'.repeat(32)}`, updatedAtBlock: '95' };
 for (const records of [[profile, newer], [newer, profile]]) assert.equal((await discoverReplacement(options(records))).selected.entityKey, newer.entityKey);
});

test('expired readiness response and lease expiry during the probe are rejected', async () => {
 let time = 1000n;
 assert.equal((await discoverReplacement({ ...options([profile]), now: () => time, probe: async ({ message }) => {
  time += 31n; return { busy: false, signature: await worker.signMessage({ message }) };
 } })).status, 'waiting');
 time = 1000n;
 assert.equal((await discoverReplacement({ ...options([{ ...profile, validUntil: '1010' }]), now: () => time, probe: async ({ message }) => {
  time += 11n; return { busy: false, signature: await worker.signMessage({ message }) };
 } })).status, 'waiting');
});

test('real SDK sends typed v2 filters and decodes expiry as blocks', async () => {
 const calls = [];
 const attributes = Object.entries({ 'arkiv.schema': 'janus.worker.v2', worker: worker.address, role: 'researcher', status: 'ready',
  capabilities: 'research', network: 'eip155:296', scheme: 'janus-task-v1', validUntil: '0x7d0', name: 'Research worker' })
  .map(([name, value]) => ({ name, value, type: name === 'worker' ? 'addr' : name === 'validUntil' ? 'u64' : 'str' }));
 const directory = createArkivDirectory({ accessKey: '', transport: custom({ request: async request => {
  calls.push(request);
  if (request.method === 'eth_chainId') return '0x76edaf';
  if (request.method === 'eth_blockNumber') return '0x64';
  if (request.method === 'arkiv_query') return { blockNumber: '0x64', data: [{ key: entityKey, owner: worker.address, updatedAt: '0x5a', expiresAt: '0x6e', attributes }] };
  throw new Error('Unexpected RPC method');
 } }, { retryCount: 0 }) });
 const snapshot = await directory.query({ network: 'eip155:296', now: 1000n });
 assert.equal(snapshot.records[0].expiresAtBlock, '110');
 assert.equal(snapshot.records[0].validUntil, '2000');
 const query = calls.find(call => call.method === 'arkiv_query').params[0];
 assert.match(query, /janus.worker.v2/); assert.match(query, /validUntil > u64\(1000\)/); assert.match(query, /network = str\('eip155:296'\)/);
});

test('SDK pagination counts schema-skipped rows and refuses a truncated directory', async () => {
 const offsets = [];
 let saturated = false;
 const directory = createArkivDirectory({ accessKey: '', transport: custom({ request: async request => {
  if (request.method === 'eth_chainId') return '0x76edaf';
  if (request.method === 'eth_blockNumber') return '0x64';
  if (request.method === 'arkiv_query') {
   const offset = Number(BigInt(request.params[1].offset)); offsets.push(offset);
   return { blockNumber: '0x64', data: saturated || offset === 0 ? Array.from({ length: 100 }, () => ({ key: entityKey, attributes: [] })) : [] };
  }
  throw new Error('Unexpected RPC method');
 } }, { retryCount: 0 }) });
 assert.deepEqual((await directory.query({ network: 'eip155:296', now: 1000n })).records, []);
 assert.deepEqual(offsets, [0, 100]);
 saturated = true; offsets.length = 0;
 await assert.rejects(() => directory.query({ network: 'eip155:296', now: 1000n }), /exceeds 1000/);
 assert.equal(offsets.length, 10);
});

test('wrong-chain RPC is rejected before querying a directory', async () => {
 const methods = [];
 const directory = createArkivDirectory({ accessKey: '', transport: custom({ request: async ({ method }) => { methods.push(method); return '0x1'; } }, { retryCount: 0 }) });
 await assert.rejects(() => directory.query({ network: 'eip155:296' }), /chain mismatch/);
 assert.deepEqual(methods, ['eth_chainId']);
});
