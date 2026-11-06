# Reproducible evaluation and security review

Status: evaluation specification only. There are no measured product results yet. Blank result cells mean not measured, not zero.

## 1. What we are trying to establish

Safety: accepted transactions conserve funded budgets, reject stale new authorizations, and do not settle a logical operation twice under the supported adapter.

Recovery: with a suitable replacement and usable checkpoint, selected recoverable faults can complete without repeating paid work. The owner can independently recover uncommitted funds even if the task cannot continue.

Usefulness: the extra complexity creates enough reliability or operational value compared with a strong ordinary implementation. No benchmark can establish willingness to pay.

## 2. Baselines

| ID | Implementation | Why include it |
|---|---|---|
| B0 | Checkpointed ordinary retry, centrally billed mock payment ledger | Shows what conventional orchestration already solves cheaply |
| B1 | Persistent checkpoints + current x402 payment-identifier + merchant result store; application budget checks | Strong baseline for duplicate-payment and result-reuse claims |
| B2 | B1 plus wallet spending limit, without task-level epoch/reservation handoff | Separates existing wallet caps from our proposed contribution |
| R | RelayBudget contract reservations + stable operations + fenced handoff | Proposed system |

Use identical fixtures, prices, task validator, fault timing, and provider behavior. B0 and B1 do not need deliberately broken caching or absent idempotency. If a strong baseline already handles a scenario, report equivalence. Mark a threat-model mismatch instead of inventing an artificial advantage. Compare against a correctly designed central database solution as well as against chain systems.

## 3. Fault matrix

| ID | Injected condition | Required behavior |
|---|---|---|
| F01 | 429 before any payment | Honor backoff; reassign only if alternative access legitimately helps |
| F02 | Worker killed before reserve | Resume without charge |
| F03 | Worker killed after reserve, before settle | Keep reservation until settlement/expiry reconciled |
| F04 | Response dropped after confirmed settlement | Retrieve same paid artifact; no fresh charge |
| F05 | Merchant settles then loses result | Surface paid/unavailable; no fabricated refund or silent repurchase |
| F06 | Old worker wakes after handoff | Reject its new reservation; preserve pre-existing valid obligations |
| F07 | Concurrent requests exceed task free balance | Only admissible reservations succeed |
| F08 | Assignment races with reserve | Correct outcome for both canonical transaction orderings |
| F09 | Settlement races with expiry/cancellation | Exactly one valid terminal outcome; no loss of accounting |
| F10 | Scheduler or database restarts | Rebuild financial view from chain; resume only validated state |
| F11 | Arkiv unavailable or stale worker record | No false authority; owner exit works; task may wait |
| F12 | All our services stopped | Direct owner cancel, expire, and recover available funds |
| F13 | Reused op key with different body/recipient | Reject fingerprint conflict |
| F14 | Source event removed by EVM reorg simulation | Projection rolls back tentative state; no false final settlement |
| F15 | Corrupt or incompatible checkpoint | Reject resume and surface owner decision |
| F16 | Semantic error despite healthy transport | Output validator fails; do not count transport handoff as task success |

Test account-wide rate limits separately from worker-specific failures. A second worker sharing the same quota is not a recovery. Include no-capable-worker and permanently unavailable-provider cases; correct behavior may be waiting or owner exit, not successful task completion.

## 4. Experimental design

Local fixture: 1,000 base display units split as in the PRD, fixed artifact contents, deterministic merchant prices, four tasks, and known expected outputs. Store the exact task graph and hashes. Use a logical clock for reproducible event order plus a real monotonic clock for runtime measurements; never compare logical time with production latency.

Predeclare a seed list before execution. Minimum development run: ten seeds per supported failure type per applicable system. Evaluation target: 100 paired trials per selected recoverable class after implementation. Use the same seed across systems. Randomize execution order or alternate systems to reduce warm-cache bias. Record warmup separately.

Add a failure-free control to quantify overhead. Separate deterministic fixture runs from real-model runs and live testnet runs. No controlled benchmark throughput is a claim about the public network. Record unavailable trials and timeouts in the denominator.

Real-model evaluation: fixed provider/model identifier, prompt hash, sampling parameters, tool set, price schedule, and task validator. Nondeterminism may remain even at low temperature. Report the sample size and cost separately; do not mix with deterministic safety results.

## 5. Metric definitions

