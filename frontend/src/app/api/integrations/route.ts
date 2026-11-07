import { loadRuntimeDeployment } from '../../../../../backend/lib/runtime-deployment.mjs';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  try {
    const { deployment } = await loadRuntimeDeployment();
    return Response.json({ hedera: { chainId: deployment.chainId, expectedChainId: deployment.chainId, deploymentPresent: true,
      treasury: deployment.treasury, mode: 'Validated configured deployment; no payment submitted', x402Verified: false } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Deployment validation failed; no transaction was submitted' }, { status: 502 }); }
}
