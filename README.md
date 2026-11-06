# Janus

Payment-aware recovery for agent workflows. Task budgets stay with the work while worker spending authority can be safely reassigned.

## Project structure

```text
backend/     Hedera services, merchant/facilitator, settlement checks
frontend/    Next.js application, assets and wallet authentication
contracts/   Solidity treasury, compiler scripts, tests and proof evidence
shared/      Common product context, architecture and implementation plan
docs/        One research dossier, archived references and historical evidence
```

Start with [shared context](shared/CONTEXT.md), [our plan](shared/PLAN.md), and [architecture/configuration](shared/ARCHITECTURE.md). Each executable module owns its package manifest and lockfile. Root scripts orchestrate the modules. `shared/` currently contains maintained context; runtime types, schemas and ABI exports will be added as integration consumers are built.

## Setup

Requires Node.js 22 and npm.

```sh
npm run setup
npm run dev
```

Open http://localhost:3000. For authentication, configure `NEXT_PUBLIC_PRIVY_APP_ID`, optional `NEXT_PUBLIC_PRIVY_CLIENT_ID`, and server-only `PRIVY_VERIFICATION_KEY` in ignored `frontend/.env.local`. Local contract and settlement tests need no credentials.

## Verify

```sh
npm run lint
npm run build
npm run prototype
```

`prototype` runs actual contracts on an ephemeral local EVM, followed by offline backend settlement checks. The last full run passed 9 Phase-0 scenarios, 9 Phase-1 scenarios and 8 backend checks. It does not submit live transactions or demonstrate a complete browser-to-agent workflow.

`npm run contracts:compile` generates local ABI/bytecode artifacts. `npm run test:treasury` runs only the Phase-1 treasury suite.

## Current status and next work

The financial core implements task-isolated caps, reservation/settlement/expiry, worker epochs, cancellation and owner recovery. The frontend has identity plumbing and illustrative accounting. Existing live proof records use Hedera testnet; the frontend currently targets Sepolia. These pieces are not yet connected.

Our next milestone is **Phase 1 integration readiness**: review treasury acceptance and accounting, confirm the settlement network, establish the shared treasury interface, and verify independently usable owner recovery. Then build the task-aware payment SDK, durable merchant results, checkpointed worker replacement, connected dashboard and independent recovery UI. Detailed gates are in [PLAN.md](shared/PLAN.md).

## Live backend and configuration

Testnet credentials belong in ignored `backend/.env.hedera`. Compile contracts and install all modules before using live tooling. `npm run backend:serve` starts the restricted Phase-0 merchant/facilitator. Live commands may spend testnet funds; they are excluded from setup and local tests.

The Phase-0 authorization is 32 bytes; Phase-1 uses 96 bytes (task ID, operation ID, attempt). The old adapter cannot simply be pointed at the newer treasury. Reserved obligations survive handoff/cancellation; returned-to-reserve funds are distinct from owner withdrawals.

## Documentation and generated files

[shared/](shared/README.md) owns current project context. [docs/](docs/README.md) indexes research and archived material; superseded schedules and handoffs are not the current plan. Duplicate extracted dossier copies were consolidated with differing revisions preserved in archives.

Next.js generates **only `frontend/.next/`** for this layout. It is ignored build/cache output, not source; it can be deleted while the frontend is stopped and is recreated by `dev` or `build`. The stale root `.next/` was removed. Never copy build output into other modules.

This is a development prototype, not audited or production-ready software. Historical live evidence is not a fresh network verification.
