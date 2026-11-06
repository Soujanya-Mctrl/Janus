import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transactionPolicy, merchantEndpoint } from '../lib/transaction-policy.mjs';
test('testnet fee ceiling and HTTPS endpoint guard fail closed', async () => {
 assert.deepEqual(await transactionPolicy({}, 1337), {});
 assert.equal((await transactionPolicy({ getGasPrice: async () => 1n }, 296)).type, 'legacy');
 for (const gasPrice of [0n, -1n, 4000000000001n]) await assert.rejects(() => transactionPolicy({ getGasPrice: async () => gasPrice }, 296));
 for (const url of ['https://example.com', 'http://localhost:4023', 'http://127.0.0.1:4023', 'http://[::1]:4023']) assert.ok(merchantEndpoint(url));
 for (const url of ['http://example.com', 'http://localhost.evil', 'https://user:secret@example.com', 'file:///tmp/a']) assert.throws(() => merchantEndpoint(url));
});
