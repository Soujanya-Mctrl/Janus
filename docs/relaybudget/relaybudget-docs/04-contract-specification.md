# TaskTreasury smart-contract specification

Draft for implementation and adversarial review. No deployed ABI or security audit is implied.

## 1. Contract layout

Start with one `TaskTreasury.sol` and one immutable supported token. Use internal libraries or structs rather than a chain of upgradeable proxies. A factory is optional after one treasury works. `MockToken.sol` exists only for local testing. Merchant request verification and x402 encoding live outside the custody contract; the contract enforces the actual payment boundary.

Suggested dependencies: OpenZeppelin SafeERC20, EIP712/ECDSA or SignatureChecker for the selected signer type, and the storage-based ReentrancyGuard. Verify compiler/library compatibility. Do not assume transient storage support on every target network. Accept no arbitrary `delegatecall`, generic execution, router allowance, or unrestricted merchant debit.

## 2. Data model

```text
Treasury:
  owner, scheduler, token (immutable or tightly fixed configuration)
  unallocated, accountedBalance, lifetimeDeposited, lifetimePaid, lifetimeWithdrawn
  pausedForNewCommitments

Task:
  policyHash, executor, epoch, leaseUntil
  cap, free, reserved, spent, returned
  status: Active | Suspended | Draining | Closed
  perOperationMax, maxReservationTTL, activeReservationCount

Reservation:
  taskId, opKey, attempt, requestHash, merchant, amount
  createdEpoch, settleUntil
  status: Reserved | Settled | Expired

Operation:
  fingerprint, attemptCounter, currentReservationId, permanentlySettled
```

MVP allocation is flat. Hierarchical child budgets are a later extension; do not introduce recursive cap accounting before the flat model passes invariants.

Amounts are integer token base units. Logical USDC examples assume six decimals; read the actual token metadata and pin it, rather than assuming every stablecoin has the same precision. Support only a non-rebasing, non-fee-on-transfer configuration. Measure received deposits and reject unexpected deltas. Issuer freezes and chain outages remain outside contract control.

## 3. Accounting invariants

For each task i:

```text
cap_i = free_i + reserved_i + spent_i + returned_i
```

For the treasury:

```text
accountedBalance = unallocated + SUM(free_i + reserved_i)
lifetimeDeposited = accountedBalance + lifetimePaid + lifetimeWithdrawn
actualTokenBalance >= accountedBalance
```

The inequality permits unsolicited direct transfers, which are not automatically counted as deposits. Maintain an explicit excess-token policy: after checking actual balance exceeds accounted balance, only the owner can sweep that excess. Such a sweep must not reduce accounted collateral and is recorded separately. Do not let direct transfers change task budgets.

Invariant implementation uses maintained aggregate counters so no production function loops over all tasks. Tests independently recompute the sums with ghost state; checking a counter against itself is not a meaningful invariant.

## 4. External operations and permissions

| Proposed function | Authority | Main effects |
|---|---|---|
| `deposit(amount)` | Owner in MVP | Exact received amount increases deposited, balance, unallocated |
| `createTask(id, cap, policy)` | Owner | Unallocated decreases; task free increases; IDs never reused |
| `assignTask(id, executor, leaseUntil)` | Owner or scheduler | Enforces status/policy bounds, increments epoch, changes executor |
| `reserve(intent, workerSignature, merchantQuote)` | Current worker or relayer with signature | Free decreases, reserved increases, records fixed obligation |
| `settle(reservationId)` | Permissionless within reservation terms | Reserved and balance decrease, spent/paid increase, fixed merchant receives tokens |
| `executeTransfer(from, asset, to, amount, authorization)` | Admitted x402 executor path | Validates reservation-bound arguments; calls the same internal settle logic |
| `expire(reservationId)` | Permissionless after deadline | Reserved becomes free or returned, depending on task status |
| `cancelTask(id)` | Owner | Epoch increments; no new reservations; free returns to unallocated; old reservations remain |
| `suspendTask(id)` | Owner | Epoch increments; stops new commitments while preserving budget and existing reservations |
| `closeTask(id)` | Owner or bounded completion role | Only after no reservations; returns free and prevents future work |
| `withdrawUnallocated(amount, destination)` | Owner | Decreases unallocated/balance and transfers to owner-chosen address |
| `setScheduler(address)` | Owner | Replaces operational role, never custody owner |
| `pauseNewCommitments()` | Owner | Blocks new commitments, not safe expiry or owner exit |
| `sweepExcess()` | Owner | Transfers only demonstrable balance above accounted collateral |

Owner cannot drain reserved commitments early. Scheduler cannot call owner exit or alter spending policy. Closing a task reflects workflow bookkeeping; it is not an onchain proof that an arbitrary report is correct.

Suspension is owner-controlled. Resuming a Suspended task requires an owner-authorized resume/assignment; the scheduler cannot override an owner suspension. Track an explicit owner suspension flag or separate resume method so an ordinary worker reassignment cannot accidentally undo it.

For the preferred Hedera integration, `executeTransfer` matches the current interface [D17]. `from` must identify this treasury, asset/recipient/amount must exactly match the reservation, and authorization consumption is single-use. Unsupported native-HBAR payments revert in the single-HTS-token MVP. Both public settlement entry points share one internal accounting routine; neither creates a new spending right. Reverts roll back consumption and accounting. Implement the HTS transfer mechanism proven in Phase 0, rather than assuming generic ERC20 transfer behavior.

