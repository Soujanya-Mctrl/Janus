import fs from 'node:fs';
import { createWalletClient, http, keccak256 } from 'viem';
import { assertTestnet, TOKEN, TOKEN_ID, BUDGET, role, account, artifact, tokenMetadata, saveEvidence, safeError, publicClient, rpcUrl, chain, mirror } from '../lib/config.mjs';

try {
  await assertTestnet();
  await tokenMetadata();
  if (fs.existsSync(new URL('../evidence/deployment.json', import.meta.url))) throw new Error('Deployment already recorded; refusing automatic redeployment.');
  const signer = role('OWNER');
  const owner = await account(signer.address);
  const merchant = await account(role('MERCHANT').address);
  const worker = await account(role('WORKER').address);
  const compiled = artifact();
  const pendingPath = new URL('../evidence/deployment-pending.json', import.meta.url);
  let hash;
  if (fs.existsSync(pendingPath)) {
    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    if (pending.owner !== signer.address || pending.network !== 'hedera:testnet') throw new Error('Unexpected deployment intent');
    hash = pending.hash;
  } else {
    const wallet = createWalletClient({ account: signer, chain, transport: http(rpcUrl, { timeout: 30_000, retryCount: 0 }) });
    hash = await wallet.deployContract({ abi: compiled.abi, bytecode: compiled.bytecode, args: [TOKEN, merchant.address, worker.address, BUDGET], gas: 3_000_000n, type: 'legacy', gasPrice: await publicClient.getGasPrice() });
    await saveEvidence('deployment-pending.json', { network: 'hedera:testnet', owner: signer.address, hash, submittedAt: new Date().toISOString() });
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 2_000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment transaction reverted; inspect the saved hash before retrying');
  const vault = receipt.contractAddress;
  let info;
  for (let i = 0; i < 20; i++) {
    info = await mirror(`/api/v1/contracts/${vault}`);
    if (info?.contract_id) break;
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  if (!info?.contract_id) throw new Error('Deployment confirmed but mirror indexing is pending; rerun without redeploying');
  const contractId = info.contract_id;
  const report = { network: 'hedera:testnet', deployedAt: new Date().toISOString(), contractId, vault, token: TOKEN, tokenId: TOKEN_ID,
    owner: { id: owner.id, address: signer.address }, merchant: { id: merchant.id, address: merchant.address }, worker: { id: worker.id, address: worker.address }, maximumBudget: BUDGET.toString(),
    transactionHash: hash, hashscan: `https://hashscan.io/testnet/contract/${contractId}`,
    compiler: compiled.compiler, runtimeCodeHash: keccak256(await publicClient.getBytecode({ address: vault })) };
  await saveEvidence('deployment.json', report);
  console.log(`Deployed: ${report.hashscan}`);
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
