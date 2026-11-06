# Janus implementation plan

## Current direction: research-task demo

Follow [demo.md](../demo.md). Preserve the local payment-aware handoff, recorded Hedera payment/replay and independent recovery. Next connect authoritative treasury state and receipt-confirmed actions to the browser, integrate research-model execution with paid artifacts/checkpoints, and complete funded live Arkiv discovery evidence. Arkiv query results now drive operator-triggered eligible replacement selection; remote worker transport and browser orchestration remain separate. Dashboard agent creation, a single-host parallel research runtime, saved artifacts and account-private monitoring are now implemented. Paid research tools and authoritative treasury controls remain separate integration gates. No new sponsor acceptance is claimed.

## Dashboard agent creation and monitoring

The next implementation sequence is defined in [DASHBOARD_AGENTS.md](DASHBOARD_AGENTS.md): account-owned agent creation, durable parallel orchestration and monitoring, user-key model execution, payment-aware handoff, then Arkiv replacement and independent owner exit. The first three phases now have an implemented dashboard/runtime and offline/browser tests; live provider validation remains pending. See [DASHBOARD_RUNTIME.md](DASHBOARD_RUNTIME.md). Paid-tool wiring and discovery-driven research-run reassignment remain open.

## Local orchestration

Docker Compose starts the implemented frontend/backend/contracts together with persistent local chain and merchant state. SDK purchase/replay smoke verification is provided; connected dashboard and production process scheduling remain separate gates. See [DOCKER.md](DOCKER.md). No sponsor claim changes in this phase.

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

## Arkiv discovery integration

Implemented v2 profiles with execution-network/protocol filters, native block expiry and a Unix-second lease. The backend checks wallet ownership, explicit owner policy and task-bound signed readiness, revalidates before assignment, and persists query/entity evidence. The local four-task demo now selects through this adapter, checks empty/unavailable directory behavior and reconciles a submitted assignment while Arkiv is offline. Independent Rabdi query succeeded; `npm run demo:arkiv` supplies the funded-key live-discovery/local-finance rehearsal. Publication and external-user/sponsor evidence remain open; see [ARKIV.md](ARKIV.md).