| Metric | Definition | Proposed acceptance / reporting |
|---|---|---|
| Budget violation count | Any accepted trace with spent+reserved greater than cap | Zero observed in defined suite; not a proof of absence |
| Duplicate settlement count | More than one successful settlement for the same scoped op key | Zero in supported contract adapter |
| Stale authority acceptance | Successful NEW reservation using old epoch after canonical handoff | Zero; pre-existing settlements are not violations |
| Task completion rate | Validator-passing tasks / all attempted tasks | By failure class and system; never exclude timeouts |
| Recovery rate | Validator-passing eligible recoverable trials / all trials preclassified eligible | Initial target >=95/100 in deterministic fixtures |
| Time to first resumed progress | First validated new step after fault minus fault time | p50/p95; include detection, queue, chain, restore components |
| Task latency | Validated completion minus task start | Median/p95; report censored timeouts separately |
| Cost per successful task | Total settled tool charges + chain fees + measured compute costs across all attempted runs / successful tasks | Includes failed-run costs; no cherry-picked denominator |
| Duplicate purchase loss | Charges for same intended artifact beyond accepted original purchase | Separate approved paid retries from accidental duplication |
| Recovery completeness | Owner recovered amount / independently computed uncommitted amount | Exactly 1 under supported fixture assumptions |
| Collateral wait | Available-but-reserved duration until obligation terminates | Report TTL effect and safety/availability trade-off |
| Cascade impact | Unrelated tasks newly failed/cancelled due to injected fault | Zero target for isolated fixture; report shared dependency effects |
| Gas/fee per operation | Reserve/settle/assign/cancel/expire/withdraw from receipts | Report actual native units and conversion assumptions |
| SDK integration effort | Engineer hours to adapt one existing paid tool | Pilot observation, not a code-generation estimate |

No universal speed target is defensible before chain and service measurements. Optional local goal: scheduler/SDK overhead excluding network/model time below 100 ms p95 at the declared concurrency on recorded hardware. This is an engineering target, not a published result or guarantee.

## 6. Evidence and statistics

Every run saves: commit, dirty flag, OS/CPU/RAM, runtime and dependency versions, contract bytecode hash, compiler, chain ID, RPC identity (redacted), token config, task graph hash, fixture hash, seed, fault schedule, model settings, timestamps, raw events, receipts, output validator result, and exit code. Use [the manifest template](templates/benchmark-manifest.template.json).

Keep append-only JSONL events with correlation fields `runId/taskId/stepId/opKey/reservationId/epoch/txHash`; omit secrets and plaintext briefs. Derive financial totals from chain receipts/contract reads independently of the dashboard.

For paired latency/cost differences, bootstrap paired trials with a recorded statistical seed and report a 95% interval. For proportions, show numerator/denominator and a Wilson interval. Do not quote p95 from a tiny sample without a sample-size warning. All failures and timeout rules are published with the report. Publish only aggregate/redacted customer evidence.

Financial tests use exact integer equality. No tolerance band hides missing funds. Token USD conversions are separate reporting assumptions, never custody calculations.

## 7. Mutation and negative controls

Deliberately remove the epoch check in an isolated test mutation: F06 must fail. Remove reservation accounting: F07 must fail. Change op-key scope to include worker epoch: the duplicate-purchase regression must fail. Make merchant cache volatile: lost-response/result tests must expose the limitation. None of these mutations ships.

If the suite passes a known-broken mutation, the suite is inadequate. Do not compensate by increasing a coverage percentage.

## 8. Threat model and trust

Adversaries: compromised worker, delayed former worker, hostile input/prompt injection, malicious scheduler within its role, faulty/colluding merchant, replaying relayer, stale indexer, and unavailable RPC. The owner is the trust root. A compromised owner can withdraw available funds and change allowed configuration.

Protect: financial conservation, scoped authority, uniqueness of settlement, explicit unresolved obligations, credential handling, and independent owner exit. Do not claim guaranteed merchant delivery, objective task truth, anonymous payments, protection from token issuer freezes, or continued operation through a halted chain.

The scheduler can waste a task's allowed budget through collusion; merchant allowlists and caps reduce but do not eliminate that risk. A legitimate provider can return poor data. Checkpoint integrity says bytes did not change, not that those bytes are correct or safe to execute.

## 9. Security review process

1. Freeze a review commit and inventory roles, external calls, dependencies, token assumptions, signatures, and state transitions.
2. Run compilation, contract unit/fuzz/invariant tests, SDK typechecks, integration tests, browser recovery, and Slither.
3. Triage each static warning with code path, impact, and reproduction; preserve justified false positives with rationale.
4. Review authorization, cancellation/settlement race, op identity, expiry, unrestricted allowances, recovery, request substitution, and DB/chain disagreement manually.
5. Require a minimal executable failing test for every confirmed code finding. Fix, demonstrate the test turning green, and rerun affected invariants.
6. Perform an independent review pass using a fresh Codex review context or another reviewer. AI-assisted review is not an independent professional audit.
7. Publish unresolved issues and tested boundaries using [the report template](templates/security-review.template.md).

No mainnet or real customer funds before an appropriately scoped external audit, operational key management, and production risk review. That is a product release criterion, not a claim that this document performed those tasks.

## 10. Release evidence gates

All P0 safety regressions pass; no unresolved critical/high issue; independent recovery demonstrated with actual service shutdown; exact dependency versions recorded; fresh checkout reproduction succeeds; supported token and adapter assumptions explicit; and benchmark output contains no fabricated or prefilled result numbers.

The final pitch must say "we observed X in N trials under Y conditions" after measurement. Until then say "we will test X" or "target X." Never relabel research-paper measurements as product performance.
