import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createOperationStore } from '../hedera/lib/operation-store.mjs';
import { createCheckpointRunner } from '../runner/checkpoint-runner.mjs';
import { encodeAuthorization } from '../../shared/protocol.mjs';

test('missing external keys cannot reset a financial checkpoint or start another payment', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'janus-key-loss-'));
  const previous = process.env.JANUS_DATA_KEYRING_FILE;
  process.env.JANUS_DATA_KEYRING_FILE = path.join(directory, 'missing-keyring');
  t.after(async () => {
    if (previous === undefined) delete process.env.JANUS_DATA_KEYRING_FILE; else process.env.JANUS_DATA_KEYRING_FILE = previous;
    await fs.rm(directory, { recursive: true, force: true });
  });
  const taskId = '0x' + '11'.repeat(32), operationId = '0x' + '22'.repeat(32), treasury = '0x' + '33'.repeat(20);
  let submissions = 0, reconciliations = 0;
  const merchant = createOperationStore({ directory: path.join(directory, 'merchant'), authenticate: async () => {},
    reconcile: async () => { reconciliations++; return { status: 'unpaid' }; },
    submit: async () => { submissions++; throw new Error('Must never submit'); }, produce: async () => ({}) });
  await assert.rejects(merchant.purchase({ authorization: encodeAuthorization(taskId, operationId, '1'), request: { chainId: '296', treasury }, principal: {} }), /key unavailable/);
  assert.equal(submissions, 0); assert.equal(reconciliations, 0);
  const runner = createCheckpointRunner({ directory: path.join(directory, 'checkpoints'), publicClient: {}, manifest: { chainId: 296, treasury }, taskId,
    steps: [{ id: 'paid-source', request: { chainId: '296', treasury } }], validateResult: async () => true });
  await assert.rejects(runner.inspect(), /key unavailable/);
});
