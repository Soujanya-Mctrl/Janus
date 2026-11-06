# Janus implementation plan

## Foundation completed

Use top-level `backend/`, `frontend/`, `contracts/` and `shared/`. Keep separate dependency lockfiles, root orchestration commands, preserved proof evidence, and one current context set. Keep archived research distinct from implementation status.

## Next: finish Phase 1 integration readiness

1. Review the treasury acceptance scenarios and accounting invariants against the intended MVP. Preserve existing pending-payment, epoch and owner-recovery behavior.
2. Confirm the target settlement network; reconcile Sepolia frontend configuration with the existing Hedera route before wiring transactions.
3. Establish the treasury interface and ABI/version export for backend/frontend consumption, with integer base units and distinct available/reserved/spent/returned/withdrawn fields.
4. Verify deployment configuration and direct owner recovery without application services. Keep local proof and historical/live proof clearly labelled.

Exit gate: reproducible contract tests, explicit network/configuration choice, stable integration interface and documented direct owner recovery. A successful dashboard build alone does not complete this gate.

## Then: complete the paid workflow prototype

1. Build task-aware SDK and payment adapter with the 96-byte authorization envelope and task-specific quote validation.
2. Persist merchant operation identity, settlement intent and immutable results; authenticate result retrieval and reconcile ambiguous payments across restart.
3. Implement deterministic checkpointed A-to-B handoff. Lose a response after payment; retrieve the original result without another charge; reject new old-worker commitments; keep an unrelated task progressing.
4. Connect the dashboard to authoritative contract state and receipt-confirmed actions. Add a separately usable owner recovery client.
5. Run the demonstration from reset, save evidence and document limitations before adding optional discovery, privacy or sponsor integrations.

No production deployment or live spending is part of repository cleanup. The historical midnight timetable is archived reference, not the current schedule.

## Phase publication workflow

Before starting each phase and before publishing it: fetch origin/upstream, inspect incoming changes, and integrate both remote main branches while preserving local work. After the phase exit gate and relevant checks pass, commit and push to `origin/main`. Resolve non-fast-forward rejection by fetching and integrating, never force-pushing. Keep shared context current in the phase commit. Upstream checks happen during active work, not through an unattended scheduled task.
