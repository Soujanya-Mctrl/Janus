# Janus implementation plan

## Foundation completed

Use top-level `backend/`, `frontend/`, `contracts/` and `shared/`. Keep separate dependency lockfiles, root orchestration commands, preserved proof evidence, and one current context set. Keep archived research distinct from implementation status.

Consistency gate verified on 6 November 2026 with Node.js 22.23.4: `npm run setup` installs module-local dependencies; `npm run check` validates source/lockfiles, lint, types, compilation, tests and frontend build. CI uses the same path. Generated contract reports stay in ignored artifacts rather than rewriting historical proof. Runtime configuration templates live with their owning frontend/backend modules.

## Treasury integration readiness completed

- Selected Hedera testnet and aligned frontend/backend through shared network configuration.
- Exported the versioned treasury ABI/hash and decimal-string operation/authorization interface, with drift checks in the normal compile path.
- Documented accepted narrower contract semantics in [TREASURY_INTERFACE.md](TREASURY_INTERFACE.md), preserving the existing contract and historical deployment.
- Added an independent event-history accounting model, fixed-seed model histories and onchain differential traces.
- Added a backend-independent owner recovery client with manifest/chain/code/owner/token checks and local recovery/restart tests. Browser recovery and fresh live proof remain later work; see [RECOVERY.md](RECOVERY.md).

Exit gate: reproducible contract/model tests, explicit network configuration, stable exported integration interface and independently usable owner recovery. No live spending or contract redeployment is part of this phase.

## Next: complete the paid workflow prototype

1. Build task-aware SDK and payment adapter with the 96-byte authorization envelope and task-specific quote validation.
2. Persist merchant operation identity, settlement intent and immutable results; authenticate result retrieval and reconcile ambiguous payments across restart.
3. Implement deterministic checkpointed A-to-B handoff. Lose a response after payment; retrieve the original result without another charge; reject new old-worker commitments; keep an unrelated task progressing.
4. Connect the dashboard to authoritative contract state and receipt-confirmed actions. Add a separately usable owner recovery client.
5. Run the demonstration from reset, save evidence and document limitations before adding optional discovery, privacy or sponsor integrations.

No production deployment or live spending is part of repository cleanup. The historical midnight timetable is archived reference, not the current schedule.

## Production dependency follow-up

Existing frontend wallet/authentication advisories and peer-dependency compatibility settings require a reviewed migration with wallet/browser regressions before production. The readiness phase reviews and records this debt; it does not apply a forced downgrade or claim to clear the advisories.

## Phase publication workflow

Before starting each phase and before publishing it: fetch origin/upstream, inspect incoming changes, and integrate both remote main branches while preserving local work. After the phase exit gate and relevant checks pass, commit and push to `origin/main`. Resolve non-fast-forward rejection by fetching and integrating, never force-pushing. Keep shared context current in the phase commit. Upstream checks happen during active work, not through an unattended scheduled task.
