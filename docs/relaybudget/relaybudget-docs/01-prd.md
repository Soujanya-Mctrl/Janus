# RelayBudget product requirements

Version 0.1 — design specification, 6 November 2026.

## 1. Problem definition

An agent orchestrator can retry work, and a wallet can cap spending. Neither fact establishes that a funded task can change executors safely while its previous executor has pending requests, signed authorizations, or purchased resources.

The product addresses a narrow failure boundary: task execution, payment settlement, and service delivery do not necessarily complete together. A worker may disappear after committing funds but before recording the result. Reassigning the remaining balance from a stale database number can duplicate purchases or exceed the intended task budget. Research describes payment-service decoupling and cross-stage consistency problems [R1, R2, R3](10-sources.md#research).

### User story

"As the operator of agents buying external services, I want unfinished work to move to a suitable replacement with the correct remaining spending authority, so I do not manually reconcile every failure, repeat paid work, or give workers unrestricted treasury access."

### Not the problem

- General model hallucination, agent intelligence, or universal workflow repair.
- Bypassing rate limits through replacement identities.
- Reclaiming already settled payments without a provider-supported refund.
- Guaranteeing delivery or correctness from arbitrary external services.
- Making every AI API expense onchain. Centrally billed providers may not need this architecture.

## 2. Target customer and buyer

Initial customer: a developer or platform team operating agent jobs that purchase resources from multiple separately paid providers. Buyer: engineering lead responsible for reliability and spending. Users: workflow developer, treasury owner, operator, and merchant developer integrating the adapter.

Best initial workflow: a research service that purchases datasets or analysis artifacts, where results can be persisted and checked by schema and content hash. Avoid a high-value trading bot or arbitrary irreversible tool actions as the first demonstration.

Demand is unvalidated. The existence of paid APIs and agent wallets establishes an adjacent category, not willingness to buy this SDK. See the interview and pilot gates in [research and market](02-research-and-market.md).

## 3. Outcome and value proposition

Primary outcome: a recoverable worker failure does not strand the available task budget or require a duplicate purchase of an already accessible result.

Secondary outcomes: stale worker authority stops working, unrelated tasks continue, owners can recover available funds without our service, and every financial transition can be independently reconciled.

Do not market "exactly once execution" for arbitrary HTTP services. The supported claim is at-most-once settlement per logical operation within the deployed adapter, plus result reuse for cooperating merchants with durable idempotency records.

## 4. Canonical example

Treasury deposit: 1,000 USDC-equivalent units. Task allocations: A=100, B=200, C=150, D=150. Unallocated=400.

After A pays 20: A spent=20, reserved=0, available=80; contract-held accounted balance=980. B, C, and D retain 500 total available. Unallocated remains 400. Thus 980 = 80 + 500 + 400.

If A instead has spent=20 and reserved=10, only 70 is available. Reassignment changes executor and epoch; it does not erase the 10 commitment. A valid pre-existing reservation may still settle before its deadline. "80 remaining" is therefore not always "80 safe to spend now."

## 5. Product boundaries and priority

| Priority | Requirement | Acceptance evidence |
|---|---|---|
| P0 | One treasury and four independently progressing tasks | Chain state and task timeline agree |
| P0 | Fixed funded cap per task | Concurrent adversarial requests cannot over-reserve |
| P0 | Scoped assignment and monotonic execution epoch | Old worker's new reservation is rejected after handoff |
| P0 | Stable logical operation ID and request binding | Different body under same operation ID is rejected |
| P0 | Reservation / settlement / expiry reconciliation | Lost response cannot reset payment state to unpaid |
| P0 | Checkpointed resume on a capable worker | Completed paid steps are reused, remaining steps run |
| P0 | Direct owner cancellation and recovery | Works with orchestrator, DB, indexer, and facilitator stopped |
| P0 | Transaction links and reproducible event log | A third party reconciles balances from receipts |
| P1 | Arkiv discovery of available workers | Replacement lookup reads real entities, verifies authority and freshness |
| P1 | x402-protected cooperating merchant | Paid request settles on chosen network; no hidden wallet bypass |
| P1 | Encrypted task/checkpoint payloads | Public stores and logs contain no plaintext briefs or credentials |
| P1 | One real LLM-backed worker execution | A genuine request produces schema-checked output; financial tests stay deterministic |
| Later | Hierarchical subdelegation | Child allocation conserves parent's spending capacity |
| Later | Private onchain budgets or shielded balances | Only after a viable independent proving/recovery path exists |
| Later | Multiple frameworks, chains, providers | Add after one end-to-end adapter is stable |

No public marketplace, token launch, yield strategy, insurance pool, or general no-code agent builder in the MVP.

## 6. User journeys

### Owner

Connect wallet; deploy or select immutable treasury; deposit supported test token; allocate tasks and policies; authorize an operator to assign workers; monitor budget categories; cancel a task or recover unallocated funds directly. The owner never shares the treasury signing key with a worker or our backend.

### Workflow developer

Wrap a paid tool with the SDK. Supply task ID, stable logical step ID, request fingerprint, price ceiling, checkpoint schema, and merchant adapter. Implement `resume` and `reconcile` behavior. A generic blind retry wrapper is not accepted as completion.

### Operator

Receive failure signal; classify retryable service fault versus semantic task failure; respect `Retry-After`; select a capable authorized worker; reconcile affected financial operations; request onchain assignment epoch increment; wait for the configured finality policy; restore checkpoint; continue. Outages do not imply misconduct and do not justify slashing.

### Merchant

Issue a signed bounded quote. Verify an active reservation and request fingerprint. Persist a settlement intent before network calls. Settle at most once. Persist the result durably and support authenticated retrieval under the original operation ID. Fail closed on missing deduplication state; do not charge again simply because a cache expired.

## 7. UX requirements

The owner sees `Available`, `Reserved`, `Spent`, and `Recovered` separately. Do not label all contract balance as spendable. Display the worker assignment epoch, a reason for failover, and outstanding purchases. Explain that a prior merchant may still collect an already authorized reservation.

Expose a single "Resume with replacement" action after eligibility checks, plus "Stop and recover available funds." The independent recovery screen must not call the main backend. Export contains chain ID, contract address, ABI version/hash, owner identity, task IDs, and encrypted task checkpoints; no private key export by default.

Output acceptance is explicit: schema, required sections, provenance links, and purchased dataset hash. A model's statement "done" is not proof of completion. Semantic correctness remains a user/workflow validation responsibility.

## 8. Acceptance targets

Proposed local acceptance targets, not observed results:

- Zero budget-conservation violations across the defined fuzz/invariant suite.
- Zero accepted new reservations from stale epochs in the adversarial suite.
- Zero duplicate settled charges for a single logical operation within the reference adapter.
- At least 95 of 100 deterministic recoverable-fault trials complete under the bounded fixture configuration. Report failures, seeds, and the interval; this says nothing about arbitrary production workloads.
- All independent-recovery scenarios release exactly the uncommitted amount.
- No unrelated task cancellation during a single-task failover.
- No plaintext task brief, credential, or private key in public Arkiv entities, browser analytics, or exported telemetry.

Performance targets and experimental definitions are in [evaluation](06-evaluation-and-security.md). Safety is a release gate; performance improvement is a hypothesis.

## 9. Assumptions and dependencies

Cooperating merchants preserve idempotency and result records. The selected chain remains available and satisfies the configured finality assumptions. The supported token is transferable and is not paused/frozen by its issuer. The owner retains their key and gas access. A replacement possesses the needed capabilities and authorized provider access. Work can be checkpointed without violating provider access terms.

If a provider loses the result after receiving payment, RelayBudget cannot invent a refund. The task enters `NeedsOwnerDecision`; the owner may explicitly authorize a new paid attempt under a new logical operation ID and the original task cap.

## 10. Delivery and go/no-go

Go: one paid operation, one safe handoff, one stale-agent rejection, one independent withdrawal, and reproducible comparisons against current alternatives.

No-go: standard x402 signing escapes the vault limits; recovery needs our privileged key; unknown payments are relabelled failed; mock transfers are presented as real; or the differentiator is only retry plus a budget display.

After hackathon: seek three design partners, at least two reproducible incidents from their own workflows, and one pilot commitment. These are proposed validation gates, not existing traction.
