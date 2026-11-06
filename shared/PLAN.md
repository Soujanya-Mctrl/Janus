# Janus implementation plan

## Agent workspace implementation

The connected agent/credential UI, encrypted per-identity server vault, five provider adapters, assignment/budget forms, streamed worker events and saved-run resume are implemented. Arkiv schema/wallet directory code and sponsor documents, Hedera read-only checks, and an isolated CRE workflow/setup are prepared. Frontend/CRE types, lint, offline security/provider/runtime tests and the browser fixture smoke pass. Next: user account setup, actual provider/model calls, Arkiv testnet write/read evidence, official CRE CLI simulation and completed Hedera payment acceptance. No live trading or new sponsor qualification is claimed. Repository-wide Windows fsync/build-memory blockers still hold publication. See [WORKBENCH.md](WORKBENCH.md).

## Paper-trading agent phase

Parallel trading simulation now includes profit-only capped operating expenses, owner-configured free-cash reallocation, recovery after transfer debit/credit interruption and one bounded replacement for worker availability failures. Strategies, prices and expenses remain simulated; there are no real swaps, model integrations or provider payments. The connected agent UI is documented above; integration with task-aware treasury/handoff contracts remains a separate gate. Existing Windows fsync/build-memory failures continue to block publication acceptance. See [PAPER_TRADING.md](PAPER_TRADING.md).

## Foundation completed

Use top-level `backend/`, `frontend/`, `contracts/` and `shared/`. Keep separate dependency lockfiles, root orchestration commands, preserved proof evidence, and one current context set. Keep archived research distinct from implementation status.

Consistency gate verified on 6 November 2026 with Node.js 22.23.4: `npm run setup` installs module-local dependencies; `npm run check` validates source/lockfiles, lint, types, compilation, tests and frontend build. CI uses the same path. Generated contract reports stay in ignored artifacts rather than rewriting historical proof. Runtime configuration templates live with their owning frontend/backend modules.

## Treasury integration readiness completed

- Selected Hedera testnet and aligned frontend/backend through shared network configuration.
- Exported the versioned treasury ABI/hash and decimal-string operation/authorization interface, with drift checks in the normal compile path.
- Documented accepted narrower contract semantics in [TREASURY_INTERFACE.md](TREASURY_INTERFACE.md), preserving the existing contract and historical deployment.
- Added an independent event-history accounting model, fixed-seed model histories and onchain differential traces.
- Added a backend-independent owner recovery client with manifest/chain/code/owner/token checks and local recovery/restart tests. Browser recovery passes local Chromium wallet acceptance and bounded merchant payment/replay passes on Hedera testnet; manual live recovery remains pending; see [RECOVERY.md](RECOVERY.md).

Exit gate: reproducible contract/model tests, explicit network configuration, stable exported integration interface and independently usable owner recovery. No live spending or contract redeployment is part of this phase.

## Paid merchant completed locally

The task-aware quote/payment SDK, durable merchant store and authenticated result-retrieval adapter are implemented and tested with real local contracts over HTTP. See [PAID_WORKFLOW.md](PAID_WORKFLOW.md). Live network interoperability and production finality remain unqualified.

## Next: checkpointed workflow prototype

3. Implement deterministic checkpointed A-to-B handoff. Lose a response after payment; retrieve the original result without another charge; reject new old-worker commitments; keep an unrelated task progressing.
4. Connect the dashboard to authoritative contract state and receipt-confirmed actions. Add a separately usable owner recovery client.
5. Run the demonstration from reset, save evidence and document limitations before adding optional discovery, privacy or sponsor integrations.

No production deployment or live spending is part of repository cleanup. The historical midnight timetable is archived reference, not the current schedule.

## Production dependency follow-up

Existing frontend wallet/authentication advisories and peer-dependency compatibility settings require a reviewed migration with wallet/browser regressions before production. The readiness phase reviews and records this debt; it does not apply a forced downgrade or claim to clear the advisories.

## Phase publication workflow

Before starting each phase and before publishing it: fetch origin/upstream, inspect incoming changes, and integrate both remote main branches while preserving local work. After the phase exit gate and relevant checks pass, commit and push to `origin/main`. Resolve non-fast-forward rejection by fetching and integrating, never force-pushing. Keep shared context current in the phase commit. Upstream checks happen during active work, not through an unattended scheduled task.

## Independent browser recovery implementation

A standalone static recovery page now shares the CLI recovery core and builds through `npm run recovery:build --prefix contracts`. It requires owner-wallet approval, validates deployment identity, displays the reserve-wide withdrawal effect and waits for receipts. See [RECOVERY.md](RECOVERY.md). Chromium browser-wallet acceptance now passes against a real local EVM with an injected EIP-1193 fixture: owner/network checks, rejected approvals, consent and plan invalidation, pending expiry, exact withdrawal and idempotent repeat. The static build and CI browser test are verified. Manual extension-wallet/live recovery remains untested; no live funds moved in this verification.

## Checkpointed handoff reference milestone

Implemented and locally verified: durable checkpoint/assignment intent, stable paid-step replay, deterministic replacement selection, four independently progressing logical tasks and reconciliation after assignment acknowledgement loss. Reproduce with `npm run demo:handoff`; see [RUNNER.md](RUNNER.md). This is the core of the next phase, not completion of the broader process scheduler: authenticated task API, process-isolated workers, production storage/locking, encrypted checkpoints and a real model report remain required. Connected dashboard and manual extension-wallet/live recovery remain separate gates.

## Live task-aware payment verified

The bounded 0.02-test-USDC Hedera payment and original-result replay are verified. Allocation uncertainty was resolved through nonce reconciliation and a journaled signed transaction before one broadcast. Public evidence: `backend/hedera/evidence/task-aware-live-proof.json`. The completed-run guard submits nothing further. RPC availability, native child-record verification and broader production release gates remain distinct from this successful testnet check.

## Sponsor acceptance gate for every phase

Follow [SPONSOR_VERIFICATION.md](../docs/SPONSOR_VERIFICATION.md). Update the evidence register or state that the phase changes no sponsor claim. Keep local/live experiments separate; record expected and observed outcomes with source commits and raw artifacts. Meaningful Hedera enforcement, Arkiv-driven discovery and backend-independent CROPS recovery need their own positive and removal tests. `sponsors:check` validates bookkeeping; `sponsors:ready` requires independent review records, not a package install or recorded-but-unverified result. Track registration/provenance, FOSS licensing, AI/human contribution disclosure and sponsor rules remain mandatory submission gates.
