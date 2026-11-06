# RelayBudget: finish-by-midnight plan

Planning window: Friday 6 November 2026, 4:45 PM IST to Saturday 7 November, 12:00 AM IST (midnight). Total: 7 hours 15 minutes. This is the user's project completion target, not a verified event submission deadline. This replaces the previous overnight/noon plan.

## Starting point and achievable finish

The inspected workspace contains the RelayBudget dossier and research, with no application implementation found. Assume one developer with coding assistance. The full dossier is beyond this window. Target a runnable, tested hackathon MVP and a recorded demonstration. Live sponsor integration is conditional; a clearly labelled local-chain prototype is the fallback. This is an aggressive time budget, not a guarantee.

By midnight, aim to have:

- A reproducible repository with setup/reset instructions and a locked dependency set.
- One treasury contract and one supported test token; task caps, reservations, settlement, expiry, worker epochs, and direct owner recovery.
- One cooperating merchant with a durable operation ledger and retained results.
- Two workers: A pays for a step, loses its response, and B retrieves the original result and completes unfinished work without a second charge.
- At least one other task progressing independently; no general scheduler required.
- A minimal dashboard plus a separate recovery page that directly uses the contract.
- Passing checks for the financial and failure boundaries, saved evidence, limitations, and a three-minute video.

A local-chain token transfer proves the implemented mechanism locally. It does not establish Hedera/x402 compatibility or sponsor eligibility.

## Scope decisions before coding

Keep: one chain, one token, one treasury, one merchant, one workflow, two worker identities, durable storage, explicit operator-triggered replacement, a minimal dashboard, independent recovery.

Use the simplest installed toolchain. Prefer TypeScript, Solidity, React/Vite, and a durable transactional database. SQLite is an acceptable single-machine demo simplification if setting up PostgreSQL would delay the critical path; preserve uniqueness, transactions, settlement intent, and restart recovery. Combine application services into one process where useful; keep the recovery client independent.

For the smallest contract, direct calls from the assigned worker are acceptable instead of a generalized signed-intent/relayer system. Preserve sender authorization, epoch checks, immutable operation/request binding, a fixed allowed merchant, exact amounts, and bounded reservation expiry. Document deviations from the broader dossier. Do not claim the local adapter is x402.

Defer: Arkiv discovery, additional sponsors, framework adapters, public SDK packaging, general scheduling, marketplace, multichain support, private balances, extra model integrations, broad benchmarks, animations, and production hardening. Do not replace required correctness with dashboard simulations.

## Timetable and hard phase gates

| Time (IST) | Phase | Work | Exit gate |
|---|---|---|---|
| 4:45–5:00 PM | 1. Freeze scope and prepare | Inspect runtimes/contract tooling, select one supported setup, create implementation folders, define the demo scenario and acceptance checklist. | One executable startup path; fixed MVP scope; no missing critical tooling. |
| 5:00–5:30 PM | 2. Prove the payment route | Deploy the smallest local/testnet contract and token fixture. Prove contract-to-merchant transfer and direct owner withdrawal. Attempt the intended live route only within this block if credentials/tooling are ready. | Recorded payment/recovery proof and an explicit local-versus-live decision. At 5:30, unresolved live integration is cut. |
| 5:30–7:00 PM | 3. Build the financial core | Implement deposit/allocation, assignment epochs, reserve/settle/expire, cancel, and owner withdrawal. Use integer accounting. Check balances against independently computed expected values. | Cap/conservation, stale-worker, duplicate-settlement, expiry, permissions, and reserved-funds recovery checks pass. |
| 7:00–8:00 PM | 4. Merchant and durable result reuse | One deterministic paid dataset endpoint; persist operation identity and settlement intent before payment; retain immutable result; reconcile unknown outcomes; reject altered requests under an existing operation ID. | Lose response after payment, restart service, retry, retrieve original result; exactly one settled charge observed. |
| 8:00–8:15 PM | Break and scope checkpoint | Eat, save evidence, commit stable work, list remaining blockers. | Core checkpoint saved. If late, remove UI polish and all optional integrations. |
| 8:15–9:15 PM | 5. Failure and replacement workflow | Wire checkpoints and A/B workers. Inject failure after a paid step; reconcile; confirm epoch increment; resume unfinished work. Run one unrelated task alongside it. | Repeatable end-to-end trace: paid result reused, B finishes, revived A is rejected, unrelated task continues. |
| 9:15–10:00 PM | 6. Minimal dashboard and recovery | Show task, current worker/epoch, available/reserved/spent/recovered amounts, timeline, fail/resume controls, and actual transaction details. Add separate direct-contract owner recovery page. | UI reflects real state; owner can cancel/recover with main app and merchant stopped while the chain remains running. Feature freeze at 10:00 PM. |
| 10:00–10:45 PM | 7. Verification and blocker fixes | Run the critical tests below, reproduce a fresh reset, reconcile the displayed balances, inspect configuration for secrets, and fix only release blockers. | Full demonstration passes twice from reset; meaningful financial tests pass; evidence saved. |
| 10:45–11:30 PM | 8. Package and record | Write exact setup/demo instructions, architecture and limitations; record/upload a three-minute demo; prepare concise submission text and evidence links. | Runnable package, playable video, accurate claims, accessible links. Submit if requested and the relevant form/deadline is known. |
| 11:30 PM–12:00 AM | 9. Protected delivery buffer | Fix startup, video, link, or packaging problems; save final stable commit and backup recording. | Final deliverables verified by midnight. No new features. |

