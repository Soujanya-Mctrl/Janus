import fs from 'node:fs';
export { encodeAuthorization, decodeAuthorization, operationId, taskSnapshot, baseUnits } from '../../../shared/protocol.mjs';
export const treasuryInterface = JSON.parse(fs.readFileSync(new URL('../../../shared/treasury-interface.json', import.meta.url), 'utf8'));
export const taskTreasuryAbi = treasuryInterface.abi;
