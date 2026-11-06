# Parallel trading simulation

Trading is a simulated workload for Janus's original task-budget and worker-recovery architecture. A deterministic orchestrator controls three actual Node.js worker threads. Strategies and prices are synthetic; there is no LLM, model provider, 0G integration, exchange, wallet, network call or real trade. The simulation is separate from the Hedera treasury and establishes no sponsor qualification.

## Run

From the root: `npm run demo:trading` and `npm run test:trading`. Node.js 22 is sufficient. The demo creates an isolated temporary journal directory, prints its event timeline and final accounting, verifies outcomes and removes only that temporary run. The trading tests also run through the backend's normal test command.

If the system drive is full, point the process-local TEMP and TMP environment variables to a writable directory on the project drive before running; no global environment change is required.

## Flow

The orchestrator validates the plan before starting workers. A 100 USD paper budget allocates 30 USD to Alpha, Beta and Gamma, leaving 10 USD unallocated. Every worker reaches a ready barrier before any worker starts proposing trades. Distinct thread IDs establish concurrent strategy execution; this is not three sequential calls labelled as agents.

Each bot loops through its assigned synthetic strategy steps, submits a proposal and waits for the orchestrator's acknowledgement before continuing. The parent pins the market snapshots, checks worker identity/epoch and message order, and sends the proposal through the deterministic risk engine. Bot workers have no direct ledger or wallet access. Independent task journals permit parallel progress without shared-balance races. Initial allocations and failure-transfer routes are pinned in the owner-configured plan. Only explicitly authorized free-cash reallocations are supported; transfers never raise trade-count, order-size or cumulative-spend limits.

Alpha's worker is deliberately terminated after its first simulated fill is saved but before acknowledgement. Beta and Gamma continue and finish. The orchestrator reconciles the saved fill, moves 5 USD of Alpha's available cash to Beta under the pinned allocation rule, then assigns Alpha epoch 2 to a replacement thread. Alpha's existing open position stays with its task. It replays the original step ID, reads the existing fill and acknowledges it without another debit, then continues to the next step. This kills an actual worker thread; it does not kill the Node process, crash the orchestrator or simulate an exchange outage.

## Demonstrated outcomes

All cash values below are USD; asset units and prices are synthetic.

- Alpha buys two DEMOA at 10.05 and sells at 12.00. Including 0.2% trade fees on both sides, it realizes +3.811800 paper USD. After transferring 5 USD to Beta and paying a 0.500000 simulated operating bill, it retains 28.311800 cash. Its interrupted purchase exists exactly once.
- Beta buys two DEMOB at 10.05 and sells at 9.00, realizing -2.176200. Its 5 USD incoming transfer leaves 32.823800 cash. It cannot pay its own operating bill from original or transferred capital.
- Gamma's oversized DEMOC order is rejected and it holds, retaining 30.000000 with no fills. Its operating bill is paused for lack of profit.
- The pool realizes +1.635600 after trading fees, pays 0.500000 in simulated operating costs and ends with 101.135600 cash including the 10 USD reserve. Four fills exist with no open positions. These are scripted prices, not evidence of a profitable strategy.
- The separate base `simulationPlan` fixture retains a losing-pool scenario. Its positive Alpha task cannot pay operating bills when losses across the pool exceed gains.

## Risk and accounting

Risk checks enforce allowed assets, fresh/nonfuture quotes, adverse slippage, fee rates, fee-inclusive order limits, position acquisition-cost limits, cumulative buy outlay including fees, available cash and fill count. No shorts, leverage or borrowing are permitted. Sales do not replenish the cumulative buy allowance. Position limits measure acquisition cost rather than current market exposure.

Each task's initial cash is its allowance. Aggregate initial allocations cannot exceed the total budget. Tasks cannot borrow from peers; only the orchestrator can apply a configured transfer between task accounts. The unallocated reserve is derived from the plan rather than maintained as a competing ledger. The orchestrator verifies that total cash plus remaining position acquisition cost plus operating costs already paid equals initial budget plus realized trading PnL. Completed internal transfers cancel in aggregate.

Amounts and prices use integer micro-USD; quantities have six decimal places. Buy consideration and fees round upward; sell proceeds round downward. Sales remove average acquisition cost to calculate realized paper PnL. There is no live valuation, unrealized PnL, market impact, liquidity, stop-loss or actual gas model. No on-chain transactions occur, so offline gas is zero rather than evidence of gas savings on a network.

