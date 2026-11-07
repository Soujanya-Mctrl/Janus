import { loadRuntimeDeployment } from '../../../../../backend/lib/runtime-deployment.mjs';
import { connection } from 'next/server';

export async function GET() {
 await connection();
 const headers = { 'Cache-Control': 'no-store' };
 try {
  // The historical default remains independently validated by treasury reads.
  const { deployment, chain } = await loadRuntimeDeployment({ verify: Boolean(process.env.JANUS_DEPLOYMENT_FILE) });
  return Response.json({ deployment, chain }, { headers });
 } catch {
  return Response.json({ error: 'Deployment unavailable or inconsistent. Check the manifest, RPC and merchant configuration.' }, { status: 503, headers });
 }
}
