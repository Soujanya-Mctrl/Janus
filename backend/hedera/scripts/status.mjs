import { role, account, mirror, TOKEN_ID, loadDeployment, safeError } from '../lib/config.mjs';
try {
  for (const name of ['OWNER', 'WORKER', 'MERCHANT']) {
    const a = await account(role(name).address);
    const relation = await mirror(`/api/v1/accounts/${a.id}/tokens?token.id=${TOKEN_ID}`);
    console.log(`${name}: ${a.id}; HBAR tinybars=${a.info.balance?.balance}; USDC base units=${relation?.tokens?.[0]?.balance ?? 0}`);
  }
  const d = loadDeployment(); const a = await account(d.contractId);
  const relation = await mirror(`/api/v1/accounts/${a.id}/tokens?token.id=${TOKEN_ID}`);
  console.log(`VAULT: ${a.id}; USDC base units=${relation?.tokens?.[0]?.balance ?? 0}`);
} catch (error) { console.error(safeError(error)); process.exitCode = 1; }
