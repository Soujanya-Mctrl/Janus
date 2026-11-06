# Local Docker Compose

Install Docker Engine/Desktop with Compose and start its Linux engine, then from the repository root:

```sh
docker compose up --build --wait
```

Open http://localhost:3000. The task-aware merchant is at http://localhost:4023 and local EVM JSON-RPC at http://localhost:8545. Health checks gate contract deployment, backend startup and frontend readiness. No host Node installation, Hedera credentials, database server or manual contract deployment is required. The current application uses durable filesystem storage, not Postgres.

The contracts image compiles both phases. Its service runs persistent Ganache (chain 1337), deploys a local test token and Phase-1 treasury, deposits 1,000,000 base units and creates `compose-demo` with a 100,000-unit budget and 20,000-unit purchase ceiling. `GET /deployment` on the backend returns its public manifest. Restart reuses and validates the existing deployment. An interrupted bootstrap fails closed rather than silently deploying again.

Verify a real SDK purchase and replay (spends 20,000 local test-token units once):

```sh
docker compose exec backend node backend/docker/smoke.mjs
docker compose ps
docker compose logs backend contracts
docker compose down
```

`down` preserves the chain and merchant volumes. Keep both together: merchant records contain original paid results. For a deliberate disposable local reset only, `docker compose down --volumes` deletes both. Abruptly killed signers can leave fail-closed locks; reconcile before removing locks rather than treating state as cache.

Optional Privy login: copy `.env.compose.example` to `.env`, set your application IDs and server verification public key, and rebuild. Add localhost to the Privy application's allowed origins. Public IDs are build arguments embedded by Next.js; verification keys are supplied only at runtime. Existing module environment files and credentials are excluded from Docker builds. Empty IDs keep sign-in disabled. Port overrides are in the template.

This starts the implemented modules together. The existing dashboard remains illustrative and configured for Hedera testnet; it does not become a local treasury UI. Use the SDK smoke command for the connected local payment path. The checkpoint demo remains an explicit one-shot command: `docker compose exec backend npm run demo:handoff --prefix backend`. No live Hedera transactions or external model calls occur. The development mnemonic is public; these accounts must never receive real funds. Ports bind to host loopback.

Validation on the implementation host: Compose configuration, repository checks, both Solidity compilations, ABI check, shared protocol tests and frontend authentication tests passed. Local bootstrap deployed and funded the treasury successfully. Full container build/start validation remains pending because Docker Desktop's Linux engine did not respond. Native Windows purchase verification reached the filesystem-backed merchant but failed at its directory durability path; the Linux-volume purchase/replay smoke must pass before publishing this phase.
