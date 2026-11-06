import fs from 'node:fs';
import network from '../../../shared/protocol/network.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, defineChain, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const envPath = fileURLToPath(new URL('../../.env.hedera', import.meta.url));
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
export const NETWORK = network.network;
export const TOKEN_ID = network.token.id;
export const TOKEN = getAddress(network.token.address);
export const GAS = 500_000;
export const BUDGET = 100_000n; // 0.10 testnet USDC
export const PRICE = 20_000n; // 0.02 testnet USDC
export const chain = defineChain(network);
export const rpcUrl = process.env.HEDERA_RPC_URL || chain.rpcUrls.default.http[0];
export const mirrorUrl = process.env.HEDERA_MIRROR_URL || 'https://testnet.mirrornode.hedera.com';
export const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 20_000, retryCount: 2 }), cacheTime: 0 });

export function role(name) {
  const key = process.env[`HEDERA_${name}_PRIVATE_KEY`];
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? '')) throw new Error(`Missing valid dedicated testnet ${name} key in .env.hedera`);
  return { key, ...privateKeyToAccount(key) };
}
export async function assertTestnet() {
  if (await publicClient.getChainId() !== network.id) throw new Error('Refusing to use a non-Hedera-testnet RPC');
  if (process.env.HEDERA_TOKEN_ID && process.env.HEDERA_TOKEN_ID !== TOKEN_ID) throw new Error('Only the pinned Circle testnet USDC token is enabled');
}
export async function mirror(path, options = {}) {
  const response = await fetch(new URL(path, mirrorUrl), { ...options, signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Mirror request failed: HTTP ${response.status}`);
  return response.json();
}
export async function account(addressOrId) {
  const info = await mirror(`/api/v1/accounts/${addressOrId}?transactions=false`);
  if (!info || info.deleted) throw new Error(`Testnet account is not active: ${addressOrId}`);
  const evmAddress = info.evm_address || `0x${BigInt(info.account.split('.')[2]).toString(16).padStart(40, '0')}`;
  return { id: info.account, address: getAddress(evmAddress), info };
}
export async function tokenMetadata() {
  const token = await mirror(`/api/v1/tokens/${TOKEN_ID}`);
  if (!token || token.type !== 'FUNGIBLE_COMMON' || Number(token.decimals) !== 6 || token.deleted || token.pause_status === 'PAUSED') throw new Error('Pinned testnet token is unavailable or has unexpected properties');
  const fees = token.custom_fees || {};
  if (['fixed_fees', 'fractional_fees', 'royalty_fees'].some(k => Array.isArray(fees[k]) && fees[k].length)) throw new Error('Custom-fee assets are disabled');
  return token;
}
export async function saveEvidence(name, value) {
  const dir = new URL('../evidence/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const target = new URL(name, dir);
  const temporary = fileURLToPath(target) + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  fs.renameSync(temporary, target);
}
export function loadDeployment() {
  const value = JSON.parse(fs.readFileSync(new URL('../evidence/deployment.json', import.meta.url), 'utf8'));
  if (value.network !== NETWORK || value.tokenId !== TOKEN_ID) throw new Error('Wrong deployment network/token');
  return value;
}
export function artifact(name = 'HederaPaymentProbe') {
  return JSON.parse(fs.readFileSync(new URL(`../../../contracts/phase0/artifacts/${name}.json`, import.meta.url), 'utf8'));
}
export function safeError(error) {
  // SDK/client errors can include transaction bodies. Never dump objects or keys.
  return error.code || error.status?.toString() || error.shortMessage || error.message?.split('\n')[0] || 'Unknown error';
}
