# Janus backend

Research workspace configuration, encrypted credentials and provider adapters live in `workbench/`; run root `npm run test:workbench`. Browser execution is not connected yet. Use `npm run demo:handoff` at the root for the paid research-task fixture. See [WORKBENCH.md](../shared/WORKBENCH.md).


Hedera merchant/facilitator and settlement verification. Run `npm ci` here or root `npm run setup`. Run `npm test` for offline settlement validation. Testnet secrets belong in ignored `.env.hedera` here. Live scripts require dedicated testnet accounts and may spend testnet funds.

`.env.hedera.example` contains secret-free configuration names. `npm run hedera:init` generates dedicated testnet keys only if `.env.hedera` does not already exist. Live deployment records and payment journals are tied to their original accounts; changing keys does not create a fresh deployment.

`hedera:serve` runs the existing restricted Phase-0 HTTP payment proof, not the future task-aware workflow API. Compile artifacts via root `npm run contracts:compile` before deployment. Historical proof data lives in `hedera/evidence/`.

HTTP routing lives in `hedera/lib/merchant.mjs`; the server script wires it to the live facilitator. Tests exercise real localhost HTTP requests with a fixture facilitator, including retrying a consumed authorization through the original settlement journal path. These routing tests submit no chain transactions and do not establish durable purchased-result retrieval.

Task-aware service: `npm run task:serve`; see [paid workflow](../shared/PAID_WORKFLOW.md). Install all modules and compile from the root before integration tests, which use the contracts module's local EVM. This service is distinct from `hedera:serve`. State under `.merchant-state/` is durable financial evidence, not cache.

Checkpointed handoff reference: root `npm run demo:handoff`; see [RUNNER.md](../shared/RUNNER.md). This local proof preserves paid results across worker replacement; process-isolated production orchestration remains unfinished.

Read-only merchant readiness: `npm run task:preflight` from backend. Both preflight and the task server load ignored `backend/.env.hedera`. See [live setup](../shared/MERCHANT_LIVE_SETUP.md). No bootstrap command makes a paid purchase automatically.