## 5. Reservation authorization

Use a domain-separated signed intent binding: chain ID, verifying contract, schema version, task ID, current epoch, op key, attempt, request fingerprint, merchant, token, exact amount, and settlement deadline. Contract checks:

1. Contract is accepting new commitments; task is Active.
2. Recovered signer is current executor; epoch matches; assignment lease has not expired.
3. Merchant is owner-allowlisted and its signed quote matches all economic/request fields.
4. Amount is positive, at most per-operation cap, and at most task free balance.
5. Deadline is in the future, at most the configured TTL from chain time, and respects the quote deadline. Keep the maximum outstanding duration bounded.
6. Operation ID is unused or a new attempt after a chain-confirmed expiry; its fingerprint is immutable. A permanently settled operation can never reserve again.
7. Active reservation count remains bounded, e.g. sixteen per task as an initial design parameter; benchmark and tune it.
8. Apply checks and state changes before any token interaction; guard externally interacting functions against reentrancy.

An immutable fingerprint includes recipient, network, token, price, route, canonical request body hash, and semantic step identity. Do not canonicalize JSON with ambiguous numeric or field-order handling; define canonical encoding and version it. Public hashes do not hide guessable payloads; only randomized encrypted content belongs in public commitments.

## 6. State transitions

| Event | Task free | Task reserved | Task spent | Other |
|---|---:|---:|---:|---|
| Create task of C | +C | — | — | Unallocated -C |
| Reserve p | -p | +p | — | Fixed recipient/deadline, unique reservation |
| Settle p | — | -p | +p | Balance -p; lifetimePaid +p |
| Expire p on Active/Suspended | +p | -p | — | Record terminal expired attempt |
| Cancel task | -all free | unchanged | unchanged | Returned and unallocated +free; epoch++ |
| Expire p on Draining | — | -p | — | Returned and unallocated +p |
| Withdraw unallocated p | — | — | — | Unallocated and balance -p; withdrawn +p |

Deadline convention: `settle` requires `block.timestamp < settleUntil`; `expire` requires `block.timestamp >= settleUntil`. The boundary has no overlap. A settlement and expiry race is serialized by chain state. A transaction pending past the deadline is not a guarantee of payment; merchants must understand this bounded reservation contract.

After cancellation, status is Draining if reservations remain, otherwise Closed. Any terminal reservation transition may close a Draining task when its count becomes zero. No owner signature is needed to expire after the deadline, so loss of the application does not permanently trap stale commitments.

## 7. Handoff and stale executor behavior

`assignTask` increments epoch. A reserve transaction accepted before the assignment remains a valid merchant obligation until its own deadline. An old executor cannot create a new reservation after the assignment is accepted. Settlement of an already Reserved record does not require the current task epoch; otherwise replacement would retroactively revoke merchant authorization.

Therefore revocation means "no new commitments under the old authority," not "cancel every previously authorized payment." UI and pitch must preserve this distinction.

No worker gets an ERC20 allowance over the vault. Exposing a generic `approve` function would destroy the epoch boundary. Facilitator signatures alone cannot make a new obligation. Relayers can submit a correctly signed reserve, but every field is checked onchain.

## 8. Logical operations versus attempts

`opKey = hash(chainId, treasury, taskId, stableStepId, operationSchemaVersion)`.

Same logical purchase survives handoff. Each reservation attempt gets a unique reservation ID including its attempt counter and fingerprint. A payment that expires unspent may be attempted again only after its onchain state is reconciled. Stale attempt settlement fails. A settled operation remains permanently settled in the contract even after merchant cache retention ends.

If a settled provider loses the result, a new purchase requires an explicitly new logical operation with an owner-approved retry reason. Record the previous cost; never rewrite it as an unused reservation. Contract cap still applies.

## 9. Safety argument, not a formal proof

Reserve moves value from free to reserved; expiry moves it back or to returned; settlement replaces reserved with spent and decreases collateral by the same amount; allocation moves unallocated to task free; cancellation returns only free; withdrawal removes only unallocated. If every function obeys these transitions and external token behavior matches assumptions, conservation follows by induction over accepted transactions.

Monotonic epochs prevent old reserve signatures from authorizing new commitments. Unique settled operation state prevents a second settlement for the same logical purchase in this contract. This does not prove merchant delivery, real-world task quality, absence of defects, or cross-chain/global exactly-once semantics. Validate with independent model, property tests, mutation tests, and review.

## 10. Recovery and bounded lockup

Owner calls cancel directly, then withdraws newly unallocated funds. Existing reservations remain collectible until their deadlines. After those deadlines, anyone can expire them and owner can withdraw the released balance. Recovery bound is maximum remaining reservation TTL plus chain inclusion/finality and any network outage; it is not an unconditional wall-clock guarantee.

No backend, registry, proof server, or treasury co-signer participates in this public-accounting MVP exit. Full private-balance recovery is explicitly outside this design. Owner key loss, token issuer freezing, and a halted chain cannot be fixed by this exit path.

## 11. Required adversarial cases

Replay across task/treasury/chain/epoch; mutated quote; duplicate settle; concurrent reserve at cap; reserve versus assignment order; settle versus cancel; settle versus expire boundary; replay after expired attempt; malicious token callback; wrong decimal conversion; dust recovery; invalid merchant; scheduler compromise; paused contract exit; unsolicited token transfer; excessive reservations; read projection inconsistency; reorged reserve; and direct recovery with every service stopped.
