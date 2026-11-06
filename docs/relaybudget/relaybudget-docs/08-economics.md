# Economics and token policy

## 1. No project token in the MVP

RelayBudget does not need a transferable token to assign tasks, enforce budgets, or recover funds. A new token would add pricing risk, liquidity requirements, distribution complexity, and incentives unrelated to the user's job. The proposed system uses an existing supported stablecoin/test equivalent for principal and the network's required gas asset for transaction fees.

There is no promised yield, token appreciation, staking APR, token sale, inflation, or revenue-sharing claim. A future token requires a separately justified coordination mechanism; current product functions do not establish one.

## 2. Financial flows

1. Owner deposits supported tokens into their treasury contract.
2. Contract allocates already collateralized task budgets.
3. Agent reserves a bounded amount for an approved purchase.
4. Merchant settlement transfers principal to that merchant.
5. Cancellation returns uncommitted task budget to owner-controlled unallocated balance.
6. Owner withdraws unallocated principal. Reserved funds wait for settlement or expiry.

Task caps and reservation records are accounting state, not tradable credits. If displayed as dollars, label the unit and conversion assumptions. Stablecoins can deviate from parity; contracts account in token units, not an oracle-derived promise of dollar value.

## 3. Who pays which costs?

| Cost | Proposed payer | Accounting treatment |
|---|---|---|
| Paid dataset/API | Customer task budget | Settled task expenditure |
| Onchain settlement gas | Configured facilitator/operator | Separately metered overhead; not secretly taken from task allocation |
| Owner emergency exit gas | Owner, unless an independent sponsor is available | Disclose in recovery UI |
| Hosted monitoring/DB | RelayBudget service | Subscription cost of service |
| Model inference | Customer or explicitly metered provider arrangement | State whether inside or outside task budget |
| Merchant refund | Merchant if supported | A distinct transfer/receipt, not reversal of historical spend |

The $100-task/$20-spent example excludes gas unless explicitly configured otherwise. A customer-facing "all-in cap" needs reserved fee allowance or a second bounded gas budget; do not advertise one if only tool principal is capped.

## 4. Revenue hypothesis

Open-source SDK and contract specification; optional paid hosted monitoring, task reconciliation, team access, alerts, and integrations. Owner exit and local SDK use remain available without paying for hosting.

Test subscription pricing before charging a percentage of every purchase. A percentage fee can punish high-value tasks without reflecting service cost; per-task or per-workspace pricing may be easier to evaluate. No price below is validated market pricing.

Illustrative monthly scenario, not a forecast:

| Item | Assumption |
|---|---:|
| Hosted subscription revenue | $99 |
| Application and database hosting | $15 |
| Logs/storage/monitoring | $10 |
| 2,000 paid operations x $0.002 assumed operator fee cost | $4 |
| Illustrative direct cost | $29 |
| Illustrative contribution before support/security/acquisition | $70, or 70.7% |

The $0.002 figure is a scenario input, not a measured Hedera fee or a quote. Replace it with receipts and actual service bills. Customer tool payments are pass-through principal and are excluded from subscription revenue. Add support, payment disputes, security work, and customer acquisition before claiming profitability.

## 5. Incentives and failure handling

No slashing for a rate limit, network partition, or process crash. These are not reliable evidence of misconduct. Worker availability and capability claims should be authenticated and tested; reputation can be added after meaningful outcome evidence exists.

A merchant is paid according to a bounded reservation. The protocol does not insure data quality. Adding a delivery dispute mechanism changes the trust and economic model and is outside the initial build.

Operator cannot seize owner principal. Scheduler power is bounded by owner-configured tasks and policies, though a colluding approved merchant/worker can still waste the permitted amount. Require human approval for expanding authority.

## 6. Reservation cost and recovery trade-off

Long TTL increases the chance a delayed merchant gets paid, but locks budget longer after a crash. Short TTL frees funds sooner but can make merchants unwilling to deliver before settlement. Settle before serving in the initial reference merchant and measure the latency cost; do not simultaneously promise no settlement wait without a separate collateral design.

An optional opportunity-cost estimate is `reserved_amount × annual_capital_rate × locked_seconds / seconds_per_year`. This is a planning model, not yield paid by the protocol. Report actual collateral wait separately from this assumed economic cost.

## 7. Business validation metrics

Track integration effort, recurring paid tasks, incident investigation time, accidental duplicate charges, task completion, and subscription conversion. A high volume of testnet transactions is not revenue or demand.

The strongest early commercial signal is a customer who supplies real redacted failure traces, integrates the SDK in a sandbox, and agrees to a pilot success criterion. Until then, describe pricing, margin, adoption, and market extension as hypotheses.
