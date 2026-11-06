# Janus module boundaries

## Agent workspace boundary

`frontend/src/components/agent-workbench.tsx` owns the visual workflow, credentials, configuration and integration screens. `api/workbench` verifies Privy identity for secrets/configuration, encrypts the private vault through `backend/workbench/store.mjs`, and spawns only the fixed workbench runner with credentials on stdin. `backend/workbench/` mediates fixed-endpoint provider calls and cached inference before the existing paper risk engine. `backend/cre/` is an independently locked SDK/TypeScript workflow module; root setup/check includes it. Arkiv profile reads/wallet writes stay separate from financial authorization. The public risk endpoint is an explicit synthetic CRE fixture, not a user ledger. See [WORKBENCH.md](WORKBENCH.md) for persistence, deployment and sponsor limits.

## Paper-trading boundary

`backend/trading/orchestrator.mjs` controls concurrent workers and pins allocations, failure-transfer rules and operating invoices. Task-owned version-2 portfolio journals record fills and cash adjustments; `finance.mjs` coordinates recoverable idempotent debit/credit legs. Workers cannot access adjustment methods or wallets. Operating fees require both pooled net realized profit and unspent task profit under a cap. Worker availability failures receive one replacement; financial failures stop for reconciliation. No model provider, exchange or Hedera treasury is called. See [PAPER_TRADING.md](PAPER_TRADING.md).

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
