import fs from 'node:fs/promises';
if (process.argv[2] === 'chain') {
  const manifest = JSON.parse(await fs.readFile('/state/deployment.json', 'utf8'));
  const response = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [manifest.treasury, 'latest'] }), signal: AbortSignal.timeout(3000) });
  const result = await response.json();
  if (!response.ok || !result.result || result.result === '0x') process.exit(1);
} else {
  const response = await fetch('http://127.0.0.1:4023/health', { signal: AbortSignal.timeout(3000) });
  if (!response.ok) process.exit(1);
}