The core dependency is payment proof → contract → durable merchant → worker handoff → UI/recovery → verification → release. A completed UI cannot substitute for a missing payment or recovery boundary.

## Small implementation slices within each phase

### Financial core: 90 minutes

- First 20 minutes: token fixture, deposit, allocation, independently calculated accounting expectations.
- Next 30: assigned-worker reservation, bounded expiry, immutable operation binding, single settlement.
- Next 20: epoch handoff, cancellation that preserves reservations, direct owner withdrawal.
- Final 20: adversarial checks and corrections. Checks accompany implementation; this final block is for consolidation.

### Merchant: 60 minutes

- First 20: durable operation uniqueness, request fingerprint, immutable artifact storage.
- Next 20: persist settlement intent, invoke/reconcile contract settlement, authenticated result retrieval.
- Final 20: inject post-payment disconnect, restart, retry, and conflicting-request checks.

### Runner: 60 minutes

- First 20: deterministic steps and durable checkpoints using stable logical operation IDs.
- Next 20: fail A, reconcile payment, assign B with a confirmed new epoch, retrieve prior result.
- Final 20: continue unfinished steps, reject revived A, show another task's independent progress.

## The demonstration to build toward

1. Deposit 1,000 test units. Allocate A=100 and another task B=100; leave 800 unallocated.
2. Worker A buys a 20-unit artifact. Deliberately lose the response after settlement.
3. Show A: spent=20, reserved=0, available=80. The operation and result remain durable.
4. Assign a replacement worker to task A with a new epoch. It fetches the original artifact without a second debit and completes an unpaid final assembly step.
5. Revive the old worker and show that its new reservation is rejected. Show task B progressing separately.
6. Stop the application and merchant. From the independent recovery page, cancel task A and withdraw its 80 available units. Explain that the initial 800 unallocated units are separate and task B's allocation remains intact.
7. In a separate test/scenario, show that an outstanding reservation remains reserved after handoff/cancellation, and becomes recoverable only after settlement or expiry according to the contract.

Keep the recorded example deterministic. A paid continuation is optional; if added, its cost must change the displayed/recovered balance.

## Required verification before recording

- Task cap equals available + reserved + spent + returned; treasury accounting matches observed token movement.
- Competing reservations cannot exceed available funds; use independently calculated expectations.
- A stale worker cannot reserve after handoff; duplicate settlement cannot pay twice.
- Same logical operation with different request/merchant/amount conflicts; stable operation identity survives restart and handoff.
- A response lost after payment and a process restart return the original result without charging again. Ambiguous settlement is reconciled, never assumed unpaid.
- Existing reservations survive handoff/cancellation. Settlement works before expiry; expiry works at/after the boundary; no double release.
- Unauthorized users cannot assign workers, alter policy, or withdraw. Workers have no unrestricted allowance over treasury funds.
- Owner recovery works with application services stopped and releases only uncommitted funds.
- A separate task continues during failure; demo reset and documented startup work.

Save test output and actual transaction/result identifiers. Do not describe this as audited or production ready.

## Fallback rules: protect the deadline

- Tooling problem at 5:00: use an already working Solidity development environment. Do not spend the evening installing a second stack.
- Live route unresolved at 5:30: local-chain release; remove unsupported live/sponsor claims. No later integration rescue attempt before midnight.
- Financial checks failing at 7:00: spend up to 30 minutes fixing them; remove dashboard polish and automatic handoff to recover time. A persistent money-safety failure changes the deliverable to an explicitly incomplete prototype.
- Merchant behind at 8:00: use a deterministic stored artifact and one process; preserve durable identity and reconciliation.
- Replacement behind at 9:15: use an operator-triggered handoff and command-line runner. Preserve contract authority changes and paid-result reuse.
- UI behind at 9:45: prioritize the standalone recovery page; demonstrate workflow from the command line and use a plain task table if ready. Drop charts and layout refinements.
- At 10:00: freeze functionality. Only fixes, verification, documentation, and recording continue.
- Critical flow still broken at 10:45: record only demonstrated behavior and list the missing acceptance criteria. Do not call the intended full MVP complete.
- At 11:30: stop retakes and polish. Use the stable recording and protect delivery time.

Use a 15-minute investigation limit for a blocker before choosing a narrower supported path. Changing a setup or integration choice is acceptable; dropping accounting correctness, operation identity, or honest claims is not.

## Three-minute video and final handoff

- 0:00–0:20: Problem: an agent can crash after paying, leaving an ambiguous retry.
- 0:20–0:45: Task budget and separate available/reserved/spent categories.
- 0:45–1:20: Paid purchase and injected response loss.
- 1:20–2:00: Replacement, original result retrieval, no extra charge, old-worker rejection, other-task progress.
- 2:00–2:40: Stop services and recover available funds directly. Explain pending commitments.
- 2:40–3:00: What runs locally/live, architecture, and limitations.

Final handoff checklist: source and lockfile; startup/reset instructions; deployment/configuration manifest without secrets; core test outputs; durable operation/payment evidence; standalone recovery instructions; video and backup; truthful description and limitations. Hosted deployment is optional if it threatens reproducibility or the deadline.

At every phase gate record: what works, the evidence, the blocker, and the next action. Save a stable checkpoint before moving on. The first action is to establish the executable development environment and payment/recovery proof, not to start the dashboard.
