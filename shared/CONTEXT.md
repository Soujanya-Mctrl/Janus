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

Frontend and backend share Hedera testnet configuration. The dashboard remains illustrative and is not connected to a treasury. Phase-0 payment authorization is 32 bytes; Phase-1 requires 96 bytes encoding task ID, operation ID and uint64 attempt. Merchant result durability, task-aware SDK, real checkpointed agent resumption and independent browser recovery are unfinished. An independently usable Node.js recovery client now exists and is verified locally against deployment identity and current contract state. No audit, production readiness, transaction anonymity or validated demand is claimed.

Available, reserved, spent, released-to-reserve and withdrawn are distinct quantities. Cancellation does not refund settled purchases or invalidate existing reservations. Unknown payment outcomes require reconciliation before retrying.

Repository phase names describe implementation slices: Phase 1 is the multi-task financial core. In the original dossier, that work maps largely to Phase 2. The independent reference model and bounded differential traces are implemented. Full dossier contract-spec acceptance, durable merchant results and working agent handoff remain incomplete; no dossier phase should be declared complete solely from the folder name.

## Paid merchant phase completed locally

Task-aware SDK, pinned treasury adapter, merchant-signed quotes, current-worker/owner request authentication, fsynced operation/result storage and HTTP retrieval are implemented. Local EVM/HTTP regressions verify a paid-response failure, restart, replacement result access, no duplicate debit, missing-result owner decision and an independent task purchase. This is a custom signed HTTP reference adapter, not a general x402 interoperability certification or a fresh live Hedera proof. See `PAID_WORKFLOW.md` for durability assumptions and limits. Checkpointed workflow execution is the next phase.

## Dependency maintenance

The 6 November 2026 frontend production dependency audit reported 28 advisories (17 high, 11 moderate), largely in the existing Privy/wallet integration tree. The suggested Privy replacement is a breaking version change/downgrade, so it was not applied automatically as part of repository cleanup. Passing local checks does not clear these advisories. Review supported Privy/wallet versions, transitive updates and authentication regressions as a dedicated dependency migration before a production release.

## Treasury integration readiness

Hedera testnet is the selected single settlement network. Shared network configuration, versioned ABI/hash, canonical string-based operation identity and 96-byte authorization now define the integration boundary. The supported narrower contract scope is explicit in `TREASURY_INTERFACE.md`; the existing deployed contract was not modified or redeployed. The independent accounting model derives balances from accepted operation histories. `RECOVERY.md` documents direct owner recovery through contracts/shared only, including pending expiry, reserve-wide withdrawal and restart semantics. New evidence is local; the committed testnet manifest remains historical. Wallet-stack advisory migration stays a production follow-up.

Readiness verification on 6 November 2026, Node.js 22.23.4: repository/ABI drift checks, lint, types and compilation passed; 21 contract scenarios, 13 backend checks, 5 protocol/model checks (including 100 fixed-seed histories) and 5 authentication checks passed. Contract/model differential traces used seeds 7, 19 and 41. The production build and HTTP smoke checks passed after disabling Turbopack disk persistence for this external volume's cache reload failure. New direct recovery proof is local, with no application services or live transactions.

## Checkpointed handoff reference implemented locally

The merchant phase is published at `2416da9`. The next-phase core adds durable per-task checkpoints, validated graph/artifact identity, deterministic eligibility and an assignment outbox. The SDK independently verifies contract state and the receipt's Paid event; the merchant serializes same-account submissions across concurrent tasks. A real local-EVM/HTTP four-task regression and `npm run demo:handoff` verify post-payment interruption, continued B/C/D progress, acknowledgement-loss reconciliation, old-worker rejection and original-result reuse before the remaining step. Exactly five unique purchases spend/credit 100 local base units. No live funds or model calls are involved. See `RUNNER.md`; four OS processes, task API/Postgres orchestration, encrypted checkpoints and a genuine model execution remain unfinished.

## Environment integration and live merchant hardening

The restored backend environment passes read-only preflight: owner matches the pinned treasury and all three dedicated accounts have nonzero test HBAR. The supplied frontend verification-key value was invalid; the app public ES256 key was retrieved from Privy's public JWKS endpoint and installed only in ignored `.env.local`. Authentication regressions and the production build pass; invalid tokens return 401 with the real environment and the app secret is absent from browser JavaScript. Environment files remain ignored with mode 0600.

Merchant safeguards now cover confirmation depth, cached receipt reconciliation, bounded log scans, testnet transaction fee ceilings, HTTPS outside loopback and signer-process exclusion. Nineteen backend tests pass. The authorized live check now passes: exactly 20,000 test-USDC base units were debited from the treasury and credited to the merchant; replay reused the same payment transaction and result hash. Allocation reconciliation now pins latest/pending nonce and persists signed bytes/hash before broadcast. The completed-run guard was rerun successfully without new transactions. Public evidence is in `backend/hedera/evidence/task-aware-live-proof.json`. Native consensus child-record verification and production qualification remain separate. See `MERCHANT_LIVE_SETUP.md`. Concurrent browser recovery work remains separate.
