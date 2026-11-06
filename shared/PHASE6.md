# Phase 6: authoritative dashboard and independent recovery

The normal Overview/Tasks view now uses a real treasury panel. Illustrative accounting requires an explicit fixture toggle. The panel validates the pinned chain, ABI identity, runtime bytecode hash, immutable owner and token before reading. It reads balances/tasks at one observed block, checks deposited-fund conservation, and displays the block plus event-query coverage. It never substitutes fixture values on RPC failure. Values are USDC integer base units, not dollar estimates.

Use `npm run dev`, sign in, then choose Refresh chain state. Task discovery covers a bounded recent event window (1,000 blocks by default, at most 10,000) plus explicitly supplied task IDs. A missing task in that window does not establish that no task exists. The timeline displays the most recent 50 events within the queried range and links their transaction hashes to HashScan. Released-to-reserve and owner withdrawals are separate values.

Owner-approved cancellation, release of available funds and reserve-wide withdrawal, plus owner/scheduler reassignment, validate authority and chain before submission. The UI displays submitted hashes while pending, waits for successful receipts and refreshes chain state. Rejections and unknown outcomes remain errors requiring reconciliation; the UI never marks submission as success. Reassignment changes contract authority only, not remote research transport. The wallet must be the deployed owner/scheduler; Privy login alone grants no treasury authority. Reserved obligations survive cancellation/reassignment. Testnet writes retain the two-HBAR gas ceiling.

## Independent copy

Frontend dev/build generate `/recovery/index.html` and `/recovery/recovery.js`. The panel links both files for download. Save both together and serve them from localhost or an independent HTTPS host; they require no Janus backend, Privy, merchant or discovery service. The existing `npm run recovery:build --prefix contracts` also produces the standalone artifact without starting Next. RPC can be changed in the recovery page; each connection must still pass pinned deployment validation. HTTPS is required outside localhost, with no embedded URL credentials. The owner wallet, chain availability, gas, token behavior and operation records remain trust/availability assumptions.

## Verification

`npm run dashboard:test:browser --prefix contracts` bundles the actual React panel with test-only auth/network fixtures and executes compiled contracts through Chromium. It checks balances, consent, assignment epoch, rejected wallet approval, cancellation, release and withdrawal. It then shuts down the dashboard HTTP host and completes independent pending-expiry recovery directly through the shared recovery core. `npm run recovery:test:browser --prefix contracts` separately verifies the actual static browser recovery page, including wrong owner/network, rejected approvals, changed inputs, reservation expiry, exact amounts and idempotent repetition. CI runs both. Neither fixture uses user keys or live money.

Browser acceptance is local; manual live extension-wallet recovery and real Hedera treasury-control submissions are not claimed. The public current deployment manifest remains historical. This phase does not complete final submission/video gates or claim sponsor acceptance.

Saved acceptance summary: [phase6-dashboard.json](evidence/phase6-dashboard.json).
