import { createPublicClient, defineChain, http } from 'viem';
import network from '../../../../../shared/network.json';
import deployment from '../../../../../shared/deployments/hedera-testnet.json';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  try {
    const client = createPublicClient({ chain: defineChain({ ...network, id: network.chainId }), transport: http(network.rpcUrls.default.http[0], { timeout: 12000, retryCount: 0 }) });
    const chainId = await client.getChainId();
    const code = await client.getCode({ address: deployment.treasury as `0x${string}` });
    return Response.json({ hedera: { chainId, expectedChainId: network.chainId, deploymentPresent: Boolean(code && code !== '0x'),
      treasury: deployment.treasury, mode: 'Read-only testnet check; no payment submitted', x402Verified: false } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Testnet RPC check failed; no transaction was submitted' }, { status: 502 }); }
}
