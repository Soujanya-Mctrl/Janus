import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http } from 'viem';
import { chain, rpcUrl, account } from './common.mjs';
import { buyTaskDataset } from '../hedera/lib/task-client.mjs';

const endpoint = process.env.JANUS_MERCHANT_URL || 'http://127.0.0.1:4023';
const manifest = await (await fetch(`${endpoint}/deployment`)).json();
const publicClient = createPublicClient({ chain, transport: http(rpcUrl), cacheTime: 0 });
const request = { chainId: '1337', treasury: manifest.treasury, token: manifest.token, merchant: manifest.merchant, amount: '20000', route: '/dataset', body: { dataset: 'compose-smoke' } };
const args = { publicClient, walletClient: createWalletClient({ chain, transport: http(rpcUrl), account: account(1) }), endpoint, manifest, taskId: manifest.taskId, stepId: 'compose-smoke', request };
const first = await buyTaskDataset(args);
assert.equal(first.status, 'ready');
assert.deepEqual(await buyTaskDataset(args), first);
console.log('Local purchase and original-result replay passed');
