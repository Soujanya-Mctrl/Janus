# Phase 0: contract-controlled payment proof

This spike tests a single-task ERC20 vault on an **ephemeral local EVM**. It does not settle on Hedera, use actual USDC, or constitute an end-to-end x402 integration. No user keys, accounts or real funds are needed. The local EVM is in-process and shuts down after each scenario; the recorded transaction hashes cannot be looked up on a public explorer.

Update: the separate [Hedera integration](../../backend/hedera/README.md) has now completed a real public-testnet USDC payment and direct recovery through an HTS adapter. The local-only descriptions below apply to this original test harness, not to that separate integration.

## Run

From the repository root, using Node 22:

```sh
npm run setup
npm run phase0:compile --prefix contracts
npm run phase0:test --prefix contracts
```

The compiler uses bounded WebAssembly compilation settings for this machine. Ganache may warn that its native uWS binary is unavailable on Node 22; it uses its JavaScript fallback. This test runner uses the in-process provider, not an HTTP server. On this constrained workstation the compiler/test processes may require sufficient memory outside the restricted execution environment. Dependencies include development-only tooling; this is not a production deployment.

The lockfile marks Ganache's bundled macOS-only `fsevents` dependency optional, matching its parent chokidar package's `optionalDependencies`. Ganache's published bundled metadata omits that flag; preserving it prevents Windows clean installs from treating a macOS-only watcher as required. Keep this correction if regenerating the lockfile.

Optional read-only discovery of public testnet facilitator capabilities:

```sh
npm run phase0:probe --prefix contracts
```

An unreachable result is a network observation, not proof that a facilitator lacks support. The script records only matching testnet payment capabilities and never sends a transaction.

## What is implemented

- A fixed token, merchant and maximum lifetime deposit of 100 local units in the test fixture.
- Owner-only funding, worker replacement, cancellation and withdrawal.
- Worker-created, exact-amount reservations with a fixed request commitment and a maximum 300-second lifetime.
- The `executeTransfer(address,address,address,uint256,bytes)` interface (selector `0xea8f19fd`). Authorization encodes an already-approved on-chain operation ID. It is **not** a signature scheme or an x402 payment payload.
- Executor calls bind payer, token, merchant and amount; verify exact observed token balance changes; consume each reservation once.
- Worker epochs prevent stale new reservations. Previously approved obligations remain payable until expiry, including after replacement or cancellation.
- Permissionless expiry releases reserved funds once. Direct owner withdrawal releases only available funds.

Conservation checked against actual token balances in each scenario:

```text
deposited = available + reserved + spent + returned
vault token balance = available + reserved   (in this controlled fixture)
```

Unsolicited token transfers can make actual vault balance exceed accounted funds; this probe has no surplus sweep. No generic token allowance is granted by the vault to a worker or facilitator.

## Acceptance scenarios and evidence

`test/payment.test.mjs` exercises actual compiled contracts on the local EVM. Negative checks decode EVM revert bytes to confirm the expected contract error, rather than accepting a disconnected RPC as a rejection.

1. Fund 100; reserve/pay 20 via an unrelated submitter; observe merchant receipt of 20; owner directly withdraws 80.
2. Reject unauthorized reservation, worker replacement, cancellation and withdrawal.
3. Reject commitments exceeding available funds.
4. Reject changed payer, asset, recipient or amount without consuming the authorization.
5. Reject duplicate settlement and rebinding of a previously used operation ID.
6. Fence old workers, reject wrong epochs and honor preexisting reservations.
7. Preserve merchant commitments after cancellation; prevent withdrawal of their reserved funds.
8. Prevent settlement after expiry; release exactly once; allow recovery.
9. Reject zero or unbounded reservation lifetimes.

The runner writes `artifacts/local-payment-proof.json` with its actual status, executed scenario outcomes, payment/withdrawal gas and local transaction references. That report is overwritten by the next run; an interrupted run can remain `running`. It is a reproducible execution record, not an audit or a production performance benchmark.

Independent financial exit here means a direct owner contract call, without an orchestrator, merchant API, database, or facilitator. A standalone recovery UI and a backend-shutdown browser demonstration are later-phase work.

## Historical live route decision

The Hedera exact specification defines `transferExecutor` for contract-held funds. It requires executor admission, preflight simulation and verification of real consensus transfer outcomes, including child records. Merely exposing this function selector on a local ERC20 contract is insufficient.

The successful public capability probe found matching `exact` / `hedera:testnet` entries at all three documented endpoints, but none **explicitly advertised** `transferExecutor` or an admitted executor list. This does not establish that no private integration is possible; it means no compatible hosted route was verified.

At the time of this original spike, no funded Hedera account was configured. The historical decision was:

- **Local mechanism:** evaluate using the generated local test report.
- **Hosted contract-controlled Hedera x402:** not verified; not a release dependency for the next local phase.
- **Live sponsor eligibility:** not established.

The separate Hedera integration subsequently recorded a protected payment through the restricted self-run facilitator. See its README above for observed results and limits. The original probe remains a local financial test harness; current work follows `shared/PLAN.md`.

## Deliberate limits

One task, one token and one merchant only. No task hierarchy, reusable expired operation attempts, off-chain signed intents, durable purchase/result API, anonymous workers, encrypted checkpoints, public SDK, x402 HTTP merchant flow, multichain bridge or live deployment. Expired operation IDs stay used in this probe; the later task model needs explicitly numbered, reconciled retry attempts. Existing reservation IDs are bearer triggers for fixed preauthorized payments; any submitter may execute them, but cannot alter the payee/asset/amount.

## Primary sources

- [Hedera exact scheme and transfer-executor requirements](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_hedera.md)
- [Documented Hedera facilitators and capability discovery](https://docs.hedera.com/solutions/ai/x402/facilitators)
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.4.0)
