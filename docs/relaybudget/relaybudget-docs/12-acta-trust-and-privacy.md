# ACTA, enforceable trust boundaries, and agent privacy

Prepared 6 November 2026. Proposed architecture extension; no implementation, deployment, audit or benchmark is represented as complete. This document refines the earlier public-accounting MVP, rather than retroactively claiming anonymity for it.

## Decision

Build authenticated task receipts, enforceable financial authority, encrypted recoverable checkpoints, and private browser RPC reads first. Prototype anonymous eligibility separately. Keep one live payment chain until these properties work. Do not claim anonymous payments, guaranteed output quality, or fully trustless agents.

The business hypothesis is a platform buying services from independent agent operators that needs private task contents, inspectable payment authority, and recovery without depending on RelayBudget. Demand remains unvalidated. These security features do not establish demand by themselves.

## 1. ACTA source inspection

The user confirmed ACTA rather than ECTA. The working reference is PrinceAikinsBaidoo/ACTA-Protocol, which calls itself Agent Cryptographic Trust Architecture. Confirmation did not include a URL; another ACTA project would require a different assessment.

Inspected commit: `9f649a8c5745953a4c3e6b9f2ff3a4841f7ae95a`. The following files were fetched at that commit and compared with the inspected default-branch contents; all matched. This is static inspection, not an exploit demonstration or runtime audit.

| Source | Observation | Implication for RelayBudget |
|---|---|---|
| `contracts/src/AgentRegistry.sol` | Custom bytes32 agent IDs, owner/name/model mappings and `registerAgent`; no ERC-721 inheritance or ERC-8004 registration interface in this file | README's compliance claim is insufficient evidence of current ERC-8004 conformance |
| `contracts/src/ReceiptRegistry.sol` | `issueReceipt` accepts caller-supplied agent ID, job, parent, hashes and pass flag, without checking agent ownership or an agent signature | On-chain existence proves a record was submitted, not that the named agent authored it |
| `contracts/src/ReceiptRegistry.sol` | Public job/agent links, action type, timestamp and content hashes; encrypted CID field exists | Public provenance is linkable; a hash is not encryption or anonymity |
| `contracts/src/ReputationEngine.sol` | `initializeAgent` and `recordOutcome` accept the immutable owner or configured receipt registry | Outcome authority remains trusted; no objective task correctness follows from the score |
| README | Lit privacy integration explicitly marked roadmap | Do not inherit an implemented privacy claim |

The receipt source also accepts parent IDs without validating existence or same-job membership. Our adapter must validate provenance, not assume every parent-linked record forms an authenticated causal history. Do not use its pass flag or score as an automatic payment authorization.

Reuse the idea of structured parent-linked evidence. Keep ACTA export optional and asynchronous: an unavailable registry cannot block settlement or owner recovery. If actual ACTA export is built, classify it as an auxiliary record; verify authorship against our signed envelope. Never publish private task details through the export.

## 2. Trust model and guarantees

| Adversary or dependency | Enforcement proposed | Residual assumption |
|---|---|---|
| Compromised worker | No root key; operation limits, merchant allowlist, exact reservation fields, current executor epoch | Worker may waste allowed spend on an approved service |
| Malicious scheduler | Cannot increase caps, withdraw principal, change merchants or grant arbitrary allowances | May choose poor workers, censor scheduling or leak any plaintext it sees |
| Dead backend | Independent static owner client for freeze, expiry and withdrawal | Owner retains key, chain access and gas; token remains transferable |
| Merchant withholds output | Durable operation ID and result retrieval; explicit receipt of delivery | Prepaid funds are not automatically refunded; escrow is a separate merchant agreement |
| False completion claim | Objective verifier for a narrowly specified subtask | Verifier implements the actual agreed predicate; passing it does not establish broad usefulness |
| False reputation | Check evaluator identity, evidence and task uniqueness; no repeated scoring of same outcome | Evaluators can be wrong/collude; new identities permit reputation reset without a separate anti-Sybil mechanism |
| RPC censorship or lies | Replaceable providers; private transport; independent verification where implemented | Anonymizing transport does not authenticate chain state |

A lease timeout is a reason to change future authority, not evidence of fraud. Do not slash a worker because of rate limiting or temporary unavailability. Preserve preauthorized payment obligations when changing executor epochs.

Use the existing accounting rules: `cap = free + reserved + spent + returned`. Enforce exact recipient/asset/amount, bounded reservation deadlines, non-replayable operation settlement and owner recovery in the vault. A receipt registry is evidence storage, not the financial source of truth.

## 3. Authenticated receipts

Proposed receipt envelope fields:

```text
schemaVersion, chainId, vaultAddress, taskId, operationId,
attemptId, executorEpoch, actionType, parentReceiptCommitment,
inputCommitment, outputCommitment, policyHash,
reservationId, settlementTxReference, issuerSessionKey, expiry
```

