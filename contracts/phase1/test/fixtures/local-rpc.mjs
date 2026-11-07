import http from 'node:http';
import { once } from 'node:events';
import ganache from 'ganache';
import memdown from 'memdown';

// Test-only HTTP transport. Ganache's native-server fallback leaves HTTP/DB
// handles open on this Windows build; the provider itself has a working shutdown.
export function createFixtureRpc({ mnemonic } = {}) {
  const provider = ganache.provider({ database: { db: memdown() }, logging: { quiet: true }, wallet: mnemonic ? { mnemonic } : { deterministic: true }, chain: { chainId: 1337, hardfork: 'shanghai' } });
  const answer = async request => {
    try { return { jsonrpc: '2.0', id: request.id, result: await provider.request({ method: request.method, params: request.params ?? [] }) }; }
    catch (error) { return { jsonrpc: '2.0', id: request.id, error: { code: typeof error.code === 'number' ? error.code : -32000, message: error.message } }; }
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 1024 * 1024) throw new Error('Fixture request too large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const result = Array.isArray(body) ? await Promise.all(body.map(answer)) : await answer(body);
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(result));
    } catch { res.writeHead(400); res.end(); }
  });
  return {
    provider,
    async listen(port, host) { server.listen(port, host); await once(server, 'listening'); },
    address: () => server.address(),
    async close() { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await provider.disconnect(); },
  };
}
