# Independent owner recovery

The client in `contracts/phase1/lib/recovery.mjs` and CLI in `contracts/phase1/scripts/recover.mjs` use only the owner's wallet, chain RPC, exported ABI and deployment manifest. They do not import the backend, Privy, database, merchant, facilitator or discovery service. A standalone static browser client now shares the same recovery core. Build it with `npm run recovery:build --prefix contracts`, then serve `contracts/phase1/artifacts/recovery-browser/` using a static HTTP server (localhost) or a trusted HTTPS host. No CDN or Janus application service is required. The browser uses an injected EVM wallet and the pinned testnet manifest; no private key is entered into the page. Inspect the plan and acknowledge the reserve-wide withdrawal before requesting wallet approval. Automated Chromium wallet acceptance now passes on a local EVM. Manual extension-wallet/live-network recovery remains unverified.

Install contract dependencies with `npm ci` from `contracts/` (or root `npm run setup`). Keep the `contracts/` and `shared/` directories together. The committed ABI/manifest are sufficient to run recovery without compiling or starting application services.

From `contracts/`, inspect a read-only plan:

```sh
npm run recovery:plan -- ../shared/deployments/hedera-testnet.json TASK_ID OPERATION_ID
```

Replace IDs with full nonzero bytes32 values from your records. Additional operation IDs may follow. Configure `JANUS_RECOVERY_RPC_URL` to use a different chain RPC. The manifest is labelled historical: every invocation verifies the current chain, deployed runtime hash, immutable token and owner before returning a plan. This phase did not run the CLI against live funds.

Execution requires an explicit `--execute` flag and an owner key supplied through `JANUS_RECOVERY_PRIVATE_KEY` by your local secret manager/environment. Do not put the key in command-line arguments, source files or recovery exports. The CLI does not load backend credentials. Use only the dedicated testnet owner; the CLI rejects other networks.

```sh
npm run recovery:plan -- ../shared/deployments/hedera-testnet.json TASK_ID OPERATION_ID --execute
```

Execution cancels the selected task, expires only listed reservations whose chain deadlines have elapsed, releases that task's available balance, then withdraws the **entire unallocated treasury reserve** to the owner. The plan explicitly displays this reserve-wide effect. It does not cancel or take available balances from other tasks. Existing valid merchant obligations remain reserved/payable; settled purchases are not refunded.

Provide pending operation IDs from your exported records or indexed `Reserved` logs. The contract does not enumerate operations. An omitted operation stays reserved, rather than being silently treated as available. After its deadline, supply its ID on a later run. Issuer freezes, unavailable chain/RPC, missing owner key/gas and unavailable operation records can delay recovery; there is no unconditional wall-clock guarantee.

Each transaction waits for a successful receipt before the next step. A failed/unknown submission stops execution. Reconcile any returned transaction hash before restarting after an ambiguous RPC failure. Re-running reads current state: it skips confirmed cancellation/expiry/release and can withdraw funds already released before a process crash. Reserve withdrawal is owner-only and bounded by current unallocated funds; repeat execution cannot withdraw reserved obligations.

The local treasury suite verifies identity mismatches, wrong-owner refusal, cancellation with a pending obligation, later expiry and exact withdrawal, preservation of unrelated tasks, restart after release-before-withdraw, and a completed repeat with no transactions. Those tests use an ephemeral EVM with no application services. Historical Hedera withdrawal evidence remains separate from this new local proof.

## Reproduce browser-wallet acceptance

After root setup and contract compilation, install the test browser once from `contracts/` with `npx playwright install chromium`, then run `npm run recovery:test:browser`. CI installs Chromium and runs this acceptance test after the normal checks. `JANUS_CHROMIUM_PATH` may point to an existing compatible Chromium executable.

The test bundles the actual browser entry point with local-only deployment/network fixtures, then uses an injected EIP-1193 wallet adapter in headless Chromium. All transactions execute real compiled contracts on an ephemeral local chain. It verifies missing consent, incorrect owner/chain, rejected connection and transaction approvals, changed inputs and wallet events, exact reserve-wide withdrawal, preservation/expiry of a pending obligation and a completed repeat with no more transactions. It does not import a user's browser profile, use their keys, or submit live transactions. The production bundle remains pinned to Hedera testnet; local fixtures are supplied only by the test bundler.

The dashboard now links a generated static copy at `/recovery/index.html` and downloads for both required files (`index.html`, `recovery.js`). Save them together for independent hosting. The optional RPC field supports another HTTPS provider or local HTTP and always revalidates the pinned chain/deployment. See [PHASE6.md](PHASE6.md).
