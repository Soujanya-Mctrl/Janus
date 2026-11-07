# Security and sponsor-fit experiment

Branch: `experiment/security-sponsor-fit`. Baseline: `7436e49e98c37e420830a1f30cf3b5211dd4066d` after integrating the fetched upstream change. This branch is an experiment, not a production release or completion of every security phase. Main is unchanged.

Before publication, upstream `c0656969570179a4135d14523b80d1b024c93245` added funded Arkiv publication/read/handoff evidence and was integrated without changing the tested runtime implementation. Those records belong to their recorded run, not this experiment's local tests. Two profiles came from one wallet; they do not prove two independent operators or an always-available directory.

## Implemented changes

New research snapshots, controls and inference intents, paid-runner checkpoints, and task-aware merchant records use AES-256-GCM envelopes. Authenticated data binds each record to its storage domain and account/task-relative filename. Copying a record between accounts, runs or domains fails authentication. Missing keys, corrupted ciphertext and legacy plaintext never cause a reset to an unpaid/new operation.

Production refuses automatic local key generation. Provider credentials require `JANUS_VAULT_KEY` or `JANUS_VAULT_KEY_FILE`. Private JSON requires `JANUS_DATA_KEYRING_FILE`, an absolute path outside the protected directory. A secret manager may provision these files; no managed KMS integration or isolated signer service is claimed. Keep secret mounts outside ALL state volumes, with host ACLs restricted to the service identity. Development alone generates local keys; copying development state and its key defeats storage confidentiality.

The data keyring is JSON with `active` naming an entry in `keys`; each value encodes 32 random bytes in canonical base64. Example shape only: `{ "active": "key-2026-11", "keys": { "key-2026-11": "BASE64_32_RANDOM_BYTES" } }`. The example value is invalid deliberately. Generate secrets with a cryptographic generator into a protected file, never a public command transcript. Keep vault and data keys distinct. No key material belongs in Git, browser variables, evidence or public Arkiv entities.

The authenticated research API now accepts explicit confirmed deletion only for completed/cancelled runs. It refuses active locks, unresolved runs and foreign-account records. The UI explains that payment journals, provider copies and backups remain. Deletion removes local research, not funds or purchase identity. A failed directory removal can leave a hidden `.deleting-<run-id>` quarantine; operators must reconcile/remove it while services are stopped. No automatic backup erasure or retention scheduler exists.

Provider calls retain fixed HTTPS destinations, redirect refusal, 800-output-token bounds, and now a 128,000-character input bound. The supervisor permits only the plan, configured worker steps and report within their bounded call count. These are request bounds, not a dollar-denominated provider budget. Billable consent discloses off-device research context. Model output remains text, not an instruction to invoke a wallet or shell.

Frontend/backend Arkiv publication share an explicit public field projection. The browser uses a generic worker label instead of publishing a private agent name automatically. Wallet address, network, capability, availability and timings remain public. A deliberately supplied public label may itself disclose information. Entity expiry is not a guarantee that historical copies disappear.

## Migration and rotation

Stop research supervisors and merchants before maintenance. Preserve encrypted backups, old keys, deployment manifests and unsettled-operation journals. Do not delete state to get past a decryption failure. Existing operator files were NOT migrated by this experiment.

Run from the repository root, substituting an absolute directory. For research, use the `research` subdirectory of the workbench state root. Merchant/checkpoint directories contain their hash-named JSON records. Do not target the repository or a mixed evidence directory.

```sh
npm run security:state --prefix backend -- --directory ABSOLUTE_PROTECTED_DIRECTORY --domain research-v1
```

Supported domains: `research-v1`, `paid-checkpoint-v1`, `merchant-operations-v1`. The default authenticates records and reports a plan without changing payloads. `--allow-legacy` explicitly permits existing plaintext during offline migration. `--apply` encrypts/rewrites records under the active key. The tool refuses unexpected JSON paths, symlinks, unresolved temporary files and active/stale locks; normal stores refuse reads/writes while its maintenance lock exists.

For rotation, provision a keyring containing both old and new keys with the new key active, run the plan and apply for EVERY protected domain, verify replay/recovery, then retire old keys according to backup retention. Development ciphertext uses key ID `development`; an offline transition must retain its existing 32-byte `.private-key` under that ID until rewritten. Do not print it. Vault key rotation is a separate unimplemented migration; changing its key without re-encrypting vaults makes credentials inaccessible.

Migration is atomic per record, not across a directory. An interruption leaves a mix of authenticated old/new records; retain both keys and rerun after reconciliation. Locks are not automatically stolen. POSIX directory fsync is retained where supported; Windows supports file fsync here but not directory fsync. This does not establish equivalent power-loss durability or correct Windows ACLs.

## Threat model and residual risks

