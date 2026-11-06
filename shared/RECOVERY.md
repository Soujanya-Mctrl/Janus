# Direct owner recovery

The backend treasury client in `backend/lib/treasury.mjs` depends only on an RPC client and an owner wallet client. It does not call the merchant, facilitator, Privy session endpoint or orchestrator. Use the shared ABI in `shared/protocol/task-treasury-abi.json` and the selected chain in `shared/protocol/network.json`.

## Safe sequence

1. Verify chain ID, selected contract address, deployed bytecode, token and owner against the deployment you intend to recover. The client checks network, deployment existence and owner identity; it cannot establish that an arbitrary supplied address is a trusted deployment. Match code/provenance yourself before funding or recovery.
2. Read the task and outstanding reservations using the ABI. All amounts are integer token base units; USDC has six decimals.
3. Owner sends `cancelTask(taskId)` and waits for a successful receipt.
4. Re-read available funds. Owner sends `releaseAvailable(taskId, amount)` and waits. This returns funds to the treasury reserve, not the wallet.
5. Owner sends `withdrawUnallocated(amount)` and waits. This is the actual owner transfer. Never include reserved funds.
6. Previously reserved obligations can still settle before their deadline. After the deadline, call `expire(taskId, operationId, attempt)` and repeat release/withdraw for newly available funds.

`treasuryClient({ publicClient, walletClient, address })` selects Hedera testnet by default. Its `cancel`, `release`, `withdraw`, `task` and `read` methods expose the separate actions. `recoverAvailable(taskId)` runs steps 3–5 for current available funds; it does not sweep unrelated reserve balances. All successful actions have confirmed receipts. If a multi-action recovery is interrupted, inspect the chain and use the individual methods for the remaining actions; do not blindly restart a withdrawal.

## Local reproducible evidence

Run `npm run interface:test --prefix contracts`. This deploys actual contracts in-process, reserves 10 of 100 units, rejects an unauthorized wallet and wrong network, cancels the task, recovers 90, settles the outstanding 10 and verifies the resulting ledger. No app or merchant process is started. No live network credentials or payments are used.

Historical Hedera evidence remains at `contracts/phase1/evidence/live-proof.json`. It is not a fresh verification or a default active deployment. A static browser recovery interface is a later delivery item.
