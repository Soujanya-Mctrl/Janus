# Whitepaper draft and pitch materials

All text is reusable boilerplate for the proposed system. Replace bracketed results only after measurement. Do not submit placeholders as findings.

## 1. Plain-language explanation

Imagine a manager gives four assistants different jobs and separate spending limits. One assistant buys useful information, then becomes unavailable. Another finishes its own job. The manager should be able to give that free assistant the unfinished work and the money still available, without paying again for information already purchased.

RelayBudget applies that idea to AI agents. The money stays attached to the task. A worker receives temporary permission to spend it. When a worker fails, the system checks what was actually paid, preserves unresolved commitments, disables the old worker's new spending, and gives a suitable replacement the progress and available budget. If the system cannot continue, the owner can recover uncommitted money directly.

## 2. One-sentence pitch

**RelayBudget lets agent workflows switch workers safely without losing track of their progress, purchases, or remaining spending authority.**

## 3. Thirty-second pitch

AI agents can buy tools, but a failed worker leaves a difficult question: did it spend the money, did it receive the result, and can another agent safely continue? RelayBudget ties a budget to the task instead of the worker. It tracks paid and pending operations, blocks stale spending authority, and hands the unfinished work to a suitable replacement. The owner keeps a direct exit for unused funds even if our service disappears.

## 4. Ninety-second pitch

Your company gives an agent team a 1,000-dollar operating budget. Agent A gets 100 dollars for a research task. It spends 20 dollars on a dataset, then crashes. The other agents are still working.

Restarting the task is easy. Restarting it without buying the dataset again, overspending the budget, or leaving the old worker able to spend is harder.

RelayBudget is an SDK for that handoff. It keeps money in a task treasury, gives workers temporary spending authority, and records each purchase under a stable operation ID. When another capable agent becomes available, the system reconciles pending payments, restores the checkpoint, and changes the task's execution authority. The replacement uses the already purchased dataset and finishes the remaining work.

Our demonstration will also stop the backend and show the owner recovering available funds directly. The initial implementation exposes financial state publicly and keeps task payloads encrypted offchain; we do not claim anonymous purchases or guaranteed refunds.

We are testing this with a controlled failure benchmark against checkpointing and current payment idempotency. Our intended customers are developers whose agents already buy separately paid services. Customer demand and production savings remain to be validated.

## 5. Three-minute demo script

| Time | Show | Explain |
|---|---|---|
| 0:00–0:20 | Four task cards and funded treasury | A task should survive a worker failure without losing financial control |
| 0:20–0:45 | Real paid dataset request and explorer receipt | A spends 20 of its 100-unit allocation; data and receipt are saved |
| 0:45–1:05 | Kill A or inject legitimate 429 | Other tasks keep progressing; timeout does not imply unpaid |
| 1:05–1:35 | B finishes, registry lookup, epoch increment | B is capable and available; pending obligations stay reserved |
| 1:35–2:00 | B resumes and reuses dataset | Stable operation identity prevents another charge in our adapter |
| 2:00–2:20 | Revive A; rejected reserve | Old authority cannot make new commitments |
| 2:20–2:45 | Stop main services, open independent recovery | Owner cancels and withdraws only available funds |
| 2:45–3:00 | Measured evidence and limitations | Show actual run count/results if available; never fabricated savings |

A simulated fault is acceptable as a test mechanism if labeled. A simulated transfer is not a real sponsor payment. If using local units for the 1,000 example, label them test units; distinguish live deployment values.

## 6. Whitepaper boilerplate

### Title

RelayBudget: Task-Scoped Spending Authority and Payment-Aware Recovery for Multi-Agent Workflows

### Abstract

Multi-agent applications increasingly interact with paid services, creating a boundary between workflow execution, payment settlement, and result delivery. Replacing a failed worker can preserve neither financial correctness nor previously purchased work unless these states are reconciled explicitly. We propose RelayBudget, a task-scoped budget and handoff protocol with contract-enforced reservations, monotonic assignment epochs, durable operation identity, and an independent owner exit. The design targets cooperating merchants and a single settlement domain. We specify accounting invariants and an evaluation protocol comparing conventional retry, persistent payment idempotency, wallet spending limits, and task-aware handoff. Implementation results and production demand remain future work.

### 1. Motivation and related work

Research identifies cross-stage inconsistency in agent payments [R1-R3]. Multi-agent failure studies show that failures span more than tool availability [R4-R5]. Existing systems provide checkpoints, wallet allowances, x402 idempotency, and agent commerce frameworks [D1-D4, W1-W4]. RelayBudget's proposed contribution is the composition of these mechanisms at task replacement, not their individual invention. See the research dossier for comparison boundaries.

