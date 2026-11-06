import { test } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, defineChain, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { compile } from '../scripts/compile.mjs';
import { treasuryClient, treasuryAbi, encodeAuthorization } from '../../../backend/lib/treasury.mjs';

test('shared ABI supports direct owner recovery while pending payment survives without services', async () => {
  const artifacts = compile();
  assert.deepEqual(treasuryAbi, artifacts.TaskTreasury.abi);
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337, hardfork: 'shanghai' }, wallet: { deterministic: true } });
  try {
    const chain = defineChain({ id: 1337, name: 'Local test', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://localhost'] } } });
    const transport = custom(provider);
    const publicClient = createPublicClient({ chain, transport, pollingInterval: 10, cacheTime: 0 });
    const wallets = Object.values(provider.getInitialAccounts()).map(a => createWalletClient({ chain, transport, account: privateKeyToAccount(a.secretKey) }));
    const [owner, worker, merchant, outsider] = wallets;
    const confirmed = async hash => { const receipt = await publicClient.waitForTransactionReceipt({ hash }); assert.equal(receipt.status, 'success'); return receipt; };
    const deploy = async (name, args = []) => (await confirmed(await owner.deployContract({ ...artifacts[name], args }))).contractAddress;
    const token = await deploy('TestToken');
    const address = await deploy('TaskTreasury', [token]);
    const write = async (wallet, functionName, args) => confirmed(await wallet.writeContract({ address, abi: treasuryAbi, functionName, args }));
    await confirmed(await owner.writeContract({ address: token, abi: artifacts.TestToken.abi, functionName: 'approve', args: [address, 100n] }));
    await write(owner, 'deposit', [100n]);
    const taskId = keccak256(stringToHex('offline-recovery'));
    const operationId = keccak256(stringToHex('pending-purchase'));
    await write(owner, 'createTask', [taskId, worker.account.address, merchant.account.address, 100n, 20n]);
    await write(worker, 'reserve', [taskId, operationId, keccak256(stringToHex('request')), 10n, 1n, 1n, 300n]);
    const client = treasuryClient({ publicClient, walletClient: owner, address, chainId: 1337 });
    const wrongOwner = treasuryClient({ publicClient, walletClient: outsider, address, chainId: 1337 });
    await assert.rejects(wrongOwner.cancel(taskId), /Owner wallet mismatch/);
    await assert.rejects(treasuryClient({ publicClient, address }).verify(), /network mismatch/);
    assert.deepEqual(await client.recoverAvailable(taskId), { released: 90n, withdrawn: 90n, reserved: 10n });
    const state = await client.task(taskId);
    assert.equal(state.cancelled, true); assert.equal(state.returned, 90n); assert.equal(state.reserved, 10n);
    assert.equal(await client.read('totalWithdrawn'), 90n);
    assert.equal(await client.read('accountedBalance'), 10n);
    const authorization = encodeAuthorization(taskId, operationId, 1n);
    assert.equal((authorization.length - 2) / 2, 96);
    await write(outsider, 'executeTransfer', [address, token, merchant.account.address, 10n, authorization]);
    assert.equal((await client.task(taskId)).spent, 10n);
    assert.equal(await client.read('accountedBalance'), 0n);
    assert.deepEqual(await client.recoverAvailable(taskId), { released: 0n, withdrawn: 0n, reserved: 0n });
  } finally { await provider.disconnect(); }
});
