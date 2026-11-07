# Janus module boundaries

## Runtime deployment boundary

`shared/runtime-deployment.mjs` owns the public manifest projection and supported browser chain definition. `backend/lib/runtime-deployment.mjs` loads the host-selected manifest, validates service RPC/merchant identity and keeps service URLs private. `api/deployment` publishes uncached browser configuration at request time. Privy wallet selection, treasury clients and Arkiv execution-network filters consume it. The research API pins the deployment into new run records; detached supervisors and resume reject changed identities. Compose mounts the same manifest into both services. See [DEPLOYMENT.md](DEPLOYMENT.md); task-budget binding and paid dashboard execution remain subsequent integration phases.

## Experimental privacy boundary

`backend/lib/private-json.mjs` owns authenticated private JSON and production data-key policy. Research account/run-relative records, checkpoint task files and merchant operation files use distinct encryption domains; they remain private host state, not public Arkiv entities. `backend/security/state-maintenance.mjs` owns explicit offline migration/rotation. `shared/public-worker-profile.mjs` defines the public-field projection used by frontend/backend publication. `api/research` adds identity-scoped confirmed local deletion; financial journals are outside that deletion boundary. Production vault/data key configuration and limitations are in [SECURITY_EXPERIMENT.md](SECURITY_EXPERIMENT.md). This does not isolate the trusted supervisor or provide confidential inference.

## Research workspace boundary

`frontend/src/components/dashboard-shell.tsx` preserves the unified dashboard shell; `agent-control-center.tsx` owns agent creation, credentials, runs, monitoring and Hedera/Arkiv preparation. `api/workbench` verifies Privy identity and stores encrypted credentials/configuration through `backend/workbench/store.mjs`; it cannot launch processes or execute runs. The separate authenticated `api/research` route starts a detached fixed supervisor in `backend/workbench/`. It brokers fixed-endpoint model calls, manages separate worker processes and persists account-private events/artifacts; it does not submit financial transactions. See [DASHBOARD_RUNTIME.md](DASHBOARD_RUNTIME.md). `backend/runner/` and `backend/hedera/` retain the paid task/checkpoint path described in [demo.md](../demo.md). Arkiv profiles advertise research capability without granting spending authority. See [WORKBENCH.md](WORKBENCH.md).

## Container orchestration

Root `compose.yaml` and `Dockerfile` build module-local dependencies on Node 22. `backend/docker/` owns a local Ganache deployment bootstrap and task-aware merchant entrypoint. Chain/deployment and merchant records persist in separate named volumes; health checks order startup. The frontend runs its production Next.js server. No database is required by the current filesystem-backed implementation. See [DOCKER.md](DOCKER.md); the illustrative Hedera dashboard remains a separate integration boundary.

## Frontend

`frontend/` owns Next.js source, public assets, TypeScript/ESLint/Next configuration, dependencies and lockfile. The root forwards dev/build/start/lint commands here. TypeScript resolves `@/*` to `frontend/src/*`. Turbopack covers the repository root so the app can import `shared/network.json`; dependencies remain module-local and build output remains `frontend/.next/`.

Configure `NEXT_PUBLIC_PRIVY_APP_ID`, optional `NEXT_PUBLIC_PRIVY_CLIENT_ID`, and server-only `PRIVY_VERIFICATION_KEY` in `frontend/.env.local`. Login identity does not grant treasury spending authority. The existing Privy/x402 Solana peer conflict requires the supplied frontend `.npmrc` compatibility setting pending dependency cleanup.

## Backend

`backend/hedera/` owns the existing HTTP merchant/facilitator, Hedera utilities, scripts, settlement tests and historical network evidence. Its manifest pins SDK/client dependencies. Testnet credentials belong only in ignored `backend/.env.hedera`. The artifact loader resolves `contracts/phase0/artifacts` relative to its module, never the shell working directory.

## Contracts

`contracts/phase0/` and `contracts/phase1/` own Solidity, compiler scripts, contract tests, artifacts and proof evidence. Existing relative compiler/test paths remain intact. The Phase-1 live proof explicitly imports Hedera utilities from `backend/hedera/lib`; install both modules before using it. Compile output stays in ignored phase artifact folders.

Historical RelayBudget references and dossier archives retain their original identities and paths as provenance. The former `packages/protocol/` directory was redistributed into these module boundaries. Documents under `docs/relaybudget/` and `docs/archive/` describing the old layout are historical; this document and the root README describe the supported current layout.

## Verification and integration boundary

Root `setup` installs all three independent lockfiles; the root package has no runtime dependencies. Root `check` validates structure and lockfiles, frontend lint/types, compilation, shared protocol/model and contract/backend/authentication tests and the production build. CI uses Node.js 22 and these same commands. `prototype` runs only the test suites. Neither command submits live transactions. Local contract reports are regenerated in ignored phase `artifacts/` directories; committed evidence and `docs/historical-evidence/` remain historical snapshots.

Frontend and backend now consume the same Hedera testnet configuration in `shared/network.json`. `shared/treasury-interface.json` exports the reviewed ABI/version/hash; `shared/protocol.mjs` defines canonical operation identity and 96-byte task authorization. The existing merchant still uses the separate Phase-0 probe. The next integration must adapt that merchant, persist operations/results, implement checkpointed resumption, and connect authoritative state and independent recovery to the UI.