### 2. System and adversary model

Actors are the treasury owner, scheduler, workers, merchants, facilitator, and chain. A worker may crash, be delayed, or become compromised. Scheduler and indexing services may be unavailable. The owner key is trusted. Merchant delivery and task semantics are not guaranteed by the settlement contract. Public chain visibility is part of the initial threat model. The primary supported domain is one contract and one token on one chain.

### 3. Protocol sketch

Owner funds and allocates a task. Scheduler assigns executor e with monotonically increasing epoch k. Executor creates a signed bounded reservation for stable operation o. The contract checks policy and available collateral, then fixes recipient, amount, and expiry. A merchant/facilitator settles before expiry; otherwise anyone can expire the obligation. Assignment to a replacement increments k but preserves prior fixed obligations. A settled operation cannot settle again. Owner cancellation returns free funds and preserves bounded pending commitments.

### 4. Safety properties

Budget conservation: task cap equals free plus reserved plus spent plus returned. Treasury conservation: accounted collateral equals unallocated plus all free/reserved task balances. Stale authority exclusion: an old epoch cannot create a new reservation after the newer assignment in canonical order. Settlement uniqueness: a scoped logical operation becomes permanently settled at most once. Owner exit: available funds can return without an application-operated service, subject to chain/token/key/gas assumptions.

These are specified properties and an induction argument, not a machine-checked proof or completed audit. The implementation must be checked against an independent model and adversarial traces.

### 5. Liveness and limitations

Task progress requires a capable worker, service availability, recoverable checkpoint data, and a valid output validator. Unknown payment outcomes trade availability for safety. Reserved funds are unavailable until settlement or expiry. Provider-wide quotas cannot be bypassed by changing worker names. The system cannot restore lost private keys, unpause an issuer-frozen token, guarantee refunds, or make arbitrary external side effects exactly once.

### 6. Implementation

Describe the actual release only: contract compiler/version, chain/token, schema versions, client package versions, backend persistence, adapter/facilitator scheme, recovery client, and key locations. Link bytecode/source verification and explain every centralized dependency. The current dossier is a plan, not this implementation section's final evidence.

### 7. Evaluation

Use the protocol in `06-evaluation-and-security.md`. Fill a results table with observed sample counts, completion, duplicate settlements, stale authority acceptance, recovery correctness, cost, and time. Include failure-free overhead and strong baselines. Publish manifests and failed seeds. Do not substitute an LLM-generated opinion for executable financial evidence.

### 8. Economics

Existing supported stablecoin principal and network gas; no native project token. Hosted software revenue is independent of custody. Token issuance, speculative rewards, insurance, and slashing are not required by the proposed protocol.

### 9. Future work

Hierarchical budgets, private authorization proofs, interoperable merchant result retrieval, framework adapters, and formally verified financial transitions. Cross-chain spending requires a new global-budget design; do not extend single-chain safety claims across bridges by analogy.

### 10. Results table template

| Measure | Baseline B1 | RelayBudget | Conditions |
|---|---|---|---|
| Trials | [not measured] | [not measured] | Same workload and fault schedule |
| Valid completion | [not measured] | [not measured] | Numerator/denominator |
| Duplicate settled payments | [not measured] | [not measured] | Contract/provider scope stated |
| Stale authorizations accepted | [not measured] | [not measured] | New reservations only |
| Recovery latency p50/p95 | [not measured] | [not measured] | Hardware/network disclosed |
| Cost per correct completed task | [not measured] | [not measured] | Includes failed-run costs |

### References

Use the primary sources in [the source register](10-sources.md). Verify publication versions again before external publication. Obtain a proper bibliographic export for papers rather than inventing venue details.

## 7. Likely judge questions

**Why not just retry?** Retry may already be sufficient. Our claim concerns preserving payment obligations and spending authority across executor changes; the benchmark includes a correct retry/idempotency baseline.

**Why blockchain?** Independent owner exit and shared enforcement across parties. If a trusted central database meets the customer's needs, it may be the better solution.

**Can the old agent still spend?** It cannot create new reservations after the epoch change, but already authorized reservations can settle until expiry.

**Do you refund a paid failed request?** Not automatically. We retrieve existing results where supported and surface provider recovery/refund paths.

**Is it private?** Initial financial state is public. Task data is encrypted offchain and metadata is minimized; fully private balances are future work.

**Where is demand?** [Insert actual interview/pilot evidence, or state it is unvalidated.] Winning adjacent projects are not customer traction.

**Why no token?** The financial controls need collateral, authority, and records; a new tradable asset is unnecessary.
