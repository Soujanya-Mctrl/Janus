# Building RelayBudget phase by phase with Codex

This is a future implementation plan. Commands under proposed package scripts do not exist until Phase 1 creates them. No application tests have been run as part of writing this dossier.

## 1. Working method

Use short vertical slices: define one invariant, implement the narrow behavior, exercise it adversarially, and record evidence before adding UI or another sponsor. Codex should work from this dossier and the live repository, not from earlier conversational guesses.

OpenAI documents repository instructions, reusable skills, phased context, and code-review rules [C1-C3](10-sources.md#codex). The concrete conventions below are this project's proposed workflow; they are not mandatory Codex product files.

Copy [the instruction template](templates/AGENTS.template.md) to the implementation repo as `AGENTS.md` when starting. Keep documentation, package lockfiles, deployment manifests, and benchmark run manifests under version control. Record AI assistance and pre-existing components as the event requires [S1]. Do not present the dossier as shipped application code.

Suggested repository:

```text
apps/dashboard/                 operator UI
apps/recovery/                  standalone static owner exit
apps/api/                       task API and event stream
apps/merchant/                  reference paid service
apps/facilitator/               admitted executor support; explicit fallback only if needed
packages/sdk/                  proposed public TypeScript API
packages/protocol/             schemas, canonical hashes, common types
packages/runner/               worker lifecycle and handoff
packages/adapter-langgraph/    thin optional framework integration
contracts/src/TaskTreasury.sol
contracts/test/                 unit, fuzz, invariant, exploit regressions
benchmarks/scenarios/           fixed inputs and fault schedules
benchmarks/runs/                raw evidence, not generated success claims
docs/decisions/                 one record per changed assumption
docs/security/                 findings and review reports
scripts/                       setup, checks, fixture reset, evidence capture
```

## 2. Phase 0 — prove the payment and recovery boundary

Planning estimate: 1–2 engineer-hours; stop the sponsor integration if it remains unresolved. This is a feasibility budget, not a promise.

Deliver: exact chain/token configuration; supported runtime/package versions; smallest contract payment; x402 client/server/facilitator compatibility decision; direct owner recovery; dependency license inventory.

Hedera checks: associations, contract token-transfer mechanism, token identity and decimals, gas payer, signatures, token movement and HashScan link. Try `exact` with `transferExecutor`, verify admission and facilitator implementation, then evaluate a self-run adapter only if needed. Never route controlled payments through an unrestricted agent wallet.

Codex prompt:

> Read the PRD, contract specification, and sponsor plan. Inspect the actual tooling and current primary docs. Build only a testnet/local compatibility spike for reserve, settle, expire, and owner withdrawal. Record exact versions and every transaction. Test whether the x402 route enforces the task contract rather than bypassing it. Do not build a dashboard, claim compatibility without observed support, use mainnet, or invent transaction IDs. Produce a decision record with go/no-go evidence and the smallest supported route.

Acceptance: a real successful settled payment, stale/over-budget rejection at the contract boundary, and independent available-fund withdrawal. If only local proof works, select a core-only release and update sponsor claims.

## 3. Phase 1 — repository and pure state model

Deliver: pinned workspace, formatter/typechecker, versioned schemas, a reference accounting model with no network calls, Docker Compose for PostgreSQL, secret-free example configuration, CI skeleton, stable operation identity definition.

Codex prompt:

> Implement the accounting model from section 3 of the contract specification and its state transitions before contract code. Cover the 1,000/100/20 example, outstanding reservation, cancellation, and expiry. Use integer base units. Create only the package scripts that are actually executable and document them. Reject semantic inconsistencies rather than silently normalizing them. Keep pending, reserved, settled, expired, and unknown states distinct.

Acceptance: reference model recomputes independent balances, malformed transitions fail, versions are locked, `check` and test scripts work from a fresh checkout. Fixture private keys must be visibly local/test-only and never reused for live funds.

## 4. Phase 2 — immutable treasury contract

Deliver: public-accounting TaskTreasury, token fixture, exact role boundaries, assignment epochs, bounded reservations, permissionless settle/expire, owner exit.

Codex prompt:

> Implement the contract specification without upgradeability, generic execution, or worker token allowances. Write meaningful failing tests for stale epochs, concurrent cap exhaustion, duplicate settlement, deadline equality, and cancellation with outstanding reservations. Make them pass. Add stateful invariant tests with independent ghost accounting and a bounded actor set. Emit events sufficient to rebuild projections. Do not call the contract audited.

Acceptance: unit/fuzz/invariant suites pass; gas snapshots saved; no unbounded production loop; static analysis findings triaged; owner can recover without backend. Review signature domains and callback/reentrancy behavior separately.

## 5. Phase 3 — paid merchant and durable operation ledger

Deliver: x402 executor adapter (experimental fallback only if necessary), signed quotes, merchant result retrieval, persistent deduplication, settlement reconciler. Reuse current identifiers and signed receipts where compatible; do not claim to invent them [D2, D4].

Codex prompt:

> Implement one paid dataset endpoint with a deterministic immutable artifact. Persist request identity and settlement intent before external calls. Bind every authorization to task, operation, provider, network, token, amount, expiry, and canonical request. Inject a disconnect after settlement but before HTTP response. A retry by the replacement must retrieve the original result without another settled charge. Lost DB/cache state must cause reconciliation or a safe error, not a new debit. Provide one end-to-end live transaction if configured.

Acceptance: actual contract debit equals merchant credit, same-op changed-body request conflicts, duplicate requests settle once, unsettled reservations expire safely, and settled/unavailable result becomes a visible owner decision rather than a fabricated refund.

## 6. Phase 4 — backend, scheduler, and four worker processes

Deliver: tasks API, Postgres-backed checkpoints/outbox, deterministic worker eligibility, local transport, redacted events, failure injection.

Codex prompt:

> Implement the four-task 1,000-unit scenario. A fails after a 20-unit paid step. Keep B/C/D active. When B is available and capable, reconcile A's operations, increment its task epoch onchain, restore its validated checkpoint, and resume only unfinished steps. Do not create extra identities to evade rate limits. Revive A and demonstrate rejection of a new reserve. Treat timeouts as unknown outcomes. Persist progress across process restarts.

Acceptance: available funds and old commitments stay distinct; replacement cannot change merchant policy or increase cap; single-task failure does not cancel other tasks; scheduler crash/restart does not duplicate financial effects. Include a genuine model call for one report step separately from deterministic financial fixtures.

## 7. Phase 5 — independent recovery and useful dashboard

Deliver: task cards with budget categories, timeline, injection/reassignment controls, explorer links, and independent owner client.

Codex prompt:

> Build a dashboard for the implemented behavior only. Label local and live modes distinctly. Expose free, reserved, spent, and recovered amounts. Build recovery as a separate static artifact with pinned ABI/chain validation and configurable RPC; it cannot call the API, DB, facilitator, or Arkiv. Stop all those services and complete cancellation, expiry where needed, and withdrawal directly through the owner's wallet. Record evidence.

Acceptance: no mock success states; exact amounts match receipts; recovery works from exported artifact; a blocked reservation is explained; no secrets in browser bundle. Use the available frontend-design skill when implementing the UI, with actual fixture/live values rather than invented traction.

## 8. Phase 6 — meaningful sponsor integrations

Deliver: only the integrations selected after Phase 0. EF core proof is the direct exit. Hedera needs an actual protected paid request and transaction. Arkiv needs a client-visible discovery query against expiring worker records.

Codex prompt:

> Implement the selected sponsor integration from the evidence checklist. For Arkiv, write signed worker capability records and use a real read query to discover the replacement; validate freshness and authorization separately. Demonstrate another client can read the directory. Keep task briefs and money metadata off public entities. If an integration fails, mark it incomplete and remove its eligibility claim; do not substitute a screenshot or an unused SDK import.

Acceptance: documented reproducible entity/query and live payment evidence, all required feedback files, and no new dependency in owner financial recovery.

## 9. Phase 7 — benchmarks and adversarial review

Deliver: three baselines plus proposed system, fixed fault schedules, raw event data, statistical report, exploit regressions, and reviewed exceptions.

Codex prompt:

> Execute the evaluation protocol exactly. Implement the strong baseline with persistent checkpoints and current payment idempotency, not only a broken retry loop. Compare identical tasks, seeds, providers, and faults. Report all failures and unknown outcomes. Save raw logs and manifests, derive metrics independently, and leave unsupported metrics unmeasured. Review the financial boundaries adversarially; every confirmed finding needs a minimal reproduction and a regression test. Do not replace a security review with model opinions.

Acceptance: zero observed safety violations in the defined suite; reproducible failed seeds; no denominator changes; no invented speedups; report limitations and untested production conditions.

## 10. Phase 8 — release and submission package

Deliver: verified testnet deployment manifest, public repo/license, accurate integration README, three-minute demo, source citations, architecture diagram, AI attribution, benchmark appendix, and known limitations.

Codex prompt:

> Audit the submission against the sponsor matrix and the actual repository. Link every claim to code, transaction, query, test output, or a clearly labeled assumption. Rewrite the pitch around the completed feature set. Remove claims that depend on mock payments, private balances not implemented, production readiness, or unverified customer demand. Keep owner recovery runnable after the demo services stop.

Acceptance: independent fresh-clone rehearsal and complete sponsor evidence. The event page lists 7 November 2026, 09:00 IST as submission deadline; recheck the dashboard for changes [S1].

## 11. Continuous testing and commands

Create these proposed package scripts in Phase 1, then keep their implementation in the repo:

```text
pnpm check              format check + lint + typecheck
pnpm test:unit          Vitest protocol/model/SDK tests
pnpm test:integration   isolated Postgres + merchant + local chain
pnpm test:e2e           Playwright owner/worker/recovery journeys
pnpm demo:reset         reproducible local fixtures; no live-chain destructive reset
pnpm bench:local       seeded fault suite; exports raw event records
pnpm bench:report      independent aggregation, confidence intervals, failed cases
pnpm evidence:check    links/files/manifest validation, no forged transactions
```

Contract commands to verify against the installed Foundry release:

```text
forge fmt --check
forge build
forge test -vvv
forge test --gas-report
forge coverage
slither .
```

Run Foundry commands from the contract project directory. Configure fuzz/invariant run counts in committed profiles; do not rely on a command with an unverified flag. CI runs deterministic unit/integration tests on each change and a larger invariant/fault suite on a scheduled or manually triggered job. Sponsor-network tests are separate, use test credentials, and report outages as unavailable rather than as passed.

Watch mode is useful during development but is not the evidence artifact. Final evidence uses a fixed commit and immutable raw output. Do not rerun a passing broad suite without a change or unresolved concern; do rerun relevant regressions after fixes.

## 12. Skills and tools that help

| Tool/skill | Use | Boundary |
|---|---|---|
| OpenAI Docs skill | Current Codex workflows and configuration | Use official docs; do not invent product commands |
| Firecrawl Developer / Research skills | Primary API behavior and papers | In this session CLI network access failed; official pages were used as fallback |
| frontend-design | Implement a deliberate, legible task/budget UI | UI quality does not establish financial correctness |
| skill-creator | Later package a repeated invariant or benchmark workflow as a local skill | Only install/create after the underlying procedure actually works |
| Foundry / Slither / optional Echidna | Contract testing, static analysis, property fuzzing | No automatic tool equals an independent audit |
| Playwright / OpenTelemetry | Browser fault journeys and redacted traces | Do not upload private task traces by default |
| GitHub tools | Review diffs and CI evidence | Do not auto-merge or publish based only on model review |

A useful future skill is `payment-boundary-review`: inspect epoch checks, reservation accounting, signature domains, retries, and recovery, then run the known regression commands and produce a reproduction-backed report. Another is `reproducible-fault-benchmark`: pin a manifest, execute fixed seeds, retain failures, and derive metrics. They are proposed workflows, not preinstalled special capabilities.

## 13. Time-constrained build cut

If time is short: prioritize Phase 0, the flat contract, one merchant, two workers, direct exit, and one deterministic failure trace. Four task cards can demonstrate independent progress, but do not spend time on a general scheduler. Drop nested delegation, private balances, additional payment schemes, and extra sponsor integrations first. Do not drop safety checks or hide pending-payment cases to preserve a broad pitch.
