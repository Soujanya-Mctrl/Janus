import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createMerchantHandler } from '../lib/merchant.mjs';

test('merchant HTTP flow preserves facilitator reconciliation on paid retries', async t => {
  let settled = false;
  let submissions = 0;
  const facilitator = {
    requirements: { scheme: 'exact', network: 'hedera:testnet' },
    supported: { kinds: [] },
    // A consumed reservation cannot pass a fresh preflight. Its journal can still
    // return the original confirmed settlement; /premium must reach that path.
    verify: async () => ({ isValid: !settled }),
    settle: async payment => {
      if (payment.authorization !== 'fixture-reservation') return { success: false, errorReason: 'invalid_payload' };
      if (!settled) { submissions++; settled = true; }
      return { success: true, transaction: 'fixture-original-transaction', network: 'hedera:testnet' };
    },
  };
  const server = http.createServer(createMerchantHandler(facilitator));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const paidHeaders = { 'payment-signature': Buffer.from(JSON.stringify({ authorization: 'fixture-reservation' })).toString('base64') };

  await t.test('unpaid request returns a challenge without settlement', async () => {
    const response = await fetch(`${base}/premium`);
    assert.equal(response.status, 402);
    assert.ok(response.headers.get('payment-required'));
    assert.equal(submissions, 0);
  });
  await t.test('paid request and retry return the same original transaction', async () => {
    const first = await fetch(`${base}/premium`, { headers: paidHeaders });
    assert.equal(first.status, 200);
    const original = await first.json();
    assert.equal((await facilitator.verify()).isValid, false);
    const retry = await fetch(`${base}/premium`, { headers: paidHeaders });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), original);
    assert.ok(retry.headers.get('payment-response'));
    assert.equal(submissions, 1);
  });
  await t.test('invalid JSON and rejected authorization do not release the resource', async () => {
    const malformed = await fetch(`${base}/premium`, { headers: { 'payment-signature': 'not-json' } });
    assert.equal(malformed.status, 400);
    const rejected = await fetch(`${base}/premium`, { headers: {
      'payment-signature': Buffer.from(JSON.stringify({ authorization: 'wrong' })).toString('base64'),
    } });
    assert.equal(rejected.status, 402);
    assert.equal((await rejected.json()).error, 'invalid_payload');
    assert.equal(submissions, 1);
  });
  await t.test('explicit verify route remains available and unknown paths return 404', async () => {
    const verified = await fetch(`${base}/verify`, { method: 'POST', body: JSON.stringify({ paymentPayload: {}, paymentRequirements: {} }) });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).isValid, false);
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
  });
});