Use canonical encoding and domain-separated signatures. Validate that the issuer was authorized for the relevant epoch and action. A worker's PAYMENT assertion is not settlement: reconciliation must confirm the vault event and actual asset movement. Merchant delivery and evaluator outcome use distinct signatures/roles. Validate parent existence and same-task membership in the authorized verifier; avoid unbounded on-chain traversal.

Historical receipt acceptance is separate from fresh spending authority: a delayed old-epoch receipt may document an old action but cannot authorize a new reservation. Deduplicate by semantic operation and receipt type, not a fresh random receipt ID. Preserve attempt numbers without making a settled operation purchasable again.

Keep detailed receipts encrypted offchain. Anchor a salted commitment or batch Merkle root when public evidence is necessary; the Merkle root establishes inclusion integrity, not truth or completeness. An authorized auditor can receive the envelope, signature, opening salt and inclusion proof. Public fields needed for financial enforcement remain public in the first implementation.

ERC-8004 can be an optional provider-discovery/reputation adapter. The current draft provides identity, reputation and validation registries, while explicitly separating payments. Use a conforming implementation and pinned interface if integrated; do not relabel ACTA's custom registry as conformant. Public ERC-8004 IDs must not be attached to private-mode task receipts if unlinkability is the objective.

## 4. Privacy must name the observer

| Observer | Initial protection | Still visible or trusted |
|---|---|---|
| Storage provider | Encrypted task/checkpoint/result objects | Access timing, ciphertext sizes, network metadata unless separately protected |
| RelayBudget service | Owner encrypts locally; scheduler sees minimal scheduling metadata | Assignment, timing and any explicit routing fields; server cannot perform plaintext orchestration without receiving plaintext |
| Worker or LLM provider | Minimized task disclosure and separate task keys | Necessary plaintext input; recipients can retain it |
| RPC endpoint | Actual anonymizing Anon-RPC worker for browser reads | Queried addresses and methods; transport aims to hide source network identity |
| Public chain observer | Minimal events, commitments instead of task contents | Vault/worker addresses, token amounts, recipients, timing and assignment links |
| Owner/auditor | Selective decryption and signed evidence | Intentionally receives task history; not anonymous from the owner |

Do not claim that a fresh session key hides its operator if public registration, gas funding, shared vaults or timing link the keys. Encrypted mempools can protect pre-inclusion information in a compatible design, but do not hide data later published on-chain. The EF frame-transaction alternative mempool is not, by itself, an encrypted mempool.

## 5. Encrypted recovery without our key server

Generate a separate authenticated-encryption key for each task/checkpoint version. Encrypt locally with a vetted library and bind task/version/schema as associated data. Wrap the data key to the owner's encryption public key and each authorized worker using a standard reviewed construction; select and pin the library during the implementation spike. Never derive an encryption key directly from a public address or publish decryption material in logs.

The owner maintains a recovery bundle: chain/vault/task references, encrypted object bytes or redundant storage references, owner-wrapped keys and format/version information. Financial exit needs no checkpoint. Work resumption needs available ciphertext and owner access to its keys. A hash/CID alone does not provide data availability.

For handoff, an owner-side client or explicitly trusted customer-run key service wraps the necessary task keys to the replacement. Automatic handoff while the owner is offline therefore has a key-availability trust assumption. Avoid advertising both zero key-service trust and unrestricted unattended replacement without implementing a mechanism that achieves both.

Rotate keys for future checkpoints after replacement. An old worker may retain plaintext and old keys; revocation does not erase its memory. Keep sensitive details out of public Arkiv entities; use only deliberately public provider discovery metadata there.

## 6. Private RPC implementation spike

Use `@anon-rpc/browser-harness` with a real anonymizing worker, not the documented passthrough example. The harness is browser-only; do not assume this npm package makes backend workers private. Route supported browser RPC reads through its fetch transport by default; inventory every other path, including wallet, explorer, indexer and discovery requests.

Record bootstrap-provider exposure, chosen worker/specifier hash, transport, chain compatibility and network failure behavior. No silent direct fallback in private mode. Offer an explicit user-visible switch to ordinary access if necessary. Private RPC adds latency; measure it separately from settlement and worker handoff.

Anon-RPC hides a different layer from payment privacy. Its provider may still see queried public addresses. The bootstrap provider is trusted for the specifier read; the worker and network have their own trust assumptions. Omit analytics and redact telemetry.

## 7. Anonymous eligibility: isolated prototype

If identity privacy is a core demo requirement, prototype Semaphore V4 membership authorization on one supported EVM testnet. Prove that a worker belongs to a customer-approved pool without revealing which membership credential it uses. This hides pool-member identity under the proof system's assumptions, not the task's payment history.

Bind the signal to `chainId, vault, task, epoch, sessionKey, role, expiry` and the assignment policy. Scope nullifiers to the intended one-time action and enforce their consumption. A copied proof cannot change the bound session key or payment authority. Permissionless relaying is possible because authorization is bound to the message, not the relayer's address.

