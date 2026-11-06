import http from 'node:http';
import { assertTestnet, safeError } from '../lib/config.mjs';
import { createFacilitator } from '../lib/facilitator.mjs';
import { createMerchantHandler } from '../lib/merchant.mjs';

await assertTestnet();
const facilitator = await createFacilitator();
const server = http.createServer(createMerchantHandler(facilitator, {
  onError: error => console.error(safeError(error)),
}));
server.listen(4022, '127.0.0.1', () => console.log('Hedera testnet merchant + restricted facilitator: http://127.0.0.1:4022'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { facilitator.close(); process.exit(0); }));
