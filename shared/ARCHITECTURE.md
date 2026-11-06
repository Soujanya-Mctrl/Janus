# Janus module boundaries

## Frontend

`frontend/` owns Next.js source, public assets, TypeScript/ESLint/Next configuration, dependencies and lockfile. The root forwards dev/build/start/lint commands here. TypeScript resolves `@/*` to `frontend/src/*`.

Configure `NEXT_PUBLIC_PRIVY_APP_ID`, optional `NEXT_PUBLIC_PRIVY_CLIENT_ID`, and server-only `PRIVY_VERIFICATION_KEY` in `frontend/.env.local`. Login identity does not grant treasury spending authority. The existing Privy/x402 Solana peer conflict requires the supplied frontend `.npmrc` compatibility setting pending dependency cleanup.

## Backend

`backend/hedera/` owns the existing HTTP merchant/facilitator, Hedera utilities, scripts, settlement tests and historical network evidence. Its manifest pins SDK/client dependencies. Testnet credentials belong only in ignored `backend/.env.hedera`. The artifact loader resolves `contracts/phase0/artifacts` relative to its module, never the shell working directory.

## Contracts

`contracts/phase0/` and `contracts/phase1/` own Solidity, compiler scripts, contract tests, artifacts and proof evidence. Existing relative compiler/test paths remain intact. The Phase-1 live proof explicitly imports Hedera utilities from `backend/hedera/lib`; install both modules before using it. Compile output stays in ignored phase artifact folders.

Historical RelayBudget references and dossier archives retain their original identities and paths as provenance. The former `packages/protocol/` directory was redistributed into these module boundaries. Documents under `docs/relaybudget/` and `docs/archive/` describing the old layout are historical; this document and the root README describe the supported current layout.

## Verification and integration boundary

Root `setup` installs all three independent lockfiles; the root package has no runtime dependencies. Root `check` validates structure and lockfiles, frontend lint/types, compilation, contract/backend/authentication tests and the production build. CI uses Node.js 22 and these same commands. `prototype` runs only the test suites. Neither command submits live transactions. Local contract reports are regenerated in ignored phase `artifacts/` directories; committed evidence and `docs/historical-evidence/` remain historical snapshots.

The frontend still targets Sepolia while historical settlement proof uses Hedera. The next integration must choose the network, build task-aware authorization (96-byte task ID/operation ID/attempt instead of Phase-0 32-byte authorization), persist merchant operations/results, implement checkpointed resumption, and connect authoritative contract state plus independent owner recovery to the UI.

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

Owner wallet -> direct treasury calls (scripted historical proof)
Owner browser -> independent static recovery client [planned]

shared/ defines current context and integration boundaries for all modules.
```

Keep modules together in this repository so a paid request can eventually be traced from UI/API through operation identity, reservation, settlement, result and checkpoint. Do not add a second financial ledger in the browser. A backend projection must reconcile with chain state, and independent recovery must not depend on that backend.

Before connecting modules: choose one network, export a versioned treasury ABI and canonical operation schema, adapt the merchant to the 96-byte task authorization, persist payment intent/results, and implement checkpointed worker replacement. Only then expose receipt-confirmed task controls. Sepolia login and a Hedera proof do not constitute an integrated deployment.