- Another authenticated account: verified session scoping plus ciphertext identity binding protect against record substitution; account hashes are pseudonyms, not anonymous identities.
- Storage-only theft: production files without separately mounted keys do not expose protected payloads. Paths, file sizes, timing and key IDs remain visible. Backups inherit the same key-management obligations.
- Compromised application host: the running service can decrypt data and use authorized provider/signing capabilities. Encryption at rest does not solve this. Separate OS identities/containers and a policy-limited remote signer remain open.
- Compromised worker/scheduler: contracts bound spending, but a scheduler can assign a malicious worker within existing task policy. Useful-result quality and prompt-injection resistance are not proven by settlement.
- Public observers: chain addresses, amounts, task IDs and authority events are public. RPCs can observe requests/client metadata. Arkiv is a public directory; hashes are not confidentiality.
- Providers: receive dispatched research and source text. Provider retention, backups and subprocessors depend on the selected service; no zero-retention guarantee is made.
- Dependency attackers: fresh npm production audit reports 28 findings (17 high, 11 moderate). Non-forced audit-fix preview changed zero packages and left all 28. A breaking suggested Privy downgrade was not applied. Reachability review and a tested wallet-stack migration remain release blockers.
- Merchant/server loss: encryption does not restore unavailable paid artifacts. Independent owner recovery protects available funds, not settled purchases or every failure of chain/token/wallet infrastructure.

## Six-phase acceptance status

1. Baseline: threat model and fresh dependency audit recorded. Reachability review and deployment-host ACL verification remain open.
2. Credentials/signers: production key configuration fails closed; retained-key data rotation is tested. Managed KMS, vault rotation and isolated policy signing remain open.
3. Research privacy: encrypted persistence, offline migration, provider disclosure and bounded local deletion implemented. Backup deletion and timed retention remain open.
4. Worker containment: request/call-count limits implemented. Separate-identity sandboxing, egress enforcement and monetary provider caps remain open.
5. Financial recovery: rerun local treasury, payment/replay, paid research and independent browser regressions. Manual live extension-wallet rehearsal and independent security audit remain open.
6. Product/sponsors: one story and honest disclosures documented. Funded Arkiv publication/read/handoff records are now integrated from upstream. Browser-paid research, actual x402 interoperability, track provenance, licensing, independent review and final video remain open.

Reproduce with `npm run test:security`, `npm run check`, `npm run recovery:test:browser --prefix contracts`, and `npm run dashboard:test:browser --prefix contracts`. Tests use fixtures/local EVMs and do not authorize live provider billing or chain transactions. See the append-only [experiment evidence](../docs/evidence/security-sponsor-experiment.json) for actual outcomes.

This Windows host's C: drive became full during verification. Final checks used workspace scratch/cache directories on D:. The normal Turbopack build passed with `RAYON_NUM_THREADS=1`, `UV_THREADPOOL_SIZE=2` and `NODE_OPTIONS=--max-old-space-size=1536`; no build configuration or global environment was changed. Backend test files now run serially to avoid concurrent local-chain/worker memory pressure. Browser fixtures use an in-memory LevelDOWN database and standard loopback HTTP transport, preserving actual EVM execution and all wallet assertions while avoiding Ganache's Windows disk-cleanup failure. See initial failures and successful reruns in the evidence record.

## Sponsor positioning

The product promise is: **a research task keeps its budget and purchases when workers change, keeps private progress off the public directory, and preserves the owner's independent exit.**

Hedera: emphasize contract-enforced spending, original-purchase replay and stale-worker refusal. Next show an actually interoperable HTTP 402 challenge/payment flow and useful paid source on Hedera; encrypted state does not replace the x402 qualification gate. [Official track](https://ethglobal.com/events/mumbai/prizes/hedera).

EF CROPS: lead with the independently hosted recovery artifact, and demonstrate encrypted private progress plus honest third-party disclosure. Recovery already existed at this branch baseline; do not present it as a new experiment feature. This branch improves storage privacy, not anonymous payments. FOSS licensing, tracker/network review and correct Classic/Continuity provenance remain mandatory. [Official categories](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation).

Arkiv: emphasize wallet-owned expiring availability, public independent queries, policy/readiness-checked replacement and no fallback on missing directory data. Keep prompts, keys, results and checkpoint locations off Arkiv. Show publication/read-driven selection and the feature waiting when no eligible worker exists. No external adoption is claimed. [Official categories](https://ethglobal.com/events/mumbai/prizes/arkiv).

For a combined recording, label every local/testnet segment. Show a purchase, interruption, directory-selected replacement, original artifact reuse and backend-off owner exit, with the privacy boundary visible before provider dispatch/publication. This script is an acceptance target, not a claim that a combined live recording exists.
