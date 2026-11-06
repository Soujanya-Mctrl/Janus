import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain, encodeAbiParameters, encodeFunctionData, decodeErrorResult, keccak256, stringToHex, zeroAddress, toFunctionSelector } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { compile } from '../scripts/compile.mjs';

const unit = 1_000_000n;
const chain = defineChain({ id: 1337, name: 'RelayBudget LOCAL ONLY', nativeCurrency: { name: 'Local Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } });
const artifacts = compile();
const id = name => keccak256(stringToHex(name));
const auth = operation => encodeAbiParameters([{ type: 'bytes32' }], [operation]);
const evidencePath = new URL('../evidence/local-payment-proof.json', import.meta.url);

async function fixture(run) {
  // Ephemeral, in-process EVM. It does not listen on a port or use user keys.
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: chain.id, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 6 } });
  try {
    const transport = custom(provider);
    const publicClient = createPublicClient({ chain, transport, pollingInterval: 10, cacheTime: 0 });
    const addresses = await provider.request({ method: 'eth_accounts', params: [] });
    const localAccounts = provider.getInitialAccounts();
    const wallets = addresses.map(address => createWalletClient({ chain, transport, account: privateKeyToAccount(localAccounts[address].secretKey) }));
    const [owner, workerA, merchant, outsider, workerB] = addresses;
    async function receipt(hash) {
      const r = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(r.status, 'success');
      return r;
    }
    async function deploy(name, args = []) {
      const r = await receipt(await wallets[0].deployContract({ ...artifacts[name], args }));
      assert.ok(r.contractAddress);
      return r.contractAddress;
    }
    const token = await deploy('TestToken');
    const vault = await deploy('PaymentProbe', [token, merchant, workerA, 100n * unit]);
    const read = (functionName, args = []) => publicClient.readContract({ address: vault, abi: artifacts.PaymentProbe.abi, functionName, args });
    const balance = account => publicClient.readContract({ address: token, abi: artifacts.TestToken.abi, functionName: 'balanceOf', args: [account] });
    const send = async (index, functionName, args = []) => receipt(await wallets[index].writeContract({ address: vault, abi: artifacts.PaymentProbe.abi, functionName, args }));
    const rejected = async (index, functionName, args, expectedError) => assert.rejects(
      () => provider.request({ method: 'eth_call', params: [{ from: addresses[index], to: vault, data: encodeFunctionData({ abi: artifacts.PaymentProbe.abi, functionName, args }) }, 'latest'] }),
      error => {
        // Inspect actual revert bytes, rather than accepting any RPC/network failure.
        const data = typeof error.data === 'string' ? error.data : error.data?.result;
        assert.ok(data, 'Expected EVM revert data');
        assert.match(decodeErrorResult({ abi: artifacts.PaymentProbe.abi, data }).errorName, expectedError);
        return true;
      },
    );
    await receipt(await wallets[0].writeContract({ address: token, abi: artifacts.TestToken.abi, functionName: 'approve', args: [vault, 100n * unit] }));
    await send(0, 'deposit', [100n * unit]);
    async function accounting() {
      const [deposited, available, reserved, spent, returned] = await Promise.all(['deposited', 'available', 'reserved', 'spent', 'returned'].map(name => read(name)));
      assert.equal(deposited, available + reserved + spent + returned);
      assert.equal(await balance(vault), available + reserved);
      return { deposited, available, reserved, spent, returned };
    }
    await run({ provider, publicClient, owner, workerA, merchant, outsider, workerB, token, vault, read, send, rejected, balance, accounting });
  } finally { await provider.disconnect(); }
}

