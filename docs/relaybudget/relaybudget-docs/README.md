# RelayBudget — product and engineering dossier

**Payment-aware recovery for multi-agent workflows.**

Prepared 6 November 2026, Asia/Kolkata. Status: design dossier plus local Phase-0 tests and a successful public Hedera testnet USDC payment/recovery. The merchant/facilitator runs locally. No production application, customer pilot, audit or product benchmark is represented as complete.

## The product in one minute

A company gives an orchestrator a 1,000-USDC treasury. It allocates 100 USDC to task A and separate budgets to tasks B, C, and D. Agent A spends 20 USDC and fails. The other tasks continue. When a suitable worker becomes available, it resumes A's checkpoint with authority over the available 80 USDC. Old authority is fenced off, previous purchases are reused, and unresolved payment commitments remain reserved. The owner can cancel tasks and recover uncommitted funds through an independent client.

Money belongs to a task account; workers receive temporary authority. A replacement does not inherit the owner's key.

## Read in this order

1. [PRD: problem, customer, requirements, acceptance criteria](01-prd.md)
2. [Research, competition, and demand validation](02-research-and-market.md)
3. [Technical architecture, SDK, backend, and deployment](03-technical-architecture.md)
4. [Smart-contract specification and financial state machine](04-contract-specification.md)
5. [Phased implementation with Codex and development tools](05-codex-build-playbook.md)
6. [Testing, security review, and reproducible evaluation](06-evaluation-and-security.md)
7. [Sponsor selection and submission evidence](07-sponsor-plan.md)
8. [Economics, stablecoin accounting, and token policy](08-economics.md)
9. [Whitepaper draft, pitch, and demo script](09-whitepaper-and-pitch.md)
10. [Verified source register and evidence limitations](10-sources.md)
11. [AEGIS, d4-syn, and ACL: pinned code study](11-competitor-code-study.md)
12. [ACTA source review, trust boundaries, and privacy extension](12-acta-trust-and-privacy.md)

Supporting material:

- [Repository instruction template](templates/AGENTS.template.md)
- [Security review report template](templates/security-review.template.md)
- [Benchmark manifest](templates/benchmark-manifest.template.json)
- [Results table with no fabricated observations](templates/results.template.csv)
- [Environment-variable template](templates/env.example)
- [Build and submission evidence checklist](templates/evidence-checklist.md)

## Decisions that prevent scope drift

| Decision | Position |
|---|---|
| Product | Framework-adaptable TypeScript SDK plus an example dashboard; not a general agent-hosting platform |
| Core contribution | Task-level budget conservation, fenced handoff, and payment reconciliation across worker failure |
| First workflow | A small research procurement workflow with independently verifiable purchased artifacts |
| Money | One supported stablecoin-like token per treasury; no native project token |
| Preferred sponsor route | EF CROPS + Hedera x402 + Arkiv, conditional on the Phase 0 payment compatibility spike |
| Financial source of truth | Immutable, non-upgradeable task treasury contract; backend is a reconstructable projection |
| Privacy | Encrypted recoverable task payloads; public financial accounting in the MVP. Private RPC reads and anonymous eligibility are proposed extensions in document 12, not implemented anonymity |
| Independent recovery | Owner can recover available principal without our orchestrator, database, facilitator, or Arkiv; still needs chain access, owner key, and gas |
| Unresolved purchases | Reserved until confirmed settled or contractually expired; never silently reassigned |
| Novelty | An integration and correctness hypothesis, not a claim of inventing retries, wallets, or idempotency |

## Current build status

Phase 0 includes a compiled single-task payment probe and nine passing local-EVM acceptance scenarios: exact 20-unit payment from a 100-unit funded vault, direct 80-unit owner withdrawal, permissions, caps, transfer binding, replay rejection, epoch handoff, pending obligations and expiry. See [Phase-0 setup and limitations](../phase0/README.md) and [local execution evidence](../phase0/evidence/local-payment-proof.json). That harness uses a local test token; the separate live integration is described below. The initial capability probe reached three public Hedera testnet facilitators; none explicitly advertised transferExecutor.

Live integration update: dedicated testnet accounts are now funded, the HTS adapter is deployed as `0.0.11339236`, and a restricted self-run facilitator settled 0.02 test USDC from a 0.10-USDC vault. Parent/child consensus records and logs confirmed the effects. The owner directly recovered 0.08 USDC. See [Hedera transaction evidence and remaining limits](../hedera/README.md). Public hosted-facilitator support is still not verified; a backend-offline withdrawal demonstration was not completed in this run.

Phase 1 update: a separate multi-task treasury is deployed as `0.0.11339459`. Its proof allocated four task budgets, changed A's worker, recovered only A's available funds with the Phase-0 endpoint offline, and honored A's prior commitment while preserving B/C/D. See [Phase-1 implementation and exact scope](../phase1/README.md). Automatic work resumption, purchase/result persistence and the UI are still unimplemented.

Product-level metrics are **not measured**. Local probe gas figures and executed checks are recorded separately and do not establish product performance. Quantitative acceptance thresholds in this dossier remain proposed engineering targets. Research results remain scoped to the original papers.

The documentation was checked for local link integrity, consistency of the budget example, and template syntax. Those checks are distinct from software tests or a smart-contract audit.

## Immediate next action

Build the SDK/task-aware payment adapter and authenticated receipts, then durable merchant results and the actual failure/resumption runner. Preserve the successful local/live financial evidence. Public hosting, explorer verification and sponsor submission artifacts remain separate work.
