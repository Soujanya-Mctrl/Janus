import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const config = JSON.parse(fs.readFileSync(new URL('./risk/config.staging.json', import.meta.url), 'utf8'));
if (![config.tokenAddress, config.ownerAddress].every(value => /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value))) {
  throw new Error('Configure a Sepolia tokenAddress and ownerAddress in risk/config.staging.json first. See shared/WORKBENCH.md; no transaction has been submitted.');
}
const child = spawn('cre', ['workflow', 'simulate', 'risk', '--target', 'staging-settings'], { cwd: directory, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('CRE CLI is unavailable. Install the official CLI and run cre login before simulation.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
