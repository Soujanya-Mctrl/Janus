import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { encodeAbiParameters } from 'viem';
import { treasuryInterface, taskTreasuryAbi, encodeAuthorization, decodeAuthorization } from '../lib/treasury.mjs';
import { chain, NETWORK, TOKEN, TOKEN_ID } from '../lib/config.mjs';

test('backend consumes the shared chain, asset, version and task ABI', () => {
  const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
  assert.equal(chain.id, network.chainId); assert.equal(NETWORK, network.network);
  assert.equal(TOKEN.toLowerCase(), network.token.address); assert.equal(TOKEN_ID, network.token.id);
  assert.equal(BigInt(TOKEN), BigInt(TOKEN_ID.split('.')[2]));
  assert.deepEqual(taskTreasuryAbi.find(entry => entry.name === 'tasks').outputs.map(field => field.name), treasuryInterface.taskFields);
  assert.equal(treasuryInterface.authorizationBytes, 96);
  const task = '0x' + '11'.repeat(32), operation = '0x' + '22'.repeat(32);
  const encoded = encodeAuthorization(task, operation, '42');
  assert.equal(encoded, encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }], [task, operation, 42n]));
  assert.equal(decodeAuthorization(encoded).attempt, '42');
  const manifest = JSON.parse(fs.readFileSync(new URL('../../../shared/deployments/hedera-testnet.json', import.meta.url), 'utf8'));
  const proof = JSON.parse(fs.readFileSync(new URL('../../../contracts/phase1/evidence/live-proof.json', import.meta.url), 'utf8'));
  assert.equal(manifest.chainId, network.chainId);
  assert.equal(manifest.abiHash, treasuryInterface.abiHash);
  assert.equal(manifest.treasury, proof.deployment.vault);
  assert.equal(manifest.runtimeCodeHash, proof.deployment.runtimeCodeHash);
  assert.equal(manifest.owner.toLowerCase(), proof.final.taskA[6].toLowerCase());
  assert.equal(manifest.freshlyVerified, false);
});
