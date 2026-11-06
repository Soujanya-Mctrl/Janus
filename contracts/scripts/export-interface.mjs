import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compile } from '../phase1/scripts/compile.mjs';

const artifacts = compile();
const dir = new URL('../../shared/protocol/', import.meta.url);
const abi = artifacts.TaskTreasury.abi;
const abiText = JSON.stringify(abi, null, 2) + '\n';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sources = ['TaskTreasury', 'HederaTaskTreasury'];
const manifest = {
  schemaVersion: 1, interfaceVersion: '1.0.0', compiler: artifacts.TaskTreasury.compiler,
  abiSha256: sha256(abiText), authorization: ['bytes32 taskId', 'bytes32 operationId', 'uint64 attempt'],
  authorizationBytes: 96, tokenDecimals: 6,
  sourceSha256: Object.fromEntries(sources.map(name => [name, sha256(fs.readFileSync(new URL(`../phase1/contracts/${name}.sol`, import.meta.url)))])),
};
const files = { 'task-treasury-abi.json': abiText, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' };
for (const [name, value] of Object.entries(files)) {
  const target = new URL(name, dir);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== value) throw new Error(`Stale shared interface: ${name}`);
  } else fs.writeFileSync(target, value);
}
console.log(process.argv.includes('--check') ? 'Shared treasury interface matches Solidity' : 'Exported shared treasury interface');
