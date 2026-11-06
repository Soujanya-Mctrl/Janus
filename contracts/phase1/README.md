# Phase 1: multi-task financial core

Implemented the reusable, single-token treasury for isolated task budgets. It has local acceptance tests and a separate live Hedera HTS proof. This phase implements financial authority and recovery; the automatic workflow runner, purchase/result ledger and dashboard are later phases.

## What the treasury enforces

- The owner deposits funds into an unallocated reserve and creates separate task allocations. Each task has its own worker, fixed merchant, per-operation limit, epoch and accounting.
- A worker can reserve only its own task's available balance. Other tasks' funds and the root reserve cannot subsidize overspending.
- The owner or an explicitly appointed scheduler can replace a worker. The scheduler cannot create budgets, alter merchants/limits, cancel tasks, release funds or withdraw.
- A handoff changes future authority. Previously approved payments remain payable until their own deadline, including after cancellation.
- The owner can release a task's available funds to the root reserve and withdraw unallocated funds directly. Reserved money cannot be withdrawn as available principal.
- A settled logical operation can never pay again. An expired operation can retry only after on-chain expiry, with the next attempt number and the same request commitment and amount. Old attempt authorizations remain invalid.
- Token transfers must have exact observed balance effects. Failed transfers revert the accounting changes. Unsolicited tokens do not inflate the spendable ledger.

Task IDs cannot be reused and task caps/policies cannot be increased in place. New work can use a fresh task ID funded from returned or newly deposited reserve. This keeps the first implementation small and makes operation history persistent.

## Accounting

```text
task.cap = task.available + task.reserved + task.spent + task.returned

accountedBalance = unallocated + sum(task.available + task.reserved)
deposited = accountedBalance + totalSpent + totalWithdrawn
actual token balance >= accountedBalance
```

`task.returned` means released to the root reserve. `totalWithdrawn` means actually transferred back to the owner. They are different counters; a release is not itself a wallet withdrawal.

## Run locally

```sh
npm run phase1:compile
npm run phase1:test
```

The test runner compiles Solidity 0.8.30 with the Shanghai target and optimizer/viaIR, then executes actual contracts on an ephemeral local EVM. It needs no testnet credentials or funds. It writes its observed status and canonical scenario to `evidence/treasury-tests.json`.

The nine scenarios cover:

1. The 1,000-unit example: A=100, B=200, C=150, D=150, reserve=400. A spends 20 and reserves 10. The replacement has 70 available; owner recovery and the remaining commitment preserve B/C/D.
2. Cross-task spending isolation, per-operation caps and duplicate task rejection.
3. Restricted scheduler authority and owner revocation of scheduling access.
4. Task-scoped operation IDs and exact payer/asset/recipient/amount binding.
5. The exact expiry boundary, immutable retry metadata and old-attempt rejection.
6. Cancellation, outstanding obligations and eventual expiry/recovery.
7. Reallocating released funds to fresh tasks and handling unsolicited tokens.
8. Invalid policies, unknown tasks and malformed reservations.
9. Rollback when a token taxes deposits, settlement or withdrawals.

The canonical test independently expects 51 spent across tasks, 70 withdrawn and 879 remaining in the treasury after its complete sequence. These are deterministic fixture results, not product performance metrics.

## Live Hedera proof

Treasury: [0.0.11339459](https://hashscan.io/testnet/contract/0.0.11339459). This is a new contract; the completed Phase-0 vault and its evidence remain separate.

The live script deposited **0.10 Circle testnet USDC**, using token `0.0.429274`:

| Allocation | Test USDC |
|---|---:|
| A | 0.0100 |
| B | 0.0200 |
| C | 0.0150 |
| D | 0.0150 |
| Unallocated | 0.0400 |

A spent 0.002 and had another 0.001 pending. B independently spent 0.0005. The script replaced A's worker, verified A had only 0.007 available, cancelled A, released and withdrew that 0.007, then settled the existing 0.001 obligation. B/C/D's state was identical before and after A's handoff and recovery.

- [A's initial payment](https://hashscan.io/testnet/transaction/0.0.11338859@1793969752.929152565)
- [B's payment](https://hashscan.io/testnet/transaction/0.0.11338859@1793969757.403085200)
- [Owner recovery](https://hashscan.io/testnet/transaction/0.0.11338859@1793969853.710169769)
- [A's pending obligation settled after cancellation](https://hashscan.io/testnet/transaction/0.0.11338859@1793969855.706069804)

The Phase-0 merchant/facilitator endpoint was unreachable when the owner withdrawal was initiated (`merchantReachableAtWithdrawal: false`). The withdrawal was submitted directly from the owner's client. Chain access, owner keys, gas and token operability remain necessary.

Final live balances:

```text
Deposited:             0.1000 USDC
Spent:                 0.0035 USDC
Returned to owner:     0.0070 USDC
Still in treasury:     0.0895 USDC
  Unallocated:         0.0400 USDC
  Available in B/C/D:  0.0495 USDC
Pending reservations:  0
```

The **0.0895 test USDC remains in the treasury**: 0.0495 available in B/C/D and 0.0400 unallocated. A is cancelled, while B/C/D remain active.

`evidence/live-proof.json` contains the deployed runtime hash, transaction IDs, parent/child consensus transfers, logs, pre-handoff snapshots and final accounting. Three actual payment effects were checked, not inferred from receipt status alone. The script's completed-run guard was rerun successfully without submitting new transactions.

```sh
npm run phase1:live
```

On this completed instance, that command reports completion and exits. It does not deploy again, create fresh purchases or sweep existing task funds. Preserve the evidence before explicitly preparing another live proof. The script journals fixed transaction IDs before native calls and reconciles uncertain submissions. Confirmed steps are skipped. Mirror/RPC indexing lag is handled with bounded waits; a stale read is not permission to pay again.

The script may share faucet HBAR between the dedicated owner and worker accounts for gas, and waits for the refill to be indexed. It never uses production accounts. The first run hit indexing lag, then resumed the saved transaction sequence successfully; that history is retained in the evidence.

## Interface and integration boundary

The public executor selector remains `executeTransfer(address,address,address,uint256,bytes)`.

Phase-1 authorization bytes are **96 bytes**:

```text
abi.encode(bytes32 taskId, bytes32 operationId, uint64 attempt)
```

Phase 0 used a single 32-byte operation ID. Its old HTTP client and facilitator configuration must not simply be pointed at this contract. Phase 2 must supply the task/attempt envelope and task-specific merchant quotes. Phase 1's live proof called the executor through native contract transactions; it is not a second end-to-end HTTP x402 demonstration. The original Phase-0 HTTP demonstration remains valid for its own vault.

## Remaining work

- SDK/task-aware payment adapter and authenticated receipts.
- Durable merchant operation IDs, payment reconciliation and retained result retrieval.
- Actual worker failure detection, checkpoints and automatic A-to-B work resumption.
- Dashboard, browser recovery interface, encrypted checkpoints, identity/privacy features and public hosting.

The local tests use four distinct worker keys. To reuse existing funded accounts, the live financial proof uses the owner key as the replacement worker and for B/D. That is a test convenience, not the proposed production worker key arrangement. No LLM agents or concurrent workflow engine ran in this phase. Contracts are testnet prototypes and have not been audited.
