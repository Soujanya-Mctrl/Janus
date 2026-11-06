# Janus product and current context

Janus is the current project name. RelayBudget is the original research/prototype name retained in source provenance and historical evidence.

## Product

Money belongs to a task; workers have temporary spending authority. A replacement worker must resume with the correct available budget, reuse paid results and leave pending obligations intact. Example: a 100-unit task with 20 spent and 10 reserved has 70 available. Epoch increments fence old workers from new commitments. Owner recovery must remain possible without the application backend.

## Implemented and verified

- Solidity Phase 0: bounded payment and owner recovery.
- Solidity Phase 1: isolated task caps, reservations, single settlement, expiry/retry attempts, worker epochs, cancellation, release to reserve and owner withdrawal.
- Restricted Hedera Phase-0 merchant/facilitator and offline settlement checks.
- Next.js frontend with Privy identity plumbing and illustrative accounting dashboard.
- Following module relocation: frontend build/lint and HTTP smoke checks passed; 9 Phase-0 scenarios, 9 Phase-1 scenarios and 8 backend checks passed locally.

Historical Hedera evidence is not a fresh chain verification. No live funds were moved during restructuring.

## Important boundaries

Frontend and backend now share Hedera testnet configuration (chain 296). The illustrative dashboard is still not connected to treasury state. Phase-0 payment authorization is 32 bytes; Phase-1 requires 96 bytes encoding task ID, operation ID and uint64 attempt. Merchant result durability, task-aware SDK, real checkpointed agent resumption and independent browser recovery are unfinished. No audit, production readiness, transaction anonymity or validated demand is claimed.

Available, reserved, spent, released-to-reserve and withdrawn are distinct quantities. Cancellation does not refund settled purchases or invalidate existing reservations. Unknown payment outcomes require reconciliation before retrying.

Phase 1 integration adds generated treasury ABI/version metadata and a direct RPC owner client. The new recovery integration test passes without application services and preserves pending settlement. Interface freshness, frontend build and lint passed.