test('Phase 0: contract-controlled local payments and independent recovery', async t => {
  const report = { status: 'running', network: 'LOCAL IN-PROCESS EVM ONLY', chainId: chain.id, liveHederaSettlement: false, x402EndToEnd: false, compiler: artifacts.PaymentProbe.compiler, generatedAt: new Date().toISOString(), checks: [] };
  const save = () => fs.writeFile(evidencePath, JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
  await fs.mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await save();
  const check = async (name, body) => {
    await t.test(name, async () => {
      try { await fixture(body); report.checks.push({ name, status: 'passed' }); }
      catch (error) { report.checks.push({ name, status: 'failed', error: error.shortMessage ?? error.message }); throw error; }
    });
  };
  await check('100 funded, 20 paid through executor, 80 withdrawn directly by owner', async f => {
    assert.equal(toFunctionSelector('executeTransfer(address,address,address,uint256,bytes)'), '0xea8f19fd');
    const operation = id('purchase-1');
    await f.send(1, 'reserve', [operation, id('request-1'), 20n * unit, 1n, 120n]);
    const paid = await f.send(3, 'executeTransfer', [f.vault, f.token, f.merchant, 20n * unit, auth(operation)]);
    assert.equal(await f.balance(f.merchant), 20n * unit);
    assert.equal((await f.accounting()).available, 80n * unit);
    const before = await f.balance(f.owner);
    const withdrawal = await f.send(0, 'withdrawAvailable', [80n * unit]);
    assert.equal(await f.balance(f.owner), before + 80n * unit);
    assert.equal(await f.balance(f.vault), 0n);
    const final = await f.accounting();
    assert.equal(final.spent, 20n * unit);
    assert.equal(final.returned, 80n * unit);
    report.scenario = { vault: f.vault, token: f.token, merchant: f.merchant, paidTx: paid.transactionHash, paidGas: paid.gasUsed, withdrawalTx: withdrawal.transactionHash, withdrawalGas: withdrawal.gasUsed, final };
  });
  await check('outsider cannot reserve, replace worker, cancel, or withdraw', async f => {
    await f.rejected(3, 'reserve', [id('bad'), id('r'), unit, 1n, 120n], /Unauthorized/);
    await f.rejected(3, 'replaceWorker', [f.outsider], /Unauthorized/);
    await f.rejected(3, 'cancel', [], /Unauthorized/);
    await f.rejected(3, 'withdrawAvailable', [unit], /Unauthorized/);
    await f.accounting();
  });
  await check('worker cannot reserve beyond available budget', async f => {
    await f.send(1, 'reserve', [id('large'), id('r'), 80n * unit, 1n, 120n]);
    await f.rejected(1, 'reserve', [id('excess'), id('r2'), 21n * unit, 1n, 120n], /Unavailable/);
    assert.equal((await f.accounting()).reserved, 80n * unit);
  });
  await check('authorization binds exact payer, asset, recipient and amount', async f => {
    const operation = id('bound');
    await f.send(1, 'reserve', [operation, id('r'), 20n * unit, 1n, 120n]);
    await f.rejected(3, 'executeTransfer', [f.owner, f.token, f.merchant, 20n * unit, auth(operation)], /InvalidPayment/);
    await f.rejected(3, 'executeTransfer', [f.vault, zeroAddress, f.merchant, 20n * unit, auth(operation)], /InvalidPayment/);
    await f.rejected(3, 'executeTransfer', [f.vault, f.token, f.outsider, 20n * unit, auth(operation)], /InvalidPayment/);
    await f.rejected(3, 'executeTransfer', [f.vault, f.token, f.merchant, 21n * unit, auth(operation)], /Unavailable/);
    assert.equal((await f.accounting()).reserved, 20n * unit);
    assert.equal(await f.balance(f.merchant), 0n);
  });
  await check('duplicate settlement and operation rebinding are rejected', async f => {
    const operation = id('once');
    await f.send(1, 'reserve', [operation, id('r'), 20n * unit, 1n, 120n]);
    await f.send(3, 'executeTransfer', [f.vault, f.token, f.merchant, 20n * unit, auth(operation)]);
    await f.rejected(3, 'executeTransfer', [f.vault, f.token, f.merchant, 20n * unit, auth(operation)], /Unavailable/);
    await f.rejected(1, 'reserve', [operation, id('changed'), unit, 1n, 120n], /InvalidPayment/);
    assert.equal(await f.balance(f.merchant), 20n * unit);
    await f.accounting();
  });
  await check('handoff fences old worker while preserving already reserved payments', async f => {
    const operation = id('pending');
    await f.send(1, 'reserve', [operation, id('r'), 10n * unit, 1n, 120n]);
    await f.send(0, 'replaceWorker', [f.workerB]);
    await f.rejected(1, 'reserve', [id('stale'), id('r'), unit, 1n, 120n], /Unauthorized/);
    await f.rejected(4, 'reserve', [id('wrong-epoch'), id('r'), unit, 1n, 120n], /Unavailable/);
    await f.send(4, 'reserve', [id('new'), id('r2'), 20n * unit, 2n, 120n]);
    await f.send(3, 'executeTransfer', [f.vault, f.token, f.merchant, 10n * unit, auth(operation)]);
    const state = await f.accounting();
    assert.equal(state.available, 70n * unit);
    assert.equal(state.reserved, 20n * unit);
    assert.equal(state.spent, 10n * unit);
  });
  await check('cancel and withdrawal cannot confiscate pending merchant commitments', async f => {
    const operation = id('obligation');
    await f.send(1, 'reserve', [operation, id('r'), 10n * unit, 1n, 120n]);
    await f.send(0, 'cancel');
    await f.rejected(1, 'reserve', [id('after-cancel'), id('r'), unit, 2n, 120n], /Unavailable/);
    await f.rejected(0, 'withdrawAvailable', [100n * unit], /Unavailable/);
    await f.send(0, 'withdrawAvailable', [90n * unit]);
    await f.send(3, 'executeTransfer', [f.vault, f.token, f.merchant, 10n * unit, auth(operation)]);
    assert.equal(await f.balance(f.merchant), 10n * unit);
    const state = await f.accounting();
    assert.equal(state.returned, 90n * unit);
    assert.equal(state.reserved, 0n);
  });
  await check('expired reservation releases once and cannot settle', async f => {
    const operation = id('expiry');
    await f.send(1, 'reserve', [operation, id('r'), 10n * unit, 1n, 10n]);
    await f.rejected(3, 'expire', [operation], /Unavailable/);
    await f.provider.request({ method: 'evm_increaseTime', params: [11] });
    await f.provider.request({ method: 'evm_mine', params: [] });
    await f.rejected(3, 'executeTransfer', [f.vault, f.token, f.merchant, 10n * unit, auth(operation)], /Unavailable/);
    await f.send(3, 'expire', [operation]);
    await f.rejected(3, 'expire', [operation], /Unavailable/);
    assert.equal((await f.accounting()).available, 100n * unit);
    await f.send(0, 'withdrawAvailable', [100n * unit]);
    await f.accounting();
  });
  await check('no reservation can be created with an unbounded deadline', async f => {
    await f.rejected(1, 'reserve', [id('bad-ttl'), id('r'), unit, 1n, 301n], /InvalidPayment/);
    await f.rejected(1, 'reserve', [id('zero-ttl'), id('r'), unit, 1n, 0n], /InvalidPayment/);
    await f.accounting();
  });
  report.status = report.checks.every(c => c.status === 'passed') ? 'passed' : 'failed';
  report.finishedAt = new Date().toISOString();
  await save();
  assert.equal(report.status, 'passed');
});
