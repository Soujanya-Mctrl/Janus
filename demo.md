# Janus demo runbook

## The idea in one sentence

**Janus lets an agent task keep its money, paid results and progress when its worker fails, while the owner retains a direct exit for unused funds.**

The budget belongs to the task. Workers receive temporary spending authority. Replacing a worker must preserve existing purchases and obligations, fence stale authority, and continue only unfinished work.

This runbook covers the complete product story and the three intended sponsor tracks. It separates runnable behavior, recorded testnet evidence and planned segments. Track mapping follows the repository's [sponsor verification plan](docs/SPONSOR_VERIFICATION.md); it does not establish prize eligibility or registered track selection.

## The story to tell

“Imagine paying an AI agent to research something. It purchases a source, then crashes before delivering the answer. Starting again can mean paying twice, losing the result, or leaving the old worker able to spend. Janus keeps the financial state and execution progress with the task, so a replacement can reuse the purchase and finish the remaining work. If the service disappears, the owner can still recover available funds.”

Use a research task as the audience-facing example. The current runner uses deterministic artifacts; a real model-generated research report remains a future demonstration.

## What each track contributes

| Intended track | User problem it addresses | How it fits Janus | What to show | Current boundary |
| --- | --- | --- | --- | --- |
| **Hedera — AI Agents That Pay / x402** | Workers need paid tools without unlimited wallet access or repeated human approval. | The treasury enforces task budgets, reservations, settlement and current worker authority. The merchant preserves paid results for replay. | A settled tool purchase, matching treasury debit/merchant credit, original-result retrieval and rejection of stale spending authority. | Local integrated proof and recorded Hedera testnet payment exist. The custom signed HTTP adapter still needs separate x402 compliance evidence. |
| **Ethereum Foundation — CROPS** | An owner should retain control when the application operator disappears. | Direct contract access permits cancellation, release of available funds and owner withdrawal independently of Janus services. | Stop application services; validate deployment identity; recover available funds while preserving pending obligations. | Independent Node.js client and local tests exist. Browser recovery has automated local wallet acceptance; manual extension-wallet/live recovery, full openness/privacy disclosures and submission gates remain open. |
| **Arkiv — Build on Arkiv** | Finding a replacement should be portable across operators rather than tied to one private directory. | Public, expiring worker records would supply candidates; Janus would separately check eligibility, readiness and spending authority. | Publish workers, query them, select a replacement from the query, and wait when no eligible record exists. | Planned. The current runner uses an owner-provided directory; it must not be presented as Arkiv discovery. |

**The combined flow:** Hedera protects the money → Arkiv would help find a replacement → the checkpoint runner resumes the work → CROPS is demonstrated through independent owner control if services fail.

Arkiv discovery does not itself grant spending rights. CROPS is a product property, rather than a dependency. Public payments do not provide financial anonymity.

## Preparation

Use Node.js 22. From the repository root:

```sh
npm run setup
npm run contracts:compile
```

Prepare these views before recording:

1. Terminal for the local handoff demo and its generated report.
2. [Runner behavior and limitations](shared/RUNNER.md).
3. [Recorded live payment evidence](backend/hedera/evidence/task-aware-live-proof.json).
4. [Independent recovery instructions](shared/RECOVERY.md).
5. Optional frontend: `npm run dev`, then open `http://localhost:3000`. Configure authentication through [README.md](README.md) if showing login. Label dashboard balances and task controls **illustrative**.

Keep clear on-screen labels: **LOCAL EVM**, **RECORDED HEDERA TESTNET**, **ILLUSTRATIVE UI**, and **PLANNED**. Never show environment files, private keys, tokens or signed transaction bytes. This runbook does not require new testnet spending.

## Main walkthrough: everything demonstrable today

### 1. Introduce the owner, task and budget

**Say:** “I allocate money to the task, rather than giving a worker an unrestricted wallet. A replacement inherits the task's actual remaining budget, not a fresh allowance.”

Explain the accounting with a separate illustrative example:

```text
Task cap: 100 units
Spent:     20 units — completed purchases
Reserved:  10 units — pending obligations
Available: 70 units — usable or releasable funds
```

Do not identify these example values as the local runner's initial state. Available, reserved, spent, released-to-reserve and withdrawn are distinct quantities. Reassignment does not reset them.

### 2. Run the payment-aware handoff

```sh
npm run demo:handoff
```

