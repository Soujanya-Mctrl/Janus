# Treasury integration contract, version 1

Status: the integration-readiness boundary for the existing flat treasury. This is a deliberately smaller implementation than the original dossier, not completion of its entire contract specification.

## Network and identity

`network.json` selects Hedera testnet (EVM chain 296), the existing HTS USDC token `0.0.429274` and six token decimals. JSON-RPC HBAR balances use eighteen EVM decimals; these are distinct from USDC base units. Frontend and backend consume this file. Frontend funding stays disabled until the paid workflow and receipt-confirmed actions are integrated. Privy identity is separate from owner/worker authority; configured-wallet login on this network still needs an account-level browser rehearsal.

`treasury-interface.json` exports the compiled base contract ABI, ordered task fields, interface version and SHA-256 of compact `JSON.stringify(abi)`. Run `npm run interface:export --prefix contracts` after compiling and reviewing an intentional interface change. The normal compile/check commands verify the committed export and fail on drift. ABI changes require a version review; this is not an upgradeable contract.

`deployments/hedera-testnet.json` is a historical deployment reference derived from preserved proof, not a fresh chain observation or an active frontend deployment. Its owner matches the replacement worker in the recorded final task A state. The recovery client checks the actual chain, runtime code hash, owner and token before any action. Local tests construct separate manifests for their ephemeral chain; no fixture identity is reused on testnet.

## Wire and operation rules

All accounting amounts, epochs and attempts in API/export records are canonical unsigned decimal strings. No float conversion is permitted. Available, reserved, spent, returned-to-reserve and treasury-wide withdrawn remain separate. `taskSnapshot` maps the contract's ordered tuple into this wire representation.

`protocol.mjs` defines canonical JSON version 1: sorted object keys, ordered dense arrays, strings, booleans and null. Numbers, undefined values and non-plain objects are rejected; callers express numeric values as strings. This custom format is not claimed to implement RFC 8785. Consumers must reject ambiguous input before canonicalization; do not hash raw JSON with duplicate keys as an accepted canonical request.

Logical operation ID is SHA-256 of the canonical object containing domain `janus-task-treasury/1`, decimal chain ID, lowercase treasury address, task ID and stable semantic step ID. Worker, epoch and attempt are excluded. Retries must keep the same purchase identity and request fingerprint. A new worker is not a new purchase. Hashes do not provide payload confidentiality.

Authorization is exactly `abi.encode(bytes32 taskId, bytes32 operationId, uint64 attempt)`: 96 bytes, never the old 32-byte Phase-0 payload. `encodeAuthorization`/`decodeAuthorization` reject zero identities, malformed lengths and attempt overflow. The bytes reference an already approved obligation; they are not a worker signature or authorization to create a new one. A future adapter must bind provider, route, canonical body, chain/token, merchant and price to the request hash and validate quote deadlines separately.

## Explicit scope decisions

| Dossier proposal | Supported version 1 decision |
| --- | --- |
| Signed reserve intents and signed merchant quotes | Current worker submits an onchain reservation; fixed task merchant and per-operation limit enforce the current financial boundary. Relayed intents/quote signature validation remain future work. |
| Assignment leases | Explicit owner/scheduler reassignment increments epoch; no automatic lease expiry. |
| Suspended/draining/closed storage states | Cancellation is terminal. UI may derive draining from cancelled plus reserved > 0; fresh work uses a new task ID. No scheduler override of cancellation. |
| Cancellation automatically returns free funds | Three distinct calls: cancel, release available to reserve, withdraw reserve. Expiry restores task available even after cancellation; release is still required. |
| Configurable TTL/count bounds | TTL is capped at 300 seconds. No reservation-count limit; production functions contain no task/operation enumeration loop. Offchain tooling must page logs and manage per-operation gas costs. |
| Global pause | Deferred; owner can cancel individual tasks. Recovery never needs a paused-service permission. |
| Sweep unsolicited excess tokens | Deferred. Excess does not increase the spendable ledger and cannot be recovered through ordinary withdrawal. Do not deliberately send tokens outside `deposit`. |
| Change withdrawal destination | Fixed immutable owner receives funds. Owner key rotation requires an explicitly designed migration. |

These choices preserve the existing tested contract and historical deployment. No contract was redeployed during readiness work. They are limitations to review before production, rather than claims that the omitted features shipped.

## Model and evidence

`accounting-model.mjs` reconstructs balances from an accepted event history. It derives reserved/spent from operation states and available from cap minus obligations/spending/returns, independently of Solidity's cached aggregate counters. Unknown offchain payment outcomes are not terminal model events: leave the onchain reservation unresolved until confirmed settlement or expiry.

Pure tests cover malformed transitions and 100 fixed-seed histories. The treasury suite additionally compares three deterministic seeded action traces against actual local-EVM state after each action, including assignment, settlement, expiry, release, withdrawal, cancellation and unsolicited tokens. This is bounded differential testing, not a formal proof or a complete fuzz/security audit.

Independent recovery usage and boundaries are in [RECOVERY.md](RECOVERY.md). Durable merchant artifacts, reconciliation across worker crashes, and checkpointed work resumption are the next phase.
