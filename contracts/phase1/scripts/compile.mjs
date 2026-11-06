import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function compile() {
  const files = { 'TaskTreasury.sol': 'phase1/contracts/TaskTreasury.sol', 'HederaTaskTreasury.sol': 'phase1/contracts/HederaTaskTreasury.sol', 'TestToken.sol': 'phase0/contracts/TestToken.sol', 'AdversarialToken.sol': 'phase1/test/fixtures/AdversarialToken.sol' };
  const sources = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, { content: fs.readFileSync(path.join(root, file), 'utf8') }]));
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', viaIR: true, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }), { import: name => {
    if (!name.startsWith('@openzeppelin/contracts/')) return { error: 'Unapproved import' };
    try { return { contents: fs.readFileSync(path.join(root, 'node_modules', name), 'utf8') }; }
    catch { return { error: `Missing dependency: ${name}` }; }
  }}));
  const errors = (output.errors ?? []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  return Object.fromEntries(Object.keys(files).map(file => {
    const name = file.replace('.sol', ''); const c = output.contracts[file][name];
    return [name, { contractName: name, compiler: solc.version(), evmVersion: 'shanghai', viaIR: true, abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }];
  }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifacts = compile(); const dir = path.join(root, 'phase1/artifacts'); fs.mkdirSync(dir, { recursive: true });
  for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value, null, 2));
  console.log(`Compiled ${Object.keys(artifacts).join(', ')}`);
}