Open the newly generated `backend/.runner-state/demo/report.json` and show the reported assertions and accounting. Require a successful exit and a passed report before presenting the run as successful.

Explain the sequence:

1. Four logical tasks A/B/C/D start with distinct worker keys.
2. A's first paid operation settles, but execution is interrupted before normal completion.
3. B/C/D continue progressing independently.
4. The scheduler records reassignment intent and loses the assignment acknowledgement.
5. On restart, it reconciles confirmed assignment rather than incrementing the epoch again.
6. B takes over A, retrieves the original paid artifact and performs only the remaining step.
7. A revived old worker is rejected; restarting a completed task adds no payment.

**Show the result:** exactly **five distinct paid operations**, **100 local base units spent**, matching merchant credit, and no duplicate charge from replay or completed restart. These are fixture units, not a speed benchmark or live USDC.

**Say:** “Recovery includes both the work and the payment. The replacement reuses what was already bought, respects outstanding obligations, and cannot revive the old worker's spending authority.”

This is four logical clients in a local test process. Operator-driven fault injection and replacement do not establish an autonomous production scheduler or four isolated worker processes.

### 3. Show the recorded Hedera purchase

Switch to **RECORDED HEDERA TESTNET**. Open the committed payment evidence; do not imply that the preceding local handoff occurred on Hedera.

The recorded run reports:

- Treasury token balance: `89500 → 69500` base units.
- Merchant token balance: `23500 → 43500` base units.
- Payment amount: `20000` base units, or **0.02 test-USDC**.
- Payment and replay reference the same transaction, with the original result hash retained.

Payment transaction:

```text
0x1d4321df85c55662c29ccb1acbd660afcbcc1790ae276feb671e20e892605814
```

Use that transaction identifier to locate and validate the public explorer record before recording a sponsor submission; save the actual resolved HashScan link. The evidence file records JSON-RPC receipt/event and balance checks. Native consensus child-record verification remains separate, and the source was recorded as dirty.

**Say:** “This separate testnet run records one bounded payment and replay of the same purchase. Our task-aware adapter is implemented; general x402 interoperability still requires its own protocol proof.”

### 4. Demonstrate independent owner recovery

Start with the safe, local proof:

```sh
npm run test:treasury
```

Highlight the recovery cases: identity validation, wrong-owner refusal, cancellation with a pending obligation, later expiry, preservation of other tasks, and restart after release-before-withdrawal. These run on an ephemeral EVM without application services.

For a separate deployment inspection, follow [RECOVERY.md](shared/RECOVERY.md). With real nonzero bytes32 task/operation IDs, run this read-only command from `contracts/`:

```sh
npm run recovery:plan -- ../shared/deployments/hedera-testnet.json TASK_ID OPERATION_ID
```

The placeholders must be replaced; RPC access and current deployment validation are required. This command inspects state and does not withdraw funds. A read-only plan alone is not proof of completed recovery.

For a recorded execution segment, prepare a dedicated test fixture, stop the application services, and capture the actual cancel/release/withdraw receipts and owner balance change following the recovery guide. Execution requires the explicit execution flag and independently controlled owner key. The existing CLI withdraws the **entire unallocated reserve**, including any funds already there; show that effect in the plan before execution.

Use the separate `100 cap / 20 spent / 10 reserved` example to explain why only **70** is immediately recoverable when no other unallocated reserve exists. The 10 remains an obligation until settlement or eligible expiry. Cancellation does not refund the 20 already spent.

**Say:** “The owner can exit through the contract without our backend, login service, merchant or worker directory. They still need their key, chain access and gas.”

## Feature coverage checklist

Use this during rehearsal so the demo covers behavior rather than just screens.

