// JSON-RPC Hedera uses EVM wei units (18 decimals) for native fee accounting.
// A testnet transaction may never reserve more than 2 test HBAR in gas.
export async function transactionPolicy(publicClient, chainId) {
 if (chainId !== 296) return {};
 const gas = 500000n, gasPrice = await publicClient.getGasPrice();
 if (gasPrice <= 0n || gasPrice * gas > 2n * 10n ** 18n) throw new Error('Testnet gas ceiling exceeded');
 return { type: 'legacy', gas, gasPrice };
}
export function merchantEndpoint(value) {
 const url = new URL(value);
 if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Merchant requires HTTPS outside loopback');
 return url;
}
