import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSettlement } from '../lib/settlement-check.mjs';

const expected = { payer: '0.0.10', payTo: '0.0.20', feePayer: '0.0.30', tokenId: '0.0.429274', amount: '20000', controlledAddresses: ['0x0000000000000000000000000000000000000030'] };
const valid = () => ({ status: 'SUCCESS', feeTinybars: '100', tokenTransfers: [{ tokenId: expected.tokenId, accountId: expected.payer, amount: '-20000' }, { tokenId: expected.tokenId, accountId: expected.payTo, amount: '20000' }], hbarTransfers: [{ accountId: expected.feePayer, amount: '-100' }, { accountId: '0.0.3', amount: '100' }], nftTransfers: [], logs: [] });
test('exact USDC payment and only the declared HBAR fee pass', () => assert.equal(checkSettlement(valid(), expected).verified, true));
test('SUCCESS without an actual merchant credit fails', () => { const r = valid(); r.tokenTransfers = []; assert.throws(() => checkSettlement(r, expected), /payee_credit/); });
test('wrong payer debit fails even if merchant received funds', () => { const r = valid(); r.tokenTransfers[0].accountId = '0.0.999'; assert.throws(() => checkSettlement(r, expected), /payer_debit/); });
test('additional token transfers fail', () => { const r = valid(); r.tokenTransfers.push({ tokenId: '0.0.123', accountId: '0.0.20', amount: '1' }); assert.throws(() => checkSettlement(r, expected), /unexpected_transfer/); });
test('third account HBAR debit fails', () => { const r = valid(); r.hbarTransfers.push({ accountId: '0.0.40', amount: '-1' }, { accountId: '0.0.3', amount: '1' }); assert.throws(() => checkSettlement(r, expected), /unexpected_debit/); });
test('fee payer debit beyond declared fee fails', () => { const r = valid(); r.hbarTransfers[0].amount = '-101'; assert.throws(() => checkSettlement(r, expected), /fee_payer_debit/); });
test('NFT movement fails', () => { const r = valid(); r.nftTransfers = [{}]; assert.throws(() => checkSettlement(r, expected), /unexpected_transfer/); });
test('transfer log exposing a facilitator-controlled debit fails', () => { const r = valid(); r.logs = [{ topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x0000000000000000000000000000000000000000000000000000000000000030', '0x0000000000000000000000000000000000000000000000000000000000000020'] }]; assert.throws(() => checkSettlement(r, expected), /unexpected_transfer/); });