## Simulated self-funding and failure transfers

Operating bills are explicit `operatingCosts` entries, with a stable ID, paying task and amount. The orchestrator first checks net realized profit across the whole pool minus prior operating charges. The paying task must also have enough unspent realized profit, free cash and remaining `operatingCostCap`. Unrealized gains and incoming transfers are not earnings. Outgoing transfers consume a task's available profit first, preventing that profit being claimed again after new capital arrives. Invoices are idempotent and capped. No provider is paid in reality; this is a simulated expense ledger, not an API-credit top-up or a promise of sustained profits. Checks pause the bill, not automatically liquidate positions or replenish funds. Globally deferred invoices can be considered again; locally rejected invoice IDs retain their original outcome.

A worker takeover preserves the task's portfolio and changes worker authority; it needs no cash transfer. A separate owner-configured `failureTransfers` rule can move free cash to another task when a worker fails. Open positions remain on the source task. Pending trade outcomes must be reconciled before transfer. Recipient cash is immediately available in its account, but it is not permission for extra trades beyond the existing policy or plan; this demo does not add an extra recipient trading cycle.

`finance.mjs` journals intent before debiting the source, then credits the recipient with distinct idempotency keys and records completion. Recovery finishes outstanding transfers before workers start. An interruption after debit leaves cash in transit rather than duplicating it; an interruption after credit reuses both entries. A completed transfer whose matching portfolio entry is missing fails closed. This is a recoverable single-host workflow, not an atomic multi-account database transaction. The orchestrator quiesces affected tasks while transferring. Direct engine adjustment methods are trusted backend primitives, never exposed to worker messages.

Worker exceptions, unexpected exits and response timeouts get one replacement attempt after reconciliation. A second failure stops the run. Strategy validation, ledger corruption and financial/storage errors stop rather than automatically retrying financial actions. If failure happens during a journal write, worker recovery waits for that write to settle. Task authority epochs remain local to this simulation.

## Recovery and persistence

A stable operation ID binds every step to its proposal and quote. Fills, balances and operation status commit together in a checksummed snapshot before acknowledgement. Replaying an accepted or rejected operation reuses its original outcome. Changed inputs under an existing ID are rejected. Pending acknowledgement blocks new work only within that task. Risk decisions and accounting are replay-validated on load.

A saved simulation plan prevents changed allocations or prices from reinterpreting existing journals. Restarting the orchestrator with the identical plan reuses all prior results. Worker assignments/epochs and the display timeline are in memory; they are not an on-chain authority mechanism or a durable distributed scheduler. Worker availability failures get one replacement; unexpected strategy or storage errors stop the run. Already-completed task journals remain available for reconciliation.

Exclusive single-host locks fail closed. A killed process can leave an orchestrator or portfolio lock; confirm its owner stopped and inspect the journals before removing that lock. Snapshots use file fsync plus rename, without directory fsync or database transactions. Checksums detect accidental corruption, not malicious filesystem edits. This is not multi-host execution or a power-loss durability guarantee. Retain continuing-run journals in ignored `.paper-state/` directories. Portfolio schema is now version 2; version-1 journals fail closed and are not automatically migrated. Retain old records and use a fresh simulation directory rather than deleting continuing-run data. The worker-response timer does not time out in-flight filesystem commits.

## Verification and remaining gates

All 25 trading tests and the parallel demo pass on Windows with Node.js 22.21.1. Tests verify concurrent startup, unrelated-task completion during interruption, exact-once simulated fills, gain/loss and fee accounting, risk limits, journal identity, whole-orchestrator replay, exclusive ownership and fail-closed strategy errors. Added tests cover profit-only capped bills, pooled losses, prevented reuse of transferred profit, pending-position protection, recovery after either transfer leg, missing-entry refusal and genuine worker exceptions. Repository syntax/structure, protocol tests and sponsor bookkeeping checks are separate from financial or sponsor acceptance.

The earlier repository-wide check remains blocked by existing runner/merchant directory fsync failures on Windows and native/heap memory failures in broader backend/build runs. No frontend or contract code changed in this simulation phase, so those expensive checks were not repeated. Publication remains held pending those acceptance blockers. The connected simulation UI is now implemented; see [WORKBENCH.md](WORKBENCH.md). Integration with existing treasury/task interfaces remains follow-up work. Prior 0G adapter files and commands have been removed from this uncommitted prototype.
