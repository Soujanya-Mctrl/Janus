# Janus frontend

Agent workflow: `/dashboard/agents`. Provider keys: `/dashboard/credentials`. See [WORKBENCH.md](../shared/WORKBENCH.md) for encrypted storage, supported providers, saved-run recovery and sponsor account setup. Fixture runs need no keys; live inference uses separately billed provider accounts.

Next.js UI and wallet authentication. Run `npm ci` here, then `npm run dev`, or use root `npm run setup` and `npm run dev`. Copy `.env.example` to ignored `.env.local` in this folder for Privy configuration. Next.js and its bundled documentation must be installed under this module's `node_modules/`. Turbopack includes the repository root to resolve the shared network configuration; output stays in this module.

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` validate the frontend. Session tests use generated local signing keys, check token rejection and PEM encoding, and need no Privy account. Build output and generated route types stay in `.next/` here.

The dashboard currently shows illustrative accounting and uses the shared Hedera testnet configuration; it is not connected to the historical Hedera treasury. The session verification endpoint is a frontend authentication boundary, not a treasury service. The recovery tab describes readiness; it cannot cancel or withdraw treasury funds.

Turbopack disk persistence is disabled for development and builds after cache database reload failures on the external macOS volume. Compilation remains enabled; generated output stays under `frontend/.next/`. This is separate from React Cache Components.
