import fs from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const path = new URL('../../.env.hedera', import.meta.url);
const roles = ['OWNER', 'WORKER', 'MERCHANT'];
const keys = Object.fromEntries(roles.map(role => [role, generatePrivateKey()]));
const addresses = Object.fromEntries(roles.map(role => [role, privateKeyToAccount(keys[role]).address]));
const content = ['# Dedicated Hedera TESTNET keys. Never use for real funds.',
  'HEDERA_RPC_URL=https://testnet.hashio.io/api',
  'HEDERA_MIRROR_URL=https://testnet.mirrornode.hedera.com',
  'HEDERA_TOKEN_ID=0.0.429274',
  ...roles.map(role => `HEDERA_${role}_PRIVATE_KEY=${keys[role]}`), ''].join('\n');
try { await fs.writeFile(path, content, { flag: 'wx', mode: 0o600 }); }
catch (error) {
  if (error.code === 'EEXIST') { console.log('.env.hedera already exists; no keys overwritten.'); process.exit(0); }
  throw error;
}
await fs.mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../evidence/addresses.json', import.meta.url), JSON.stringify({ network: 'hedera:testnet', addresses }, null, 2) + '\n');
console.log('Dedicated testnet keys saved locally in .env.hedera (ignored by git).');
console.log(`Fund this public OWNER address with test HBAR: ${addresses.OWNER}`);
console.log('Faucet: https://portal.hedera.com/faucet');
