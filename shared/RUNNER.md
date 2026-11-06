# Checkpointed handoff reference

`backend/runner/checkpoint-runner.mjs` persists validated per-task checkpoints and a scheduler assignment outbox. Completed step order and artifact hashes are checked against a versioned task/chain/treasury/graph identity before resuming. Financial truth is read from the contract; checkpoints never reset reserved/spent balances. Every paid step uses a stable logical step ID through the task SDK. The SDK independently verifies current operation state and the returned transaction's Paid event, not just the merchant's assertion.

Before a paid call the runner saves the pending step. After independently reconciled payment and output validation, it saves the completed step. If an acknowledgement disappears between those boundaries, a replacement repeats the same logical operation and obtains the original paid artifact. Completed steps are skipped. A deterministic validator is mandatory; checksum integrity is not proof of semantic correctness or worker authorship.

Handoff checks scheduler authority and replacement eligibility, saves assignment intent before the transaction, then waits for a successful receipt and verifies the exact incremented epoch. A restart can recognize an already-confirmed assignment without incrementing again. If the chain still shows old authority after an earlier uncertain submission, the runner stops for reconciliation rather than sending another assignment. Owner cancellation is respected, and the old worker cannot commit a new checkpoint after an epoch change.

The underlying selector orders authorized, non-busy, unexpired workers with required capabilities by address. The Arkiv adapter now supplies those candidates from v2 queries, separately verifies owner policy and signed readiness, and rechecks eligibility before assignment. The default demo injects a labelled fixture directory; `npm run demo:arkiv` uses real Rabdi discovery with local payments. No eligible worker is a valid waiting condition. Failure detection/reassignment are operator-triggered; no unattended scheduler service or browser task API is started. See [ARKIV.md](ARKIV.md).

## Reproduce from reset

Use Node.js 22, `npm run setup`, and `npm run contracts:compile`, then:

```sh
npm run demo:handoff
```

The demo creates fresh ephemeral local contracts, task records and temporary checkpoints. Four distinct task-worker keys run logical task clients; B/C/D progress concurrently while A is interrupted. The scheduler loses its assignment acknowledgement, restarts, and hands A to B. B reuses A's first paid result and completes only the remaining step. Assertions require exactly five distinct Paid operations, total spend/merchant credit of 100 local base units, unchanged B/C/D state through A's handoff, and no extra spend on another completed restart. This uses local fixture units, not live USDC or a product benchmark.

Observed output is written to ignored `backend/.runner-state/demo/report.json`; the controller marks running/failed/passed explicitly. It contains public local transaction references and accounting, never private keys. The raw test reports are also printed. The test additionally rejects incompatible/corrupt checkpoints, an unauthorized scheduler and a revived old worker. The demonstration moves no live funds.

## Supported boundary

This is a deterministic reference runner: four logical task clients in one test process, not four OS worker processes, a Postgres task API, a real LLM report, or a complete production scheduler. Process-isolated workers, authenticated operator API, richer failure classification, encrypted checkpoint exports and a real model execution are still required to finish that broader phase. Browser-connected orchestration controls remain later work.

State uses fsynced atomic rename and exclusive per-task filesystem locks. Storage must supply those guarantees. A hard-killed process can leave a lock: stop relevant writers and reconcile chain/payment state before an operator removes a stale lock. Locks are never automatically stolen. State hashes detect accidental corruption, not a hostile storage administrator; checkpoints contain plaintext fixture artifacts and require trusted private storage.

The merchant serializes transactions from its signing account within one service instance to avoid concurrent nonce races across tasks. Supported deployment uses one signing service per merchant key. Multi-host signer coordination, finality/reorg handling and distributed transactional storage require separate work. The existing unknown-payment and paid-but-result-unavailable owner decisions remain intact; failure never fabricates a refund.
