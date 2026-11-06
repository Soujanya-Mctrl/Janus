import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createOperationStore } from '../lib/operation-store.mjs';
import { encodeAuthorization } from '../../../shared/protocol.mjs';

test('durable purchase survives response loss and refuses ambiguous repurchase', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-merchant-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const authorization = encodeAuthorization('0x' + '11'.repeat(32), '0x' + '22'.repeat(32), '1');
  const request = { chainId: '296', treasury: '0x' + '33'.repeat(20), body: { dataset: 'one' } };
  let payments = 0, paid = false, fail = true;
  const receipt = { confirmed: true, transaction: 'fixture-only' };
  const adapter = { directory,
    authenticate: async ({ principal }) => { if (!['worker-a', 'worker-b'].includes(principal)) throw new Error('Unauthorized'); },
    reconcile: async () => paid ? { status: 'paid', receipt } : { status: 'unpaid' },
    submit: async () => { payments++; paid = true; return receipt; },
    produce: async () => { if (fail) throw new Error('Response lost'); return { dataset: 'immutable-data' }; },
  };
  await assert.rejects(() => createOperationStore(adapter).purchase({ authorization, request, principal: 'worker-a' }), /Response lost/);
  fail = false;
  const recovered = await createOperationStore(adapter).purchase({ authorization, request, principal: 'worker-b' });
  assert.equal(recovered.status, 'ready'); assert.equal(payments, 1);
  assert.deepEqual(await createOperationStore(adapter).purchase({ authorization, request, principal: 'worker-b' }), recovered);
  await assert.rejects(() => createOperationStore(adapter).purchase({ authorization, request: { ...request, body: { dataset: 'changed' } }, principal: 'worker-b' }), /conflict/);
  await assert.rejects(() => createOperationStore(adapter).purchase({ authorization, request, principal: 'stranger' }), /Unauthorized/);
  // Missing local records must still consult confirmed chain state before submission.
  for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
  await assert.rejects(() => createOperationStore(adapter).purchase({ authorization, request, principal: 'worker-b' }), /owner decision/);
  assert.equal(payments, 1);
  const unknown = { ...adapter, reconcile: async () => ({ status: 'unknown' }) };
  for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
  await assert.rejects(() => createOperationStore(unknown).purchase({ authorization, request, principal: 'worker-b' }), /unknown/);
  assert.equal(payments, 1);
});
