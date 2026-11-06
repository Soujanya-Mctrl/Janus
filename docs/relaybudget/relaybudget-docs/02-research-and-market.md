# Research basis, competitive overlap, and demand validation

All sources were checked on 6 November 2026 unless the source register says otherwise. Research motivates requirements; it does not validate RelayBudget or its market.

## 1. Evidence-to-design map

| Source | What it supports | Design consequence | What it does not establish |
|---|---|---|---|
| [R1: SoK, April 2026](10-sources.md#r1) | Agent payments span discovery, authorization, execution, and accounting, with consistency gaps | Model financial operations across the task lifecycle | Demand or superiority of our particular SDK |
| [R2: x402 systematic analysis, v2 June 2026](10-sources.md#r2) | Request substitution, settlement races, and asynchronous state mismatches deserve explicit treatment | Bind request identity, distinguish unknown outcomes, test races | That every current SDK remains vulnerable |
| [R3: facilitator security, July 2026](10-sources.md#r3) | Facilitator implementations are a significant trust boundary; disclosed fixes matter | Pin versions and test the exact selected facilitator/adapter | A current vulnerability in any named service without reproduction |
| [R4: MAST, v3 October 2025](10-sources.md#r4) | Agent failures include specification, coordination, and verification issues | Separate transport recovery from semantic correctness | That replacing a worker fixes arbitrary task failures |
| [R5: OrchestraBench, August 2026](10-sources.md#r5) | Controlled fault injection and failure-mode-specific recovery are useful evaluation methods | Paired seeded trials; measure cascade effects and recovery by fault type | Production recovery rates or savings for our workflow |
| [R6: fencing tokens](10-sources.md#r6) | A delayed former lock holder must be rejected by the resource receiving writes | Enforce assignment epochs at the contract/payment boundary | That database locks alone protect external payments |
| [D1: LangGraph persistence](10-sources.md#d1) | Existing frameworks persist workflow state | Integrate with checkpoints instead of rebuilding orchestration | Atomicity between a checkpoint and merchant settlement |
| [D2: x402 payment identifiers](10-sources.md#d2) | Current x402 already provides idempotency conventions | Use the extension; compare against it as a strong baseline | Uniqueness of "no duplicate charges" as an idea |

### Research numbers, with scope

MAST reports 1,600+ annotated traces across seven frameworks and fourteen failure modes [R4]. This supports systematic failure classification; it is not a measure of paid-agent failure incidence.

The July facilitator study reports testing fifteen facilitators and describes mitigations adopted after disclosure [R3]. Do not reuse its historical vulnerability rates as a current risk estimate.

OrchestraBench's abstract describes controlled mechanism probes, including very different recovery across fault classes [R5]. We adopt its experimental caution rather than importing its numerical recovery rates into our pitch.

No research cited here establishes willingness to pay, market size, a universal agent failure rate, or a speedup for RelayBudget.

## 2. Hypothesis and falsification

Hypothesis H1: preserving financial operation identity and fencing stale executors improves correctness during worker replacement beyond checkpointing plus ordinary payment idempotency alone.

Hypothesis H2: a contract that preserves unresolved reservations lets owners recover available funds without harming previously authorized settlement.

Hypothesis H3: teams with separately paid agent tools experience enough reconciliation burden to adopt the SDK.

Falsifiers: the strongest baseline already provides the same guarantees; the integration overhead exceeds observed failure cost; users do not make separately authorized payments; merchants cannot support persistent operation/result retrieval; or the required public settlement footprint is unacceptable.

## 3. Existing products and winning projects

| Precedent | Verified overlap | Remaining question |
|---|---|---|
| [W1: AEGIS, Lisbon 2026](10-sources.md#w1) | 0G tooling winner; policies, co-signing, and recovery guardian | Can we provide a complete task-aware handoff and independent exit with fewer privileged dependencies? |
| [W2: ACL, Open Agents](10-sources.md#w2) | Two first-place sponsor awards; private negotiation and agent commerce SDK | What remains after its existing SDK and settlement mechanisms are accounted for? |
| [W3: x402-flash](10-sources.md#w3) | New York 2025 finalist and Coinbase award; escrow to avoid blocking responses on settlement | Can we reconcile executor failure and pending obligations without promising a new latency primitive? |
| [W4: Aegis402](10-sources.md#w4) | Open Agents finalist; payment risk checks and optional escrow recovery | Can deterministic workflow constraints add value beyond risk scoring? |
| [D3: Safe allowance module](10-sources.md#d3) | Existing per-token spending authority | Does it already satisfy the intended budget model with a small integration? |

AEGIS's showcase discloses unfinished components, but the later pinned code study found receipt signing, co-signing, and execution code despite contradictory README wording. Do not differentiate through "missing execution" or market a known current vulnerability without reproduction. The [code study](11-competitor-code-study.md) also adds d4-syn's payment-aware provider switching and ACL's existing expiry recovery as important prior work.

Positioning: a task/payment continuity layer that sits beside an orchestrator and uses existing wallet/payment primitives. Novelty is compositional and must be demonstrated in the same failure trace under the strong baseline.

## 4. Why a blockchain here?

Useful when owner recovery must remain available without the application operator, multiple parties need a shared settlement record, and providers accept the payment adapter. The contract can reject stale authority and enforce conserved escrow even if our database is wrong.

Not necessary when a single trusted company controls all workers, tools, and central billing and does not need independent settlement. A durable database plus spending controls may be cheaper. Benchmark this alternative and explain why the intended buyer needs the extra trust boundary.

## 5. Business model and customer selection

First segment: teams already paying per task/tool through wallets, machine-payment gateways, or separately metered services. Avoid broad "all AI companies" claims. Buyer: platform lead. Champion: workflow engineer. Merchant integration is a second adoption dependency.

Potential value: reduced manual investigation, fewer repeated paid steps, bounded financial exposure, and a usable exit path if the hosted service fails. No numeric savings should be advertised before pilot measurement.

Paid APIs are a real adjacent workflow; Coinbase documents SQL access via x402 [M1]. Safe documents treasury spending authority for agents [D3]. These are supply-side/category signals, not evidence of demand for our handoff feature.

## 6. Interview protocol

Recruit ten relevant operators, not ten general AI enthusiasts. Ask for the last actual incident before presenting the solution.

1. Which services do your agents buy, and how are charges authorized?
2. Show a failed paid task: timeline, provider response, charge, retry, and resolution.
3. Did a second worker resume? What happened to the first worker's permissions?
4. How do you distinguish spent, pending, and unused budget?
5. Which existing feature solves most of this already?
6. How much operator time did the incident consume, and what was lost?
7. Can purchased results be retrieved by a replacement under the provider's rules?
8. Would you run an adapter in a sandbox using your own task traces?

Capture redacted artifacts with permission; do not request secrets. Record positive and negative responses. A refusal to adopt because central billing is sufficient is useful evidence.

Proposed proceed gate: three qualified teams with recurring incidents, two shareable failure traces, and one pilot commitment. If unmet, retain as research/tooling project or pivot the customer, rather than inventing traction.

## 7. Pilot scorecard

For each customer: weekly paid tasks; distinct providers; worker-failure incidents; duplicate charges; unretrieved paid results; manual minutes; integration hours; and number of incidents the SDK would actually prevent. Keep denominators and time windows.

Economic test: prevented losses plus saved operator time must exceed integration cost, recurring subscription, infrastructure overhead, and additional settlement fees. Measure value per completed correct task, not transaction count.

## 8. Research extensions, explicitly outside the MVP

Private budget proofs could hide agent allocations while proving conservation. They introduce proving, state discovery, revocation, and recovery complexity. Encrypted mempools protect pre-reveal transaction contents, not confidential historical task budgets. Native frame transactions may enable alternate payment arrangements, but require a real devnet integration. None is required to prove the initial financial-handoff hypothesis.

The route back to the initial Ethereum-privacy interest is a separately measured private funding/authorization adapter, after public accounting and recovery work correctly. Do not describe the initial public contract as a private wallet.
