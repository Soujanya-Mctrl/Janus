# Live Hedera testnet settlement

The budget-controlled payment route has executed end to end on Hedera testnet. The merchant/facilitator runs locally; the vault, USDC transfers and owner withdrawal are on the public testnet. No production deployment or audit is claimed.

## Observed result

- Vault: [0.0.11339236](https://hashscan.io/testnet/contract/0.0.11339236).
- Official Circle testnet USDC: `0.0.429274`, six decimals.
- Deposit: **0.10 test USDC**.
- Worker created a reservation, then an HTTP client completed a v2 `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` flow without human payment approval.
- Confirmed payment: **0.02 test USDC**, [transaction 0.0.11338859@1793968385.882027690](https://hashscan.io/testnet/transaction/0.0.11338859@1793968385.882027690).
- Consensus verification read **five child records**, HTS transfer lists, HBAR fees and contract logs. It established exactly 20,000 USDC base units debited from the vault and credited to the merchant, with only the facilitator paying the HBAR fee.
- Recorded settlement fee: **0.10915348 test HBAR** for this one execution. This is not a performance or cost benchmark.
- Direct owner withdrawal: **0.08 test USDC**, [transaction 0.0.11338859@1793968527.391117762](https://hashscan.io/testnet/transaction/0.0.11338859@1793968527.391117762).
- Final accounting: 20,000 spent + 80,000 returned = 100,000 deposited; zero reserved/available funds and zero vault token balance. The probe is cancelled.

The withdrawal used direct owner contract calls. The merchant was still reachable during that withdrawal; it was stopped afterward. **An offline-withdrawal demonstration was not completed in this run.** The recorded evidence preserves that distinction.

## Evidence

- `evidence/deployment.json`: deployment hash, addresses, compiler and recorded runtime code hash.
- `evidence/prepared.json`: public account identities and successful setup transactions.
- `evidence/funded.json`: allowance and deposit references.
- `evidence/client-intent.json`: operation ID, payment envelope and reservation reference.
- `evidence/live-settlement.json`: normalized consensus records, logs and exact net-transfer verification.
- `evidence/live-checks.json`: quote binding, consumed-authorization rejection, cached settlement and pre-withdrawal accounting.
- `evidence/recovery.json` and `evidence/final-state.json`: recovery reference and final accounting.
- `evidence/payment-journal.json`: durable submission IDs and reconciliation results. Do not delete it while a submission is ambiguous.

These contain public testnet evidence, not private keys. Generated keys are only in the git-ignored `backend/.env.hedera`. The current testnet keys and identities are deliberately separate from production wallets.

## Implementation

`HederaPaymentProbe` inherits the tested Phase-0 accounting and associates itself with HTS USDC using Hedera's system contract in its constructor. The owner grants an exact native HTS allowance to the vault; workers and facilitators receive no unrestricted token allowance.

The executor interface is `executeTransfer(address,address,address,uint256,bytes)`. Authorization references an on-chain worker-approved reservation. Our narrow facilitator admits only the recorded vault and pinned token/merchant/price; it verifies the deployed runtime hash, uses a fixed gas ceiling and submits a native `ContractExecuteTransaction`.

Preflight simulation uses mirror-node transient read-write execution, including HTS. A successful simulation never releases the resource. Post-consensus checks aggregate parent/child native transfers and inspect logs. Extra token/NFT movement, unexpected debit, incorrect payee credit or fee discrepancies fail settlement. Unit tests cover those rejection paths.

Submission intent is persisted with a fixed transaction ID before broadcast. A repeated settled request returns the original transaction. An unknown outcome is reconciled rather than submitted under a new payment ID. This is not a general durable merchant/result-retrieval implementation; lost HTTP responses still require consulting evidence and reconciliation.

The `/premium` handler calls the facilitator's validating/reconciling `settle` path directly. It must not first require a fresh `verify` simulation: that simulation rejects a consumed reservation and would prevent a retry from reaching the saved settlement. Explicit `/verify` remains available for fresh-payment preflight. Offline HTTP regression tests cover this distinction with a fixture facilitator; financial effects are covered separately by the settlement checks and historical live proof.

## Commands

For a fresh instance, with no prior deployment evidence:

```sh
npm ci
# Run these commands from backend/.
npm run hedera:init
# Request test HBAR for the printed public owner address.
npm run hedera:preflight
npm run hedera:prepare
# Request test USDC from Circle after token association.
npm run contracts:compile --prefix ..
npm run hedera:deploy
npm run hedera:fund
npm run hedera:serve
# In another terminal:
npm run hedera:buy
npm run hedera:verify-live
npm run hedera:recover
npm run hedera:final-check
```

`hedera:status` reads public balances. `hedera:fund-gas` can share 3 test HBAR from a newly faucet-funded worker to a low-balance owner, preserving worker gas reserve. Setup, account creation, associations and deployment need more test HBAR than a single payment; do not budget only for the quoted USDC amount. The initial 10 test HBAR required an additional worker faucet request in this run.

The completed probe is deliberately single-use: cancelled, lifetime deposit cap reached, and the stable purchase ID consumed. `buy` does not silently create a new paid operation, and `deploy` does not overwrite recorded deployment. Preserve/archive evidence and explicitly prepare a fresh run before another full live demonstration. The Phase-1 contract now supports reusable treasury task allocations, but this HTTP client still targets the separate Phase-0 probe.

## Tests

```sh
npm run phase0:test --prefix ../contracts
npm test
```

The original evidence records nine local contract scenarios, eight consensus-effect validator checks and five pre-recovery live checks. Current backend tests also cover the HTTP challenge, settlement retry and rejection routes. Local tests do not emulate HTS; the public testnet execution is the HTS integration evidence.

## Limits and submission status

- This is a restricted self-run facilitator on `127.0.0.1:4022`, not a verified integration with a public hosted facilitator or a publicly hosted merchant.
- The client implements the inspected v2 envelope and Hedera transfer-executor route directly; broad third-party x402 client interoperability has not been certified.
- A native SDK bytecode-file deployment failed with `INSUFFICIENT_TX_FEE`; deployment succeeded through Hedera JSON-RPC instead. A token-facade approval attempt failed with `INSUFFICIENT_GAS`; native HTS allowance approval succeeded. No failed attempt is represented as a completed deployment/payment.
- No marketplace, multi-task runner, encrypted checkpoints, anonymous transactions or multi-chain recovery exists yet.
- Owner recovery still requires the owner key, chain access, gas, and an operable token. Existing reservations remain binding until settlement/expiry.
- The frontend scaffold is separate from this payment proof. Explorer source verification, connected treasury UI, submission video and other sponsor requirements are not established by these records.

## Primary references

- [Hedera exact scheme / transferExecutor](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_hedera.md)
- [Hedera SDK](https://github.com/hiero-ledger/hiero-sdk-js)
- [Circle USDC on Hedera](https://www.circle.com/multi-chain-usdc/hedera)
- [Circle testnet faucet](https://faucet.circle.com/)
