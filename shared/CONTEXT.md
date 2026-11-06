# Janus product and current context

Janus is the current project name. RelayBudget is the original research/prototype name retained in source provenance and historical evidence.

## Product

Money belongs to a task; workers have temporary spending authority. A replacement worker must resume with the correct available budget, reuse paid results and leave pending obligations intact. Example: a 100-unit task with 20 spent and 10 reserved has 70 available. Epoch increments fence old workers from new commitments. Owner recovery must remain possible without the application backend.

## Implemented and verified

- Solidity Phase 0: bounded payment and owner recovery.
- Solidity Phase 1: isolated task caps, reservations, single settlement, expiry/retry attempts, worker epochs, cancellation, release to reserve and owner withdrawal.
- Restricted Hedera Phase-0 merchant/facilitator and offline settlement checks.
- Next.js frontend with Privy identity plumbing and illustrative accounting dashboard.
- Repository orchestration uses independent frontend/backend/contracts lockfiles, Node.js 22, a combined `check` command and CI. Root contains no application dependencies. Local test reports are isolated from committed historical evidence.
- Fresh consistency-phase verification on 6 November 2026, Node.js 22.23.4: `npm run check` passed repository checks, frontend lint/types, both contract compilers, 9 Phase-0 and 9 Phase-1 scenarios, 8 settlement checks plus 4 merchant HTTP scenarios, 5 authentication scenarios, and the production build. Production HTTP smoke checks passed `/`, `/login`, `/dashboard` (200) and unauthenticated `/api/session` (401). No live transactions were submitted. Saved proof JSON is not a substitute for rerunning checks.

Historical Hedera evidence is not a fresh chain verification. No live funds were moved during restructuring.

## Important boundaries

The frontend targets Sepolia; historical live proofs use Hedera testnet. They are not integrated. Phase-0 payment authorization is 32 bytes; Phase-1 requires 96 bytes encoding task ID, operation ID and uint64 attempt. Merchant result durability, task-aware SDK, real checkpointed agent resumption and independent browser recovery are unfinished. No audit, production readiness, transaction anonymity or validated demand is claimed.

Available, reserved, spent, released-to-reserve and withdrawn are distinct quantities. Cancellation does not refund settled purchases or invalidate existing reservations. Unknown payment outcomes require reconciliation before retrying.

Repository phase names describe implementation slices: Phase 1 is the multi-task financial core. In the original dossier, that work maps largely to Phase 2. The pure reference model, full contract-spec acceptance, durable merchant results and working agent handoff are still incomplete; no dossier phase should be declared complete solely from the folder name.

## Dependency maintenance

The 6 November 2026 frontend production dependency audit reported 28 advisories (17 high, 11 moderate), largely in the existing Privy/wallet integration tree. The suggested Privy replacement is a breaking version change/downgrade, so it was not applied automatically as part of repository cleanup. Passing local checks does not clear these advisories. Review supported Privy/wallet versions, transitive updates and authentication regressions as a dedicated dependency migration before a production release.
