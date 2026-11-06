import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseUnits, encodeAuthorization, decodeAuthorization, canonicalJson, operationId, taskSnapshot } from '../protocol.mjs';
import { projectLedger } from '../accounting-model.mjs';

const taskId = '0x' + '01'.repeat(32), op = '0x' + 'ab'.repeat(32);
test('wire integers and 96-byte authorization reject ambiguity and overflow', () => {
  const encoded = encodeAuthorization(taskId, op, '7');
  assert.equal(encoded.length, 194);
  assert.deepEqual(decodeAuthorization(encoded), { taskId, operationId: op, attempt: '7' });
  for (const amount of [7, '01', '-1', '1.2', ' 1', (1n << 256n).toString()]) assert.throws(() => baseUnits(amount));
  for (const attempt of ['0', (1n << 64n).toString()]) assert.throws(() => encodeAuthorization(taskId, op, attempt));
  assert.throws(() => decodeAuthorization('0x' + '01'.repeat(32)));
  assert.throws(() => encodeAuthorization('0x' + '00'.repeat(32), op, '1'));
  assert.throws(() => decodeAuthorization(encoded.slice(0, 130) + 'f'.repeat(64)));
});
test('canonical operation identity survives worker changes and is domain scoped', async () => {
  const input = { chainId: '296', treasury: '0x' + '12'.repeat(20), taskId, stepId: 'dataset:1' };
  const id = await operationId(input);
  assert.equal(await operationId({ ...input, epoch: '9', worker: 'replacement' }), id);
  for (const changed of [{ chainId: '1' }, { treasury: '0x' + '13'.repeat(20) }, { taskId: op }, { stepId: 'dataset:2' }]) {
    assert.notEqual(await operationId({ ...input, ...changed }), id);
  }
  assert.equal(canonicalJson({ z: ['2'], a: '1' }), '{"a":"1","z":["2"]}');
  assert.equal(canonicalJson({ b: true, a: null }), canonicalJson({ a: null, b: true }));
  for (const value of [1, 1.2, undefined, { x: undefined }, new Date(), Array(1)]) assert.throws(() => canonicalJson(value));
});
test('task wire accounting keeps returned-to-reserve distinct from withdrawal', () => {
  const task = taskSnapshot([100n, 70n, 10n, 20n, 0n, 30n, 'worker', 'merchant', 2n, false]);
  assert.equal(task.available, '70'); assert.equal(task.reserved, '10'); assert.equal(task.epoch, '2');
  assert.equal(task.returned, '0'); assert.equal(task.withdrawn, undefined);
});

const seedEvents = [
  { type: 'deposit', amount: 1000n },
  ...[['A', 100n], ['B', 200n], ['C', 150n], ['D', 150n]].map(([taskId, amount]) => ({ type: 'create', taskId, amount, limit: 100n })),
];
test('independent model derives pending obligations and recovery from history', () => {
  const events = [...seedEvents,
    { type: 'reserve', taskId: 'A', operationId: 'paid', amount: 20n, epoch: 1n, attempt: 1n, fingerprint: 'one' },
    { type: 'settle', taskId: 'A', operationId: 'paid', attempt: 1n },
    { type: 'reserve', taskId: 'A', operationId: 'pending', amount: 10n, epoch: 1n, attempt: 1n, fingerprint: 'two' },
    { type: 'assign', taskId: 'A' }, { type: 'cancel', taskId: 'A' },
    { type: 'release', taskId: 'A', amount: 70n }, { type: 'withdraw', amount: 470n }];
  const model = projectLedger(events);
  assert.deepEqual(model.tasks.A, { cap: 100n, available: 0n, reserved: 10n, spent: 20n, returned: 70n, epoch: 3n, cancelled: true });
  assert.equal(model.totalWithdrawn, 470n); assert.equal(model.accountedBalance, 510n);
  assert.equal(model.tasks.B.available, 200n);
  assert.throws(() => projectLedger([...events, { type: 'withdraw', amount: 1n }]));
  assert.throws(() => projectLedger([...events, { type: 'reserve', taskId: 'A', operationId: 'stale', amount: 1n, epoch: 1n, attempt: 1n }]));
  assert.throws(() => projectLedger([...events, { type: 'settle', taskId: 'A', operationId: 'paid', attempt: 1n }]));
  const expired = projectLedger([...events, { type: 'expire', taskId: 'A', operationId: 'pending', attempt: 1n }]);
  assert.equal(expired.tasks.A.available, 10n); assert.equal(expired.tasks.A.returned, 70n);
});
test('model conservation across 100 fixed-seed histories', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const events = [...seedEvents];
    let random = seed;
    for (let step = 0; step < 20; step++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const taskId = ['A', 'B', 'C', 'D'][random % 4], operationId = `${seed}:${step}`;
      events.push({ type: 'reserve', taskId, operationId, amount: 1n, epoch: 1n, attempt: 1n, fingerprint: operationId });
      events.push({ type: random % 3 ? 'settle' : 'expire', taskId, operationId, attempt: 1n });
      const model = projectLedger(events);
      assert.equal(model.deposited, model.accountedBalance + model.totalSpent + model.totalWithdrawn);
      for (const task of Object.values(model.tasks)) assert.equal(task.cap, task.available + task.reserved + task.spent + task.returned);
    }
  }
});
