# AEGIS, d4-syn, and ACL: a source-backed study

Reviewed 6 November 2026. Method: static walkthrough of 24 selected source/document/test files and repository trees. No repository code, dependency installation, test suite, mainnet/testnet transaction, or performance benchmark was executed. This is a comparative engineering study, not a security audit.

The [read-set manifest](templates/competitor-readset.json) records exact paths and commits. Findings describe those snapshots, not every branch, historical submission, or future release. Presence of a test is not evidence that it passed.

## 1. The conclusion before the detail

RelayBudget cannot differentiate merely through spending caps, reservations, recovery, agent SDK packaging, or provider failover. Each has meaningful precedent among these projects.

The remaining candidate contribution is a specific composition: a parent-funded task makes several paid purchases; its worker fails; another eligible worker takes over that same task and its available spending authority while previous payment obligations and purchased results remain attached to it. Old authority is rejected without retroactively revoking valid merchant commitments. Other tasks continue.

That difference is narrower than our early idea, and not yet proven unique or commercially valuable. It should be demonstrated against the strongest existing mechanisms, not asserted from project names.

## 2. Pinned repositories and recognition

| Project | Snapshot | Verified award |
|---|---|---|
| [AEGIS](https://github.com/Inteli-Club5/AEGIS/tree/14b6c50e6ebf44d2eaa099e2e005025e83c86960) | `14b6c50e6ebf44d2eaa099e2e005025e83c86960` | [Lisbon 2026: 0G infrastructure/tooling](https://ethglobal.com/showcase/aegis-93ox5) |
| [d4-syn](https://github.com/alienworld1/d4-SYN/tree/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad) | `b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad` | [HackMoney 2026: ENS integration pool prize](https://ethglobal.com/showcase/d4-syn-d16fh) |
| [ACL](https://github.com/cqlyj/ACL/tree/2cb82511c562bfa02d6f088f3222dfdeb11e9504) | `2cb82511c562bfa02d6f088f3222dfdeb11e9504` | [Open Agents: first-place 0G tooling and ENS integration](https://ethglobal.com/showcase/acl-6hwos) |

The d4-syn award is a pool prize, not a ranked first place or finalist designation. Award recognition does not establish adoption, security, or production completeness.

## 3. AEGIS — permission and verification around an agent wallet

### Product and architecture

AEGIS addresses unsafe agent spending. It combines deterministic policy checks, semantic verification, a protected Safe wallet, and a co-signing path. Its submission describes limits, permitted destinations/assets, expiry, and a guardian design. The inspected code has substantial structured validation rather than only prompt instructions.

The flow in the payment implementation is: read durable verification/action state; check identity and hold; create and sign a decision receipt; construct a Safe transaction; obtain agent signature; call co-signer; execute; then commit usage and store execution evidence.

### What the source establishes

- The [deterministic evaluator](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/services/agent-service/src/policy-engine/evaluator.ts#L171) checks structured policy state. Its usage snapshot explicitly distinguishes amounts used and held. Reservations are therefore not a novel idea we can claim.
- The [precheck implementation](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/services/agent-service/src/policy-engine/precheck.ts#L238) performs transactional idempotency/usage processing and creates UsageHolds.
- The [execution service](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/services/agent-service/src/payment/execute.ts#L52) contains receipt signing and the co-signer request; execution is not simply absent.
- The [co-signer](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/services/cosigner/src/cosign.ts#L40) validates receipt/payment correspondence, signs, and calls Safe execution. That establishes code existence, not a successful live run by this study.
- The inspected [co-signer tests](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/services/cosigner/src/cosign.test.ts#L97) include stale/unexpected signatures and tampered payment fields. They were not run here.

### Important documentation correction

The [README](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/README.md) says the branch stops at verification. The [scope document](https://github.com/Inteli-Club5/AEGIS/blob/14b6c50e6ebf44d2eaa099e2e005025e83c86960/docs/aegis-current-scope.md) has conflicting historical/future wording and a later section describing an implemented execution handoff. The code confirms an execution path exists. Therefore our earlier idea of differentiating by merely completing AEGIS's missing execution was too broad and is withdrawn.

### Difference from our scenario

The inspected policy and payment flow is tied to an agent/wallet/action. It does not establish the complete four-task shared-treasury scenario with persisted partial task completion, same-task executor replacement, and reassignment of an unspent task balance. We cannot infer that such behavior is impossible to add; only that it is not demonstrated by the reviewed paths.

### What to learn and what to test next

Learn structured intent hashes, explicit states, used-versus-held accounting, and separate verification/signing responsibilities. For RelayBudget, make the task rather than the agent the durable financial identity.

Proposed comparative test: execute a payment, lose the co-signer HTTP response before application acknowledgement, and retry from a replacement worker. Check chain settlement and persisted usage separately. The reviewed code commits usage after the co-signer response, making this boundary worth testing; this study does not claim a reproduced double-spend or confirmed vulnerability.

## 4. d4-syn — provider switching during paid inference

### Product and architecture

d4-syn procures streamed inference from providers discovered through ENS, using a Yellow client wrapper for payments. It monitors chunk timing and price, and switches providers while carrying a text buffer. This is the closest precedent for a visually compelling paid-work failover demo.

Its [AgentBrain](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/lib/agent-brain.ts#L352) opens a channel, requests a stream, appends received text, invokes SLA-adjusted payment, and evaluates switching. The [switch function](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/lib/agent-brain.ts#L490) closes/reset the current channel and selects another provider.

### What the source establishes

1. **Context is sent during handover.** AgentBrain includes `history` when switching. However, the inspected [reference provider route](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/app/api/agent/%5BagentId%5D/route.ts#L23) extracts only `prompt` and calls the model with it. It does not consume that `history` field. This limits the demonstrated end-to-end checkpoint claim for that route; another external provider could implement it differently.
2. **A send is not a confirmed payment.** [YellowClient.pay](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/lib/yellow-client.ts#L678) decrements a local balance and sends a payment message without waiting for its response. It then returns a success-shaped result. The catch path does not roll back the optimistic balance. Thus the local return is not proof of settlement.
3. **Channel cleanup is not guaranteed recovery.** [closeChannel](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/lib/yellow-client.ts#L853) resets local channel state even after an error. Switching UI state cannot by itself establish that earlier commitments settled or funds became withdrawable.
4. **Some faults are detected only after another chunk.** SLA timing is evaluated in [payWithSLA](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/lib/yellow-client.ts#L748), called from the content loop. A permanently stalled `reader.read()` does not itself invoke that path. The inspected HTTP error catch sets ERROR rather than performing the same provider switch. Do not generalize the feature to all outages without testing.
5. **The bond contract is a different financial object.** [ServiceBond](https://github.com/alienworld1/d4-SYN/blob/b4a2f4606dbab09b6f6f6fc3c7c5d0a485958fad/contracts/src/ServiceBond.sol#L14) holds provider collateral against an ENS node and offers exit/withdrawal. It is not a task budget or a record of each tool purchase.

The reference provider does call a real model API when configured and includes artificial latency controls. A deliberately injected fault is a useful demo technique, but performance under that fixture is not a production SLA benchmark. We have not reproduced the submission's sub-second timing claims.

### What to learn and what to test next

Learn its narrow visual story: one stream changes providers while the user sees progress and price. For RelayBudget, carry a typed checkpoint and durable artifact/operation identifiers, not only an accumulated text buffer. Maintain submitted, pending, and settled payment states independently of the visible channel.

Proposed comparative tests: suppress all further chunks; reject a payment acknowledgement; fail channel closure; restart the browser; and verify whether the reference provider actually uses the supplied history. Distinguish observable source behavior from a demonstrated exploit or runtime performance result.

## 5. ACL — agent commerce as a reusable SDK

### Product and architecture

ACL has a broader commerce pipeline: discovery, negotiation, a task specification, job escrow, provider submission, evaluation, and settlement. Its SDK is useful precedent for packaging infrastructure into replaceable components.

The [client agent](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/sdk/packages/agent/src/agents/client.ts#L271) drives a job, discovers and ranks providers, negotiates, uploads the task specification, creates/funds the job, then waits for settlement. Its negotiation loop walks candidates before the job is funded. This is real overlap with discovery and fallback; we should not claim those as new.

### What the financial contract actually does

- [setProvider](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/src/core/AgenticCommerce.sol#L234) permits provider assignment on an Open job, with an initially unset provider. It does not expose same-job funded provider replacement through this function.
- [fund](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/src/core/AgenticCommerce.sol#L278) escrows the agreed job budget.
- [complete](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/src/core/AgenticCommerce.sol#L323) releases the job's budget net of configured fees. This is a delivery-job payment, not a ledger of multiple incremental tool purchases.
- [reject and claimRefund](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/src/core/AgenticCommerce.sol#L363) provide refund paths; expiry refund sends funds back to the client and is not gated by the job hook. Independent contract recovery already has precedent here.
- [AgenticCommerce tests](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/test/AgenticCommerce.t.sol#L262) contain expiry/refund cases. They were not executed in this study.

The contract exposes public job budget/provider state. Private negotiation should not be interpreted as fully private financial settlement. Evaluator signature verification establishes a configured source for a verdict; it does not mathematically establish that every subjective deliverable is correct. See [ACLEvaluator](https://github.com/cqlyj/ACL/blob/2cb82511c562bfa02d6f088f3222dfdeb11e9504/src/core/ACLEvaluator.sol#L87).

### Difference from our scenario

ACL's inspected escrow is well suited to paying a provider for a deliverable. Our proposed task budget is an operating allowance that can pay many merchants, preserve earlier expenses, and survive worker replacement. Expiring/refunding an ACL job and creating a new one may handle some use cases perfectly well; RelayBudget must demonstrate why that is inadequate for its chosen workflow.

If the application is simply "hire an agent and pay after approved delivery," use or extend an existing commerce design rather than build our proposed treasury machinery.

### What to learn and what to test next

Learn versioned task specs, modular packages, typed events, explicit escrow states, and direct refund tests. Run a comparative case where a funded provider becomes unavailable after two paid tool purchases. Determine whether a new job plus refund is sufficient, and measure the extra coordination needed to preserve artifacts and valid old obligations.

## 6. Comparison of the reviewed paths

| Capability | AEGIS | d4-syn | ACL | RelayBudget proposal |
|---|---|---|---|---|
| Structured spending restrictions | Deterministic policy and Safe flow | Session allowance/local client logic | Agreed job budget | Task cap, merchant policy, contract checks |
| Held versus used accounting | Explicit UsageHolds | Local optimistic payment balance in reviewed wrapper | Whole-job escrow | Free/reserved/spent/returned |
| Replacement before funding | Not established in reviewed flow | Provider selection | Ranked negotiation fallback | Worker eligibility/discovery |
| Mid-work switch | Not established in reviewed flow | Stream/provider switch implemented | Not through funded `setProvider` | Proposed task epoch handoff |
| Context preservation | No task subsystem demonstrated | Text sent; inspected local server ignores history | Task spec and deliverable artifacts | Typed checkpoint plus operation ledger |
| Owner/client exit | Guardian design; runtime path needs separate verification | Provider bond exit; channel recovery needs verification | Contract expiry refund | Proposed owner cancellation plus expiry-aware withdrawal |
| Full financial privacy | Not established | Not established | Public escrow fields | Explicitly absent in public-accounting MVP |
| This study ran tests | No | No | No | Product not implemented |

"Not established" means the selected paths do not prove it. It is not a claim that an entire repository can never provide it.

## 7. Changes to our plan

1. Keep RelayBudget as a small SDK beside an orchestrator; do not compete with ACL as a general agent marketplace/framework.
2. Treat spending caps, holds, receipts, and refund paths as baseline capabilities.
3. Center the comparison on post-purchase worker replacement with unknown payments and stale authority.
4. Require merchants to preserve operation/result identity across executor changes. Handoff payload delivery alone is insufficient.
5. Make the independent exit test stop our DB/facilitator/scheduler and use authoritative contract state. Do not equate a UI reset with fund recovery.
6. Do not claim fully private budgets, universal outage recovery, automatic refunds, or unique invention of provider switching.
7. Benchmark a conventional durable database/checkpoint/idempotency solution as a serious alternative. If it meets customer needs more simply, reconsider the chain boundary.

## 8. Practical study exercises

For each repository, first trace the exact successful path, then one failure path, then the recovery authority. Run untrusted project code only in an isolated test environment after reviewing scripts and dependencies; use new test credentials and no real funds. Never import owner wallets or paste secrets into a sample app.

Exercises to implement separately:

- AEGIS: lost execution acknowledgement and usage reconciliation, plus documented-versus-actual scope check.
- d4-syn: permanent stream stall, failed acknowledgement, failed close, and observable history consumption.
- ACL: expiry refund, provider assignment before/after funding, and new-job continuation after partial work.
- RelayBudget: combine a 20-unit settled purchase, a 10-unit unresolved reservation, and 70 available units under a replacement epoch. Demonstrate the replacement cannot spend 80 and the old worker cannot create a new commitment.

No customer demand evidence was obtained by this code study. The immediate business test remains asking actual paid-agent operators whether this boundary causes enough cost to justify adoption.
