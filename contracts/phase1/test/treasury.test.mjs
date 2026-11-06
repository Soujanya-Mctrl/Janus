import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain, encodeFunctionData, decodeErrorResult, keccak256, stringToHex, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { compile } from '../scripts/compile.mjs';
import { projectLedger } from '../../../shared/accounting-model.mjs';
import { encodeAuthorization } from '../../../shared/protocol.mjs';
import { executeRecovery, planRecovery } from '../lib/recovery.mjs';
import fsSync from 'node:fs';

const artifacts = compile();
const U = 1_000_000n;
const id = value => keccak256(stringToHex(value));
const TASK = Object.fromEntries(['A', 'B', 'C', 'D'].map(name => [name, id(`task-${name}`)]));
const authorization = (task, operation, attempt = 1n) => encodeAuthorization(task, operation, attempt.toString());
const chain = defineChain({ id: 1337, name: 'RelayBudget LOCAL', nativeCurrency: { name: 'Local Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } });
const taskFields = ['cap', 'available', 'reserved', 'spent', 'returned', 'perOperationLimit', 'worker', 'merchant', 'epoch', 'cancelled'];

async function fixture(run, tokenName = 'TestToken') {
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 10 } });
  try {
    const transport = custom(provider);
    const publicClient = createPublicClient({ chain, transport, pollingInterval: 10, cacheTime: 0 });
    const addresses = await provider.request({ method: 'eth_accounts', params: [] });
    const keys = provider.getInitialAccounts();
    const wallets = addresses.map(a => createWalletClient({ chain, transport, account: privateKeyToAccount(keys[a].secretKey) }));
    const abi = artifacts.TaskTreasury.abi;
    const receipt = async hash => { const r = await publicClient.waitForTransactionReceipt({ hash }); assert.equal(r.status, 'success'); return r; };
    const deploy = async (name, args = []) => (await receipt(await wallets[0].deployContract({ abi: artifacts[name].abi, bytecode: artifacts[name].bytecode, args }))).contractAddress;
    const token = await deploy(tokenName);
    const vault = await deploy('TaskTreasury', [token]);
    const tokenCall = async (name, args = [], index = 0) => receipt(await wallets[index].writeContract({ address: token, abi: artifacts[tokenName].abi, functionName: name, args }));
    const balance = a => publicClient.readContract({ address: token, abi: artifacts[tokenName].abi, functionName: 'balanceOf', args: [a] });
    const read = (name, args = []) => publicClient.readContract({ address: vault, abi, functionName: name, args });
    const send = async (index, name, args = []) => receipt(await wallets[index].writeContract({ address: vault, abi, functionName: name, args }));
    const rejected = async (index, name, args, expected) => assert.rejects(() => provider.request({ method: 'eth_call', params: [{ from: addresses[index], to: vault, data: encodeFunctionData({ abi, functionName: name, args }) }, 'latest'] }), e => {
      const data = typeof e.data === 'string' ? e.data : e.data?.result;
      assert.ok(data, 'Expected an actual EVM revert');
      assert.match(decodeErrorResult({ abi, data }).errorName, expected); return true;
    });
    const task = async taskId => Object.fromEntries((await read('tasks', [taskId])).map((v, i) => [taskFields[i], v]));
    await tokenCall('approve', [vault, 1_000n * U]);
    await send(0, 'deposit', [1_000n * U]);
    for (const [name, workerIndex, merchantIndex, cap] of [['A', 1, 5, 100n], ['B', 2, 6, 200n], ['C', 3, 5, 150n], ['D', 4, 6, 150n]]) {
      await send(0, 'createTask', [TASK[name], addresses[workerIndex], addresses[merchantIndex], cap * U, 100n * U]);
    }
    const reserve = (worker, taskId, operation, amount, epoch = 1n, attempt = 1n, ttl = 120n, request = id('request')) => send(worker, 'reserve', [taskId, operation, request, amount * U, epoch, attempt, ttl]);
    const pay = async (taskId, operation, amount, attempt = 1n) => send(8, 'executeTransfer', [vault, token, (await task(taskId)).merchant, amount * U, authorization(taskId, operation, attempt)]);
    async function accounting(taskIds = Object.values(TASK)) {
      let free = 0n, reserved = 0n, spent = 0n;
      for (const taskId of taskIds) {
        const t = await task(taskId);
        assert.equal(t.cap, t.available + t.reserved + t.spent + t.returned);
        free += t.available; reserved += t.reserved; spent += t.spent;
      }
      const root = {};
      for (const name of ['deposited', 'unallocated', 'totalAvailable', 'totalReserved', 'totalSpent', 'totalWithdrawn', 'accountedBalance']) root[name] = await read(name);
      assert.equal(root.totalAvailable, free); assert.equal(root.totalReserved, reserved); assert.equal(root.totalSpent, spent);
      assert.equal(root.accountedBalance, root.unallocated + free + reserved);
      assert.equal(root.deposited, root.accountedBalance + spent + root.totalWithdrawn);
      assert.ok(await balance(vault) >= root.accountedBalance);
      return root;
    }
    await run({ provider, publicClient, wallets, addresses, token, vault, read, send, task, reserve, pay, rejected, accounting, balance, tokenCall });
  } finally { await provider.disconnect(); }
}