Cancellation, release to reserve and owner withdrawal are separate actions. Reserved commitments survive cancellation/handoff. Unknown payment outcomes must be reconciled before another charge.

## End-to-end ownership and integration sequence

```text
Owner browser -> frontend/ (Privy identity, wallet; illustrative task data)
                     |
                     | task API / versioned contract client [planned]
                     v
                 backend/ (current Phase-0 HTTP merchant/facilitator)
                     |
                     | executor call (Phase 0 currently; task envelope planned)
                     v
                 contracts/ (Phase-0 probe; Phase-1 multi-task treasury)

Owner wallet -> contracts/phase1/lib/recovery.mjs -> chain (independent CLI; local proof)
Owner browser -> independent static recovery client [planned]

shared/ owns network, wire rules, versioned ABI and accounting oracle for all modules.
```

Keep modules together in this repository so a paid request can eventually be traced from UI/API through operation identity, reservation, settlement, result and checkpoint. Do not add a second financial ledger in the browser. A backend projection must reconcile with chain state, and independent recovery must not depend on that backend.

Network selection, versioned treasury interface and operation encoding are established. Next adapt the merchant to the 96-byte task authorization, persist payment intent/results, and implement checkpointed worker replacement before exposing receipt-confirmed task controls. Shared configuration and historical proofs alone do not constitute an integrated paid workflow. See [TREASURY_INTERFACE.md](TREASURY_INTERFACE.md) and [RECOVERY.md](RECOVERY.md) for accepted limitations and direct exit.

The task-aware reference SDK/server and durable result store are described in [PAID_WORKFLOW.md](PAID_WORKFLOW.md). Their local EVM integration is separate from the preserved Phase-0 service and historical Hedera proof. Backend integration tests require contract dependencies/artifacts. Checkpointed workers and connected dashboard remain later phases.

## Independent browser recovery implementation

A standalone static recovery page now shares the CLI recovery core and builds through `npm run recovery:build --prefix contracts`. It requires owner-wallet approval, validates deployment identity, displays the reserve-wide withdrawal effect and waits for receipts. See [RECOVERY.md](RECOVERY.md). Chromium browser-wallet acceptance now passes against a real local EVM with an injected EIP-1193 fixture: owner/network checks, rejected approvals, consent and plan invalidation, pending expiry, exact withdrawal and idempotent repeat. The static build and CI browser test are verified. Manual extension-wallet/live recovery remains untested; no live funds moved in this verification.

## Checkpoint runner reference

`backend/runner/` owns the local checkpointed runner and demo controller. Its financial calls use the shared task SDK; it stores execution progress rather than a second budget ledger. Per-task state and assignment intents are private filesystem records with fail-closed locks. Four logical task clients and deterministic faults are verified on a local EVM, not four OS worker processes or a production task API. See [RUNNER.md](RUNNER.md).

## Arkiv discovery boundary

`backend/arkiv/` owns the independent SDK client, publication/query CLI, policy/readiness selection and runner integration. `shared/arkiv-worker.json` defines v2 constants consumed by frontend/backend. Arkiv owns public, wallet-owned availability records; checkpoint storage owns private progress, and the treasury owns authority and money. Native expiry uses blocks; the availability lease uses Unix seconds. Queries supply candidates, owner policy authorizes them, worker signatures establish current readiness and the owner/scheduler assigns through the treasury. No-result waiting, fail-closed unavailable reads and offline reconciliation are tested. The explicit live demo uses real Rabdi discovery with local treasury/payments, not a combined live deployment. See [ARKIV.md](ARKIV.md).

## Phase 5 paid research acceptance

Completed the bounded CLI research-to-paid-tool-to-replacement gate: separate worker processes, three paid task sources, confirmed onchain replacement, old-worker refusal and original transaction/artifact reuse. Five real Groq calls produced a final report; treasury transactions were local EVM fixtures. Evidence: [phase5-paid-research.json](evidence/phase5-paid-research.json). Reproduction and limitations: [PHASE5.md](PHASE5.md). Trusted supervisor bindings are implemented; connected dashboard financial controls, encrypted checkpoints and production scheduling remain separate gates. No new sponsor qualification is claimed.

## Phase 6 authoritative treasury dashboard

Overview/Tasks now default to validated chain reads, block-pinned balances, bounded event discovery and receipt-confirmed owner/scheduler actions. A separately downloadable static recovery copy is generated before frontend dev/build, with configurable RPC and no application dependency. Local Chromium acceptance covers actual dashboard actions and independent recovery with the dashboard server stopped; static wallet recovery has its own acceptance test. See [PHASE6.md](PHASE6.md). No manual live recovery, production readiness or new sponsor acceptance is claimed.

## Funded Arkiv discovery verified

On 7 November 2026 the dedicated Rabdi writer published two expiring profiles. Independent CLI and actual React/SDK reads found the Hedera-compatible record; the live-discovery/local-finance handoff selected the other profile, confirmed epoch 2, preserved unrelated tasks and reused the original paid result. [Publication, query, receipt and browser evidence](../backend/arkiv/evidence/2026-11-07/README.md) labels the boundaries. This clears the former empty-writer/funded-publication blocker. Entities expire after one hour; there is one writer, no external adoption measurement, no new live Hedera payment and no claim that browser research-run reassignment or all sponsor requirements are complete.
