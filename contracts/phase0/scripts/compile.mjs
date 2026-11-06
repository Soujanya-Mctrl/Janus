import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function compile() {
  const sources = Object.fromEntries(['PaymentProbe.sol', 'TestToken.sol', 'HederaPaymentProbe.sol'].map(name => [name, {
    content: fs.readFileSync(path.join(root, 'phase0/contracts', name), 'utf8'),
  }]));
  const input = { language: 'Solidity', sources, settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  }};
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: name => {
    if (!name.startsWith('@openzeppelin/contracts/')) return { error: 'Unapproved import' };
    try { return { contents: fs.readFileSync(path.join(root, 'node_modules', name), 'utf8') }; }
    catch { return { error: `Missing dependency: ${name}` }; }
  }}));
  const errors = (output.errors ?? []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const artifacts = {};
  for (const name of ['PaymentProbe', 'TestToken', 'HederaPaymentProbe']) {
    const contract = output.contracts[`${name}.sol`][name];
    artifacts[name] = { contractName: name, compiler: solc.version(), evmVersion: 'shanghai',
      abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
  }
  return artifacts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifacts = compile();
  const dir = path.join(root, 'phase0/artifacts');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, artifact] of Object.entries(artifacts)) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(artifact, null, 2));
  console.log(`Compiled ${Object.keys(artifacts).join(', ')} using ${solc.version()}`);
}
