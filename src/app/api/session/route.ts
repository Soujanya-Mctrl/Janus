import { importSPKI, jwtVerify } from "jose";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192) {
    return Response.json({ error: "A valid Privy access token is required." }, { status: 401, headers });
  }
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const pem = process.env.PRIVY_VERIFICATION_KEY?.replace(/\\n/g, "\n");
  if (!appId || !pem) {
    return Response.json({ error: "Server verification is not configured. Set PRIVY_VERIFICATION_KEY from your Privy dashboard." }, { status: 503, headers });
  }
  let key;
  try { key = await importSPKI(pem, "ES256"); }
  catch { return Response.json({ error: "Server verification key is invalid. Check the PEM configuration." }, { status: 503, headers }); }
  try {
    const { payload } = await jwtVerify(authorization.slice(7), key, {
      issuer: "privy.io", audience: appId, algorithms: ["ES256"], requiredClaims: ["sub", "iat", "exp"],
    });
    if (!payload.sub?.startsWith("did:privy:")) throw new Error("Invalid subject");
    return Response.json({ userId: payload.sub, expiresAt: payload.exp }, { headers });
  } catch {
    return Response.json({ error: "Session is expired or invalid. Sign in again." }, { status: 401, headers });
  }
}