| Capability | Demonstration or evidence | What the audience should learn |
| --- | --- | --- |
| Identity/login | Optional configured frontend | Identity is separate from treasury spending authority. |
| Task-isolated budgets | Treasury suite and local handoff report | One task cannot consume another task's allocation. |
| Reserve, settle, expire and retry | Treasury suite; [interface semantics](shared/TREASURY_INTERFACE.md) | Pending commitments count against the cap; one purchase settles once. |
| Paid tools and authenticated retrieval | Local handoff; [paid workflow](shared/PAID_WORKFLOW.md) | A replacement can retrieve an existing purchase under checked authority. |
| Durable operation/result records | Merchant restart/failure regressions in the paid workflow | Result persistence and payment reconciliation survive supported restarts. |
| Checkpoint validation and resume | Handoff demo | Completed steps are reused; incompatible/corrupt state is rejected. |
| Replacement selection | Local directory selector | Capability/freshness/availability filtering can produce a waiting state. |
| Epoch fencing and assignment reconciliation | Handoff demo and treasury suite | Stale workers cannot create new commitments; lost acknowledgements do not justify blind reassignment. |
| Concurrent task progress | B/C/D during A's interruption | Replacing one task's worker preserves unrelated task state. |
| Unknown payment or missing result | Paid-workflow regression cases | Reconcile uncertainty; require the documented owner decision if a paid result is unavailable. |
| Accounting conservation | `npm run test:protocol` and treasury tests | Available/reserved/spent/returned accounting is checked against accepted histories. |
| Cancellation, release and withdrawal | Independent recovery suite/client | Stopping work, returning allocation and receiving funds are separate steps. |
| Live settlement and replay | Committed Hedera evidence | Recorded testnet debit/credit is separate from local execution proof. |
| Connected dashboard and real model output | Planned segments | These still need integration and their own proof. Browser recovery already passes automated local wallet acceptance. |
| Arkiv-backed discovery | Planned segment below | Public discovery must change replacement selection to be meaningful. |

## Arkiv segment to add when implemented

Do not narrate this as a completed feature. The intended demonstration is:

1. Publish at least two wallet-owned worker records on the current Arkiv testnet, containing deliberately public capability, network/scheme, sequence and expiry metadata.
2. Show the real query, returned entity keys and writer addresses. Keep prompts, credentials and private checkpoint references out of public records.
3. Interrupt A. Show the scheduler selecting a replacement from the query results after independent authority and readiness checks.
4. Expire or invalidate the candidate; show rejection or a waiting state instead of a hardcoded fallback.
5. Disable Janus's hosted directory/cache and reproduce discovery with an independent client.
6. Disable Arkiv reads with fallback prohibited; discovery must visibly wait or fail, while owner recovery remains available.

**Say once proven:** “The directory helps another operator discover a suitable worker. The treasury still decides who may spend, and the checkpoint tells that worker what remains to be done.”

Required evidence and sponsor documents are tracked in [SPONSOR_VERIFICATION.md](docs/SPONSOR_VERIFICATION.md) and the [evidence register](docs/evidence/sponsor-status.json).

## Suggested three-minute presentation

This is an editing target for the walkthrough, not a claim that all submission requirements are satisfied. Pre-run checks and use clearly labelled clips when a command exceeds its slot.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Task and accounting example | “Money and progress belong to the task, so a failed worker does not mean starting over.” |
| 0:20–1:10 | Local handoff and report | “Payment settles, A fails, B/C/D continue, and a replacement reuses the paid result. Five purchases, 100 units, no extra replay charge.” |
| 1:10–1:35 | Recorded Hedera evidence | “Here is the separate testnet settlement and identical payment reference on replay.” |
| 1:35–2:10 | Recovery proof | “Available funds remain recoverable independently; pending obligations remain protected.” |
| 2:10–2:35 | Track mapping; Arkiv marked planned | “Hedera enforces money, Arkiv is intended to supply portable discovery, and CROPS guides independent owner control.” |
| 2:35–3:00 | Current boundaries and closing | “The local financial handoff works. Public discovery, the connected browser experience and real model execution are the next integration gates.” |

When Arkiv and backend-off recovery execution are recorded, replace the planning portion with those actual clips. Until then, present this as the current prototype rather than a completed combined sponsor demo.

## Before sharing or submitting

- Rehearse from reset, inspect the fresh report, and retain commands, source commit, environment, expected/observed results and raw evidence.
- Validate document links and run `npm run sponsors:check`. It checks bookkeeping, not sponsor eligibility. `npm run sponsors:ready` remains the stricter gate and must fail while required evidence is open.
- Recheck official rules and registered tracks through the sponsor plan before claiming compliance. Finish applicable FOSS licensing, CROPS disclosures, Arkiv documents, provenance and AI/human contribution disclosure.
- Keep illustrative screens, local fixtures, recorded testnet evidence and planned behavior visibly distinct. Do not claim production readiness, an audit, private transactions, live end-to-end model execution or a finished Arkiv integration.

**Closing line:** “Janus makes agent work replaceable without making its money, purchases or owner control disposable.”
