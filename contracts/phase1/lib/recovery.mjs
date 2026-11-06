import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { keccak256 } from 'viem';
import { INTERFACE_VERSION, bytes32, taskSnapshot } from '../../../shared/protocol.mjs';

const descriptor = JSON.parse(fs.readFileSync(new URL('../../../shared/treasury-interface.json', import.meta.url), 'utf8'));
const network = JSON.parse(fs.readFileSync(new URL('../../../shared/network.json', import.meta.url), 'utf8'));
const abi = descriptor.abi;
if (descriptor.abiHash !== '0x' + createHash('sha256').update(JSON.stringify(abi)).digest('hex')) throw new Error('Exported ABI hash mismatch');
export { validateTreasury, planRecovery, executeRecovery } from './recovery-core.mjs';