test('Phase 1: isolated task budgets and owner-controlled financial recovery', async t => {
  const report = { status: 'running', network: 'LOCAL EVM ONLY', compiler: artifacts.TaskTreasury.compiler, generatedAt: new Date().toISOString(), checks: [], liveDeployment: false };
  const path = new URL('../artifacts/treasury-tests.json', import.meta.url);
  await fs.mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  const save = () => fs.writeFile(path, JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  await save();
  const check = async (name, run, tokenName) => t.test(name, async () => {
    try { await fixture(run, tokenName); report.checks.push({ name, status: 'passed' }); }
    catch (error) { report.checks.push({ name, status: 'failed', error: error.shortMessage ?? error.message }); throw error; }
  });

  await check('canonical 1000-unit treasury: A handoff and recovery preserve B, C and D', async f => {
    assert.equal(await f.read('unallocated'), 400n * U);
    await f.reserve(1, TASK.A, id('A-paid'), 20n); await f.pay(TASK.A, id('A-paid'), 20n);
    await f.reserve(1, TASK.A, id('A-pending'), 10n);
    await f.reserve(2, TASK.B, id('B-paid'), 5n); await f.pay(TASK.B, id('B-paid'), 5n);
    await f.reserve(3, TASK.C, id('C-paid'), 7n); await f.pay(TASK.C, id('C-paid'), 7n);
    await f.reserve(4, TASK.D, id('D-paid'), 9n); await f.pay(TASK.D, id('D-paid'), 9n);
    const others = await Promise.all([TASK.B, TASK.C, TASK.D].map(f.task));
    await f.send(0, 'assignWorker', [TASK.A, f.addresses[2]]);
    await f.rejected(1, 'reserve', [TASK.A, id('stale'), id('r'), U, 1n, 1n, 120n], /Unauthorized/);
    const a = await f.task(TASK.A);
    assert.equal(a.available, 70n * U); assert.equal(a.reserved, 10n * U); assert.equal(a.spent, 20n * U); assert.equal(a.epoch, 2n);
    await f.send(0, 'cancelTask', [TASK.A]);
    await f.send(0, 'releaseAvailable', [TASK.A, 70n * U]);
    const before = await f.balance(f.addresses[0]);
    const withdrawal = await f.send(0, 'withdrawUnallocated', [70n * U]);
    assert.equal(await f.balance(f.addresses[0]), before + 70n * U);
    await f.pay(TASK.A, id('A-pending'), 10n);
    assert.deepEqual(await Promise.all([TASK.B, TASK.C, TASK.D].map(f.task)), others);
    const root = await f.accounting();
    assert.equal(root.totalSpent, 51n * U); assert.equal(root.totalWithdrawn, 70n * U);
    assert.equal(await f.balance(f.vault), 879n * U); assert.equal(root.unallocated, 400n * U);
    report.canonical = { taskA: await f.task(TASK.A), otherTasks: others, treasury: root, tokenBalance: await f.balance(f.vault), withdrawalTransaction: withdrawal.transactionHash };
  });
  await check('budgets and per-operation limits cannot borrow from other tasks', async f => {
    await f.reserve(1, TASK.A, id('all-A'), 100n);
    await f.rejected(1, 'reserve', [TASK.A, id('extra'), id('r'), U, 1n, 1n, 120n], /Unavailable/);
    await f.rejected(2, 'reserve', [TASK.B, id('too-big'), id('r'), 101n * U, 1n, 1n, 120n], /Unavailable/);
    await f.rejected(1, 'reserve', [TASK.B, id('wrong-worker'), id('r'), U, 1n, 1n, 120n], /Unauthorized/);
    await f.rejected(0, 'createTask', [id('excess'), f.addresses[1], f.addresses[5], 401n * U, U], /Unavailable/);
    await f.rejected(0, 'createTask', [TASK.A, f.addresses[1], f.addresses[5], U, U], /InvalidTask/);
    await f.accounting();
  });
  await check('scheduler can assign workers but cannot alter money or owner policy', async f => {
    await f.send(0, 'setScheduler', [f.addresses[7]]);
    await f.send(7, 'assignWorker', [TASK.A, f.addresses[2]]);
    await f.rejected(7, 'withdrawUnallocated', [U], /Unauthorized/);
    await f.rejected(7, 'releaseAvailable', [TASK.A, U], /Unauthorized/);
    await f.rejected(7, 'cancelTask', [TASK.A], /Unauthorized/);
    await f.rejected(7, 'createTask', [id('scheduler-task'), f.addresses[7], f.addresses[5], U, U], /Unauthorized/);
    await f.rejected(7, 'setScheduler', [f.addresses[7]], /Unauthorized/);
    await f.send(0, 'setScheduler', [zeroAddress]);
    await f.rejected(7, 'assignWorker', [TASK.A, f.addresses[1]], /Unauthorized/);
    await f.send(0, 'assignWorker', [TASK.A, f.addresses[1]]);
    await f.rejected(1, 'reserve', [TASK.A, id('old-epoch'), id('r'), U, 1n, 1n, 120n], /Unavailable/);
    assert.equal((await f.task(TASK.B)).epoch, 1n);
    await f.accounting();
  });
  await check('same operation ID is task-scoped and exact payment fields cannot change', async f => {
    const op = id('shared-operation');
    await f.reserve(1, TASK.A, op, 20n); await f.reserve(2, TASK.B, op, 30n);
    const to = (await f.task(TASK.A)).merchant;
    await f.rejected(8, 'executeTransfer', [f.addresses[0], f.token, to, 20n * U, authorization(TASK.A, op)], /InvalidOperation/);
    await f.rejected(8, 'executeTransfer', [f.vault, zeroAddress, to, 20n * U, authorization(TASK.A, op)], /InvalidOperation/);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, f.addresses[6], 20n * U, authorization(TASK.A, op)], /InvalidOperation/);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, to, 21n * U, authorization(TASK.A, op)], /Unavailable/);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, to, 20n * U, authorization(TASK.B, op)], /InvalidOperation/);
    await f.pay(TASK.A, op, 20n); await f.pay(TASK.B, op, 30n);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, to, 20n * U, authorization(TASK.A, op)], /Unavailable/);
    await f.rejected(1, 'reserve', [TASK.A, op, id('changed'), 20n * U, 1n, 2n, 120n], /InvalidOperation/);
    assert.equal(await f.balance(f.addresses[5]), 20n * U); assert.equal(await f.balance(f.addresses[6]), 30n * U);
    await f.accounting();
  });
  await check('expiry boundary and retry attempts fence old payment authorizations', async f => {
    const op = id('retry'); await f.reserve(1, TASK.A, op, 10n, 1n, 1n, 10n);
    await f.rejected(1, 'reserve', [TASK.A, op, id('request'), 10n * U, 1n, 2n, 120n], /InvalidOperation/);
    await f.rejected(8, 'expire', [TASK.A, op, 1n], /Unavailable/);
    const original = await f.read('getOperation', [TASK.A, op]);
    await f.provider.request({ method: 'evm_setTime', params: [Number(original.deadline) * 1000] });
    await f.provider.request({ method: 'evm_mine', params: [] });
    const block = await f.provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
    assert.equal(BigInt(block.timestamp), original.deadline);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, f.addresses[5], 10n * U, authorization(TASK.A, op)], /Unavailable/);
    await f.send(8, 'expire', [TASK.A, op, 1n]);
    await f.rejected(1, 'reserve', [TASK.A, op, id('different'), 10n * U, 1n, 2n, 120n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, op, id('request'), 11n * U, 1n, 2n, 120n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, op, id('request'), 10n * U, 1n, 3n, 120n], /InvalidOperation/);
    await f.reserve(1, TASK.A, op, 10n, 1n, 2n);
    await f.rejected(8, 'expire', [TASK.A, op, 1n], /Unavailable/);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, f.addresses[5], 10n * U, authorization(TASK.A, op, 1n)], /Unavailable/);
    await f.pay(TASK.A, op, 10n, 2n);
    await f.rejected(1, 'reserve', [TASK.A, op, id('request'), 10n * U, 1n, 3n, 120n], /InvalidOperation/);
    assert.equal(await f.balance(f.addresses[5]), 10n * U); await f.accounting();
  });
  await check('owner recovery protects reservations and releases expired funds from cancelled tasks', async f => {
    const beforeB = await f.task(TASK.B); const op = id('cancel-pending');
    await f.reserve(1, TASK.A, op, 30n, 1n, 1n, 10n);
    await f.send(0, 'cancelTask', [TASK.A]);
    await f.rejected(0, 'releaseAvailable', [TASK.A, 100n * U], /Unavailable/);
    await f.rejected(1, 'reserve', [TASK.A, id('cancelled'), id('r'), U, 2n, 1n, 120n], /Unavailable/);
    await f.rejected(0, 'assignWorker', [TASK.A, f.addresses[2]], /InvalidTask/);
    await f.send(0, 'releaseAvailable', [TASK.A, 70n * U]);
    await f.send(0, 'withdrawUnallocated', [470n * U]);
    await f.rejected(0, 'withdrawUnallocated', [U], /Unavailable/);
    await f.provider.request({ method: 'evm_increaseTime', params: [11] }); await f.provider.request({ method: 'evm_mine', params: [] });
    await f.send(8, 'expire', [TASK.A, op, 1n]);
    await f.rejected(8, 'expire', [TASK.A, op, 1n], /Unavailable/);
    await f.send(0, 'releaseAvailable', [TASK.A, 30n * U]); await f.send(0, 'withdrawUnallocated', [30n * U]);
    assert.deepEqual(await f.task(TASK.B), beforeB);
    const root = await f.accounting(); assert.equal(root.totalWithdrawn, 500n * U); assert.equal(await f.balance(f.vault), 500n * U);
  });
  await check('released budget can fund a fresh task; unsolicited tokens do not inflate accounting', async f => {
    await f.send(0, 'releaseAvailable', [TASK.A, 40n * U]);
    const fresh = id('fresh-task'); await f.send(0, 'createTask', [fresh, f.addresses[2], f.addresses[6], 40n * U, 10n * U]);
    await f.reserve(2, fresh, id('fresh-buy'), 5n); await f.pay(fresh, id('fresh-buy'), 5n);
    const before = await f.read('accountedBalance');
    await f.tokenCall('transfer', [f.vault, 13n * U]);
    assert.equal(await f.read('accountedBalance'), before);
    assert.equal(await f.balance(f.vault), before + 13n * U);
    await f.accounting([...Object.values(TASK), fresh]);
  });
  await check('invalid task policies and malformed reservations never change accounting', async f => {
    const zero = `0x${'00'.repeat(32)}`;
    await f.rejected(0, 'createTask', [zero, f.addresses[1], f.addresses[5], U, U], /InvalidTask/);
    await f.rejected(0, 'createTask', [id('bad-policy'), f.addresses[1], f.addresses[5], U, 2n * U], /InvalidTask/);
    await f.rejected(0, 'createTask', [id('self-pay'), f.addresses[1], f.vault, U, U], /InvalidTask/);
    await f.rejected(0, 'assignWorker', [TASK.A, zeroAddress], /InvalidTask/);
    await f.rejected(1, 'reserve', [id('missing'), id('op'), id('r'), U, 1n, 1n, 120n], /InvalidTask/);
    await f.rejected(1, 'reserve', [TASK.A, zero, id('r'), U, 1n, 1n, 120n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, id('op'), zero, U, 1n, 1n, 120n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, id('op'), id('r'), 0n, 1n, 1n, 120n], /Unavailable/);
    await f.rejected(1, 'reserve', [TASK.A, id('op'), id('r'), U, 1n, 0n, 120n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, id('op'), id('r'), U, 1n, 1n, 0n], /InvalidOperation/);
    await f.rejected(1, 'reserve', [TASK.A, id('op'), id('r'), U, 1n, 1n, 301n], /InvalidOperation/);
    assert.equal(await f.read('unallocated'), 400n * U); await f.accounting();
  });
  await check('non-exact tokens revert deposit/payment/withdrawal and preserve accounting', async f => {
    await f.tokenCall('setTaxed', [true]);
    await f.tokenCall('approve', [f.vault, U]);
    await f.rejected(0, 'deposit', [U], /NonExactTransfer/);
    await f.reserve(1, TASK.A, id('taxed'), 20n);
    await f.rejected(8, 'executeTransfer', [f.vault, f.token, f.addresses[5], 20n * U, authorization(TASK.A, id('taxed'))], /NonExactTransfer/);
    await f.rejected(0, 'withdrawUnallocated', [U], /NonExactTransfer/);
    assert.equal((await f.read('getOperation', [TASK.A, id('taxed')])).status, 1);
    assert.equal(await f.balance(f.addresses[5]), 0n); await f.accounting();
    await f.tokenCall('setTaxed', [false]); await f.pay(TASK.A, id('taxed'), 20n); await f.accounting();
  }, 'AdversarialToken');

  await check('seeded contract transitions match independent event-history accounting after every action', async f => {
    const events = [{ type: 'deposit', amount: 1000n * U },
      ...[['A', 100n], ['B', 200n], ['C', 150n], ['D', 150n]].map(([name, amount]) => ({ type: 'create', taskId: TASK[name], amount: amount * U, limit: 100n * U }))];
    const workers = { A: 1, B: 2, C: 3, D: 4 };
    const compare = async () => {
      const model = projectLedger(events);
      for (const name of ['deposited', 'unallocated', 'totalAvailable', 'totalReserved', 'totalSpent', 'totalWithdrawn', 'accountedBalance']) assert.equal(await f.read(name), model[name], name);
      assert.equal(await f.balance(f.vault), model.tokenBalance);
      for (const taskId of Object.values(TASK)) {
        const actual = await f.task(taskId);
        for (const [field, expected] of Object.entries(model.tasks[taskId])) assert.equal(actual[field], expected, `${taskId}:${field}`);
      }
    };
    await compare();
    for (const seed of [7, 19, 41]) {
      let random = seed;
      for (let step = 0; step < 6; step++) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        const name = ['A', 'B', 'C', 'D'][random % 4], taskId = TASK[name], operationId = id(`model:${seed}:${step}`);
        const amount = BigInt(1 + random % 4), epoch = (await f.task(taskId)).epoch;
        await f.reserve(workers[name], taskId, operationId, amount, epoch, 1n, 300n);
        events.push({ type: 'reserve', taskId, operationId, amount: amount * U, epoch, attempt: 1n, fingerprint: 'fixed' }); await compare();
        if (random & 8) {
          workers[name] = workers[name] === 1 ? 2 : 1;
          await f.send(0, 'assignWorker', [taskId, f.addresses[workers[name]]]); events.push({ type: 'assign', taskId }); await compare();
        }
        if (random % 3 === 0) {
          await f.provider.request({ method: 'evm_increaseTime', params: [301] }); await f.provider.request({ method: 'evm_mine', params: [] });
          await f.send(8, 'expire', [taskId, operationId, 1n]); events.push({ type: 'expire', taskId, operationId, attempt: 1n });
        } else { await f.pay(taskId, operationId, amount); events.push({ type: 'settle', taskId, operationId, attempt: 1n }); }
        await compare();
      }
    }
    const release = (await f.task(TASK.A)).available / 2n;
    await f.send(0, 'releaseAvailable', [TASK.A, release]); events.push({ type: 'release', taskId: TASK.A, amount: release }); await compare();
    const withdraw = projectLedger(events).unallocated / 3n;
    await f.send(0, 'withdrawUnallocated', [withdraw]); events.push({ type: 'withdraw', amount: withdraw }); await compare();
    await f.tokenCall('transfer', [f.vault, 7n * U]); events.push({ type: 'donate', amount: 7n * U }); await compare();
    await f.send(0, 'cancelTask', [TASK.A]); events.push({ type: 'cancel', taskId: TASK.A }); await compare();
    report.modelSeeds = [7, 19, 41];
  });
  const recoveryManifest = async f => {
    const descriptor = JSON.parse(fsSync.readFileSync(new URL('../../../shared/treasury-interface.json', import.meta.url), 'utf8'));
    assert.deepEqual(descriptor.abi, artifacts.TaskTreasury.abi);
    return { interfaceVersion: descriptor.interfaceVersion, abiHash: descriptor.abiHash, mode: 'local', chainId: 1337,
      treasury: f.vault, token: f.token, owner: f.addresses[0], runtimeCodeHash: keccak256(await f.publicClient.getBytecode({ address: f.vault })) };
  };
  await check('independent owner recovery validates deployment, preserves pending obligations and resumes after expiry', async f => {
    const manifest = await recoveryManifest(f), operation = id('direct-recovery-pending');
    await f.reserve(1, TASK.A, operation, 30n, 1n, 1n, 300n);
    const args = { publicClient: f.publicClient, walletClient: f.wallets[0], manifest, taskId: TASK.A, operationIds: [operation] };
    for (const changed of [{ chainId: 296 }, { owner: f.addresses[1] }, { token: f.addresses[5] }, { runtimeCodeHash: id('wrong-code') }, { abiHash: id('wrong-abi') }]) {
      await assert.rejects(() => planRecovery({ ...args, manifest: { ...manifest, ...changed } }));
    }
    await assert.rejects(() => executeRecovery({ ...args, walletClient: f.wallets[1] }), /not the owner/);
    const others = await Promise.all([TASK.B, TASK.C, TASK.D].map(f.task));
    const before = await f.balance(f.addresses[0]);
    const first = await executeRecovery(args);
    assert.deepEqual(first.receipts.map(receipt => receipt.action), ['cancelTask', 'releaseAvailable', 'withdrawUnallocated']);
    assert.equal(first.task.reserved, (30n * U).toString());
    assert.equal(await f.balance(f.addresses[0]), before + 470n * U);
    await f.provider.request({ method: 'evm_increaseTime', params: [301] }); await f.provider.request({ method: 'evm_mine', params: [] });
    const second = await executeRecovery(args);
    assert.deepEqual(second.receipts.map(receipt => receipt.action), ['expire', 'releaseAvailable', 'withdrawUnallocated']);
    assert.equal(await f.balance(f.addresses[0]), before + 500n * U);
    assert.deepEqual(await Promise.all([TASK.B, TASK.C, TASK.D].map(f.task)), others);
    assert.deepEqual((await executeRecovery(args)).receipts, []);
    report.directRecovery = { network: 'LOCAL EVM ONLY', applicationServicesUsed: false, first: first.receipts, afterExpiry: second.receipts };
  });
  await check('recovery restart after release-before-withdraw retrieves unallocated reserve', async f => {
    const manifest = await recoveryManifest(f);
    await f.send(0, 'cancelTask', [TASK.A]); await f.send(0, 'releaseAvailable', [TASK.A, 100n * U]);
    const result = await executeRecovery({ publicClient: f.publicClient, walletClient: f.wallets[0], manifest, taskId: TASK.A });
    assert.deepEqual(result.receipts.map(receipt => receipt.action), ['withdrawUnallocated']);
    assert.equal(await f.read('totalWithdrawn'), 500n * U); await f.accounting();
  });

  report.status = report.checks.every(c => c.status === 'passed') ? 'passed' : 'failed'; report.finishedAt = new Date().toISOString();
  await save(); assert.equal(report.status, 'passed');
});
