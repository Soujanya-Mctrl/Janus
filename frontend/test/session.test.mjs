import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { GET } from '../src/app/api/session/route.ts';

test('session verification enforces identity and accepts environment PEM encoding', async t => {
  const saved = { appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, key: process.env.PRIVY_VERIFICATION_KEY };
  t.after(() => {
    for (const [name, value] of [['NEXT_PUBLIC_PRIVY_APP_ID', saved.appId], ['PRIVY_VERIFICATION_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const pem = await exportSPKI(publicKey);
  const token = (claims = {}) => new SignJWT({ sub: 'did:privy:test-owner', iss: 'privy.io', aud: 'test-app',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...claims })
    .setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
  const request = value => new Request('http://localhost/api/session', {
    headers: value === undefined ? {} : { authorization: `Bearer ${value}` },
  });
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app';
  process.env.PRIVY_VERIFICATION_KEY = pem;

  await t.test('missing bearer token returns 401 without caching', async () => {
    const response = await GET(request());
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await t.test('valid token with multiline PEM returns verified identity', async () => {
    const response = await GET(request(await token()));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).userId, 'did:privy:test-owner');
  });
  await t.test('literal newline separators in environment PEM work', async () => {
    process.env.PRIVY_VERIFICATION_KEY = pem.replace(/\n/g, '\\n');
    assert.equal((await GET(request(await token()))).status, 200);
    process.env.PRIVY_VERIFICATION_KEY = pem;
  });
  await t.test('wrong audience, issuer, subject and expired tokens are rejected', async () => {
    for (const claims of [{ aud: 'other-app' }, { iss: 'other-issuer' }, { sub: 'untrusted-owner' }, { exp: 1 }]) {
      assert.equal((await GET(request(await token(claims)))).status, 401);
    }
  });
  await t.test('missing or invalid verification configuration returns 503', async () => {
    delete process.env.PRIVY_VERIFICATION_KEY;
    assert.equal((await GET(request(await token()))).status, 503);
    process.env.PRIVY_VERIFICATION_KEY = 'invalid PEM';
    assert.equal((await GET(request(await token()))).status, 503);
  });
});
