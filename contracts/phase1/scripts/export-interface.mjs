import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { INTERFACE_VERSION, TASK_FIELDS } from '../../../shared/protocol.mjs';

const artifact = JSON.parse(fs.readFileSync(new URL('../artifacts/TaskTreasury.json', import.meta.url), 'utf8'));
assert.deepEqual(artifact.abi.find(entry => entry.name === 'tasks').outputs.map(field => field.name), TASK_FIELDS);
const exported = { interfaceVersion: INTERFACE_VERSION, authorizationBytes: 96, taskFields: TASK_FIELDS,
  abiHash: '0x' + createHash('sha256').update(JSON.stringify(artifact.abi)).digest('hex'), abi: artifact.abi };
const output = JSON.stringify(exported, null, 2) + '\n';
const target = new URL('../../../shared/treasury-interface.json', import.meta.url);
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(target, 'utf8'), output, 'Shared treasury interface is stale; review ABI/version then run npm run interface:export --prefix contracts');
} else fs.writeFileSync(target, output);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Exported'} ${INTERFACE_VERSION} (${exported.abiHash})`);
