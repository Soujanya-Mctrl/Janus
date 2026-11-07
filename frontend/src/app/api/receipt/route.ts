import { parseEventLogs, type Abi } from 'viem';
import { loadRuntimeDeployment } from '../../../../../backend/lib/runtime-deployment.mjs';
import descriptor from '../../../../../shared/treasury-interface.json' with { type: 'json' };

export async function GET(request: Request) {
 const headers = { 'Cache-Control': 'no-store' };
 const transaction = new URL(request.url).searchParams.get('transaction');
 if (!/^0x[0-9a-fA-F]{64}$/.test(transaction || '')) return Response.json({ error: 'Invalid transaction hash' }, { status: 400, headers });
 try {
  const { deployment, publicClient } = await loadRuntimeDeployment();
  const receipt = await publicClient.getTransactionReceipt({ hash: transaction as `0x${string}` });
  const events = parseEventLogs({ abi: descriptor.abi as Abi, logs: receipt.logs }).filter(event => event.address.toLowerCase() === deployment.treasury.toLowerCase());
  if (!events.length) return Response.json({ error: 'No configured treasury events in this receipt' }, { status: 404, headers });
  return Response.json({ transaction, chainId: deployment.chainId, treasury: deployment.treasury, status: receipt.status,
   block: receipt.blockNumber.toString(), events: events.map(event => ({ name: event.eventName, args: Object.fromEntries(Object.entries(event.args || {}).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value])) })) }, { headers });
 } catch { return Response.json({ error: 'Receipt unavailable on the configured deployment' }, { status: 503, headers }); }
}
