const encode = value => Buffer.from(JSON.stringify(value)).toString('base64');

export function createMerchantHandler(facilitator, { onError = () => {} } = {}) {
  const resource = { url: 'http://127.0.0.1:4022/premium', description: 'Hedera testnet USDC token metadata', mimeType: 'application/json' };
  const challenge = { x402Version: 2, resource, accepts: [facilitator.requirements] };
  return async (req, res) => {
    const json = (status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
    try {
      if (req.method === 'GET' && req.url === '/supported') return json(200, facilitator.supported);
      if (req.method === 'GET' && req.url === '/premium') {
        const encoded = req.headers['payment-signature'];
        if (!encoded) return json(402, challenge, { 'PAYMENT-REQUIRED': encode(challenge) });
        if (encoded.length > 16_384) return json(400, { error: 'invalid_payload' });
        const payment = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        // settle validates fresh payments and reconciles cached submissions. A separate
        // verify here rejects consumed reservations before cached results can be returned.
        const settled = await facilitator.settle(payment, facilitator.requirements);
        if (!settled.success) return json(402, { ...challenge, error: settled.errorReason, settlement: settled }, { 'PAYMENT-REQUIRED': encode(challenge) });
        return json(200, { data: { token: 'USDC', tokenId: '0.0.429274', network: 'hedera:testnet', decimals: 6 }, settlement: settled }, { 'PAYMENT-RESPONSE': encode(settled) });
      }
      if (req.method === 'POST' && ['/verify', '/settle'].includes(req.url)) {
        let bytes = 0; const parts = [];
        for await (const part of req) { bytes += part.length; if (bytes > 32_768) { json(413, { error: 'payload_too_large' }); return; } parts.push(part); }
        const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
        return json(200, await facilitator[req.url.slice(1)](body.paymentPayload, body.paymentRequirements));
      }
      json(404, { error: 'not_found' });
    } catch (error) { onError(error); if (!res.headersSent) json(400, { error: 'invalid_request' }); else res.end(); }
  };
}