The owner/scheduler still approves assignments under existing policy. A valid membership proof is not permission to take any funded task, nor proof of capability or sufficient reputation. Dynamic eligibility needs current approved roots; do not accept arbitrary historical roots after removal. Revocation of membership must also address already-active sessions explicitly. Test front-running, domain replay, reuse, concurrent claims and epoch changes.

Keep the proof membership identity independent of publicly registered operator wallets. Avoid posting the public ERC-8004 ID beside the proof. A small or colluding pool, known onboarding traffic, key funding and endpoint metadata can deanonymize activity. The scheduler or task recipient may know the operator through the service connection even when chain observers do not.

Start with an isolated authorization demonstration, not money. Port its verifier into the funded vault only after target-chain proof verification, cost and nullifier behavior pass tests. Existing Semaphore membership proofs do not automatically prove hidden task budgets or private reputation thresholds; those require additional constructions.

Fully confidential amounts and an unlinkable payment graph require a shielded settlement design with its own accounting, double-spend prevention, key recovery and merchant integrations. That is beyond this hackathon baseline.

## 8. Build order and acceptance evidence

1. Authorship: implement signed receipt schema and vault authorization. Reproduce rejection of a receipt naming an agent whose key the caller does not control. Confirm delayed documentation cannot authorize spending.
2. Financial independence: run original cap/replay/epoch invariants; terminate backend, scheduler, facilitator and discovery service; directly recover available owner funds. Reserved obligations remain intact until settlement/expiry.
3. Confidential checkpoints: recover a checkpoint on a fresh independent client with the owner's export; hand off to replacement; verify wrong-key decryption and modified ciphertext fail. Demonstrate old worker cannot decrypt future rotated versions, without claiming erasure of earlier data.
4. Private reads: capture client requests and controlled endpoint logs for direct and anonymized transport; verify no direct fallback, record bootstrap exposure and report cold-start plus p50/p95 request latency. Logs establish limited observations, not global anonymity.
5. Optional membership prototype: accepted pool member, rejected nonmember, duplicate nullifier, altered session key and wrong-chain/task/epoch proofs. Report proof generation time, verifier gas and anonymity-set size. No invented success percentages.
6. Narrow objective output validation: choose a task with a deterministic predicate, publish its limitations and compare it with a deliberately invalid artifact. An LLM PASS vote is an evaluator assertion, not cryptographic proof of correctness.

## 9. Sponsor and chain consequences

Keep EF CROPS as the lead candidate: demonstrate owner exit when our services disappear, encrypted recoverable data, and stated metadata limits. Anon-RPC is an alternative EF prize route if supported reads work end to end and private routing is central. EF permits at most one prize per project; these are not cumulative awards. Its alt mempool track requires actual frame-transaction usage, not an encryption claim.

Hedera x402 remains conditional on the existing transfer-executor settlement spike. Do not assume Semaphore verifier economics or the browser private-RPC transport are verified on Hedera. Use a separate EVM prototype if needed and label it clearly. Arkiv remains public discovery; storing ciphertext or public metadata does not make the overall financial graph anonymous.

Defer bridges and cross-chain failover until these properties work on one chain. Static multichain deployments can follow without pretending they provide global atomic budget enforcement.

## 10. Defensible pitch

“Give a team of agents a task budget without sharing your treasury key. If one fails, replace it, preserve authenticated payment evidence, and recover available funds even if our service disappears. Task contents are encrypted; public payment metadata remains visible.”

Optional prototype extension: “A worker can prove eligibility for an approved pool without publicly revealing which membership credential it used.”

## Sources

- [ACTA README](https://github.com/PrinceAikinsBaidoo/ACTA-Protocol/blob/9f649a8c5745953a4c3e6b9f2ff3a4841f7ae95a/README.md)
- [ACTA AgentRegistry](https://github.com/PrinceAikinsBaidoo/ACTA-Protocol/blob/9f649a8c5745953a4c3e6b9f2ff3a4841f7ae95a/contracts/src/AgentRegistry.sol)
- [ACTA ReceiptRegistry](https://github.com/PrinceAikinsBaidoo/ACTA-Protocol/blob/9f649a8c5745953a4c3e6b9f2ff3a4841f7ae95a/contracts/src/ReceiptRegistry.sol)
- [ACTA ReputationEngine](https://github.com/PrinceAikinsBaidoo/ACTA-Protocol/blob/9f649a8c5745953a4c3e6b9f2ff3a4841f7ae95a/contracts/src/ReputationEngine.sol)
- [ERC-8004 draft: identity, reputation and validation](https://eips.ethereum.org/EIPS/eip-8004)
- [Semaphore V4 overview](https://docs.semaphore.pse.dev/)
- [Anon-RPC integration and trust assumptions](https://ethereum.github.io/anon-rpc/wallets/)
- [Mumbai EF qualification requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation)
