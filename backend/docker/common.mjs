import { defineChain } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

// Public development accounts. Never fund these on a public network.
export const mnemonic = 'test test test test test test test test test test test junk';
export const account = index => mnemonicToAccount(mnemonic, { addressIndex: index });
export const rpcUrl = process.env.JANUS_RPC_URL || 'http://127.0.0.1:8545';
export const chain = defineChain({ id: 1337, name: 'Janus local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
