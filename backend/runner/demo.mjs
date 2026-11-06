import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const directory = fileURLToPath(new URL('../.runner-state/demo/', import.meta.url));
fs.mkdirSync(directory, { recursive: true });
const report = path.join(directory, 'report.json');
fs.writeFileSync(report, JSON.stringify({ status: 'running', network: 'LOCAL EPHEMERAL EVM ONLY', liveTransactions: false }) + '\n');
const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('../hedera/test/checkpoint-runner.test.mjs', import.meta.url))], {
 stdio: 'inherit', env: { ...process.env, JANUS_DEMO_EVIDENCE_DIR: directory },
});
if (result.status !== 0) fs.writeFileSync(report, JSON.stringify({ status: 'failed', network: 'LOCAL EPHEMERAL EVM ONLY', exitCode: result.status, liveTransactions: false }) + '\n');
console.log(`Local evidence: ${report}`);
process.exitCode = result.status ?? 1;
