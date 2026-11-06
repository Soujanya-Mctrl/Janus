# Janus sponsor implementation and verification plan

Rules reviewed: 6 November 2026, Asia/Kolkata. This is the current acceptance and evidence plan, superseding sponsor assumptions in the archived dossier. It is not a prize-eligibility certificate. Only organizers and sponsors decide eligibility and awards.

## Reviewer entry point

1. Read the current [implementation plan](../shared/PLAN.md) and [architecture](../shared/ARCHITECTURE.md).
2. Inspect the machine-readable [evidence register](evidence/sponsor-status.json). Run `npm run sponsors:check` to validate its structure and linked files. This command does not rerun experiments or establish sponsor approval.
3. For a submission-ready check, run `npm run sponsors:ready`. It must fail while required evidence remains open. A green register validator alone is not a green readiness gate.
4. Reproduce each claimed behavior at its recorded source commit using the stated command, environment and expected result. Inspect raw logs and chain effects rather than accepting a screenshot or a green label.
5. Open the final public transaction/query links and video timestamps. Recheck the official rules and actual dashboard track selection immediately before submission.

## Official requirement mapping

These are concise paraphrases of published requirements, separate from Janus's engineering targets below.

### Hedera: AI Agents That Pay / x402

The [official track](https://ethglobal.com/events/mumbai/prizes/hedera) requires an x402-protected endpoint settling on Hedera through an accepted or self-run facilitator; an agent/client must complete payment without per-request human approval. The public repo must explain setup, architecture and payment flow with a settled transaction ID. A video, at most five minutes, must show settlement and a HashScan link. Our custom signed HTTP adapter is not automatically proof of x402 compliance; retain protocol-level evidence or obtain a recorded sponsor interpretation before making that claim.

### Ethereum Foundation: CROPS

The [official requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation) call for a public FOSS repo, runnable instructions, a README section titled CROPS covering dependencies, openness, third-party visibility and security assumptions, and a video of at most three minutes showing the lead property when it matters. Client trackers are excluded; off-device keys/personal data require disclosure. EF tooling is optional, and at most one EF prize applies. Continuity has a separate upgrade category requiring before/after disclosure. Janus targets independent owner control; it does not claim private financial transactions.

### Arkiv: Build on Arkiv

The [official tracks](https://ethglobal.com/events/mumbai/prizes/arkiv) distinguish from-scratch and Continuity projects. Required evidence includes current-testnet writes and a user-visible feature reading them, writer wallets and a runnable query in README, an open-source license and AI disclosure, plus `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, and `/arkiv/how-you-use-arkiv.md`. SDK installation or unread logs do not qualify. The four judging criteria have equal weight; we do not equate our completion measures with their scores. Continuity must identify pre-existing work and new integration.


### Event-wide provenance

The [event rules](https://ethglobal.com/events/mumbai/info/details) distinguish Classic work begun after the event starts from Continuity upgrades, require transparent reuse and AI attribution with meaningful human contribution, and allow up to three partner selections. Preserve Git history, source/assets provenance and relevant spec/prompt artifacts. Verify the team's registered track and sponsor selections in the dashboard; repository dates alone cannot establish them. The published deadline is 7 November 2026, 09:00 IST; recheck the dashboard. A common sponsor video must respect the stricter three-minute EF limit.

## What makes each integration meaningful

Hedera is the shared financial enforcement boundary: a database display cannot replace epoch checks, conserved reservations and owner exit enforced by the treasury. Arkiv is implemented as an independently queryable replacement-worker directory, with funded publication evidence pending: it must affect which eligible replacement is selected, not just collect activity logs. CROPS is a property, not an installed dependency: the owner must retain a usable exit when Janus services are unavailable.

For each integration record the user problem, implementing files, actual runtime call, visible outcome and a removal experiment. A sponsor logo, package import, standalone token transfer, manually supplied worker list, or recovery button that still needs the main API is insufficient.

## Measurement protocol and pass conditions

All thresholds in this section are proposed Janus acceptance targets, not sponsor promises or observed results. Each run records counts and raw artifacts; do not advertise percentages without their denominators. Use a local fixture for adversarial repetitions and a separately labelled testnet demonstration. Do not silently combine local and live evidence.

### H1: payment enforcement and replay

Run a paid request, lose its response after settlement, restart the merchant and retrieve it under a replacement worker using the same operation identity. Record task/operation IDs, request/result hashes, reservation attempt, transaction ID, merchant credit, treasury debit, fee payer and both state snapshots.

Pass: one settled charge for the logical purchase, identical result digest on replay, matching token debit/credit excluding separately stated gas, and no extra payment from restart/retrieval. Report duplicate charges / replay attempts. Require zero duplicates in at least 20 deterministic local fault/replay trials with saved seeds and all failures. Repeat one bounded live example separately; do not rerun a live spending script merely to refresh screenshots.

Prove HTTP 402 challenge/payment/response behavior against the selected x402 scheme/version. Record facilitator method and executor authorization. The task-aware adapter's 96-byte authorization and the older Phase-0 proof are distinct integrations; demonstrate the path actually submitted.

### H2: stale authority and conservation

Inject reserve-versus-handoff and settle-versus-expiry races. Record which transaction is accepted first. Require zero accepted new old-worker reservations after confirmed handoff, no over-cap reservations, no duplicate settlement and no double release. Pre-handoff reservations remain valid until settlement or expiry. Check task cap = available + reserved + spent + returned, and deposited = accounted balance + total spent + total withdrawn after every accepted transition.

Removal experiment: a deliberately stale database still cannot authorize overspending or old-worker reservations against the real contract. Report all rejected/accepted operations, not only the successful handoff.

### A1: Arkiv-driven discovery

Publish at least two wallet-owned worker entities on the current testnet. Record entity keys, writer addresses, capabilities, availability, supported network/scheme, sequence and expiry. Query from both the scheduler and an independent client. In a controlled directory with one eligible worker, require the same candidate set and selection evidence; reject expired, unauthorized and capability-mismatched records. Readiness and spending authorization are independently checked.

Pass: the chosen replacement is traceable to a real query result and visible in the UI, with no hardcoded fallback during the proof. When no eligible result exists, display a waiting state without assigning a worker. Record eligible selections / injected scenarios and stale selections / injected stale scenarios; require zero stale/unauthorized selections across at least 20 deterministic fixtures and one testnet demonstration.

Removal experiment: disable the Janus-hosted worker directory/cache and discover the same public records independently. Disable Arkiv reads with fallback prohibited: the discovery step must visibly fail or wait. Report query latency and record freshness with units; do not invent adoption numbers for reach.

### C1: independently usable recovery

Export the recovery artifact, then stop orchestrator, merchant, main API and login service. Use an already independently controlled owner key, configurable RPC and pinned ABI/deployment identity. Demonstrate correct-address/network/code/owner/token validation, cancel, release and withdrawal. Use a task with 100 units, 20 spent and 10 reserved: recover exactly 70, retaining the 10 obligation. Test its later settlement and, separately, expiry. Do not label released-to-reserve funds as withdrawn.

Pass: no request to Janus API, Privy login, facilitator or registry in a sanitized network trace; recovered amount equals independently calculated available funds; unrelated tasks unchanged. Run at least three fresh local resets. Record process shutdown evidence, RPC requests, transaction receipts and balances. A CLI proof counts as CLI evidence; the planned browser UX requires its own recording.

Removal experiment: main domain/backend unavailable and a replacement RPC configured. Chain access, wallet access, gas and token operability remain dependencies. Document which failures this recovery cannot solve.

### C2: openness, privacy and security disclosure

Confirm a root FOSS license and third-party asset rights, exact clean-clone build instructions, and README CROPS text. Review the built client network trace for analytics/trackers and enumerate what Privy, RPCs, merchant, public chain and Arkiv learn. Public addresses, amounts and timing remain visible; encryption is not anonymity. Record dependency advisory counts and unresolved risks without claiming an audit. Verify secrets are absent from Git, browser bundles and public evidence. Sponsor-required `/arkiv/` documents must contain actual schema, queries, observations and feedback rather than filled-in claims unsupported by runs.

## Combined demo acceptance

Show one research purchase settled on Hedera, an interruption, Arkiv-driven worker discovery, current-epoch assignment, original-result retrieval, unfinished-step completion and another task continuing. Then shut down services and recover only available funds through the independent client. State what is local versus live on-screen. Show the HashScan payment, Arkiv entity/query and recovery transaction at recorded timestamps. A real model-backed execution remains a separate required product gate; deterministic fixture quality does not prove model quality.

A missing sponsor segment prevents claiming the combined demo is complete. Use separate clearly labelled runs when a live dependency is unavailable; never present a simulated sequence as live.

## Evidence record and readiness policy

Each requirement in the register has one of `missing`, `partial`, `recorded`, `verified` or `not-applicable`. Recorded means a file exists and reports a result; verified requires an independent reviewer to reproduce or inspect it at a specific commit. Not-applicable needs a source-backed explanation and reviewer. There is no aggregate eligibility percentage: all mandatory requirements and event/track provenance must be satisfied.

For verification attach a record under `docs/evidence/` containing requirement ID, source commit, clean/dirty state and patch hash if dirty, UTC run time, runtime/OS, local/testnet/mainnet, exact command and setup, fixtures/seeds, expected versus actual observations, exit code, raw evidence paths, public links, artifact SHA-256 hashes, test count/pass/fail, reviewer and limitations. Signed bytes, private keys, tokens, personal prompts and login identifiers must not enter public evidence. An evidence record must reference the run's actual source commit, not the later commit that merely adds the record.

The register validator checks bookkeeping and existence, not truth, external accessibility or sponsor approval. `sponsors:ready` is a necessary internal gate only. Before submission, manually verify source rules, track eligibility, protocol compliance, public access and video playback. Any unresolved ambiguity stays open until a cited sponsor/organizer response is recorded; do not contact sponsors automatically.

## Current assessment

Hedera task-aware payment/replay evidence is recorded in `backend/hedera/evidence/task-aware-live-proof.json`; the source was dirty and its executed-script hash is recorded, so independently reconcile the patch/provenance before promoting it. The record's scope is JSON-RPC receipt/event and exact balances, not native consensus child-record verification. Current custom HTTP compliance is still an open gate.

CLI recovery and checkpointed handoff have source/tests and documented local observations. Browser recovery and the connected dashboard remain open. Arkiv v2 discovery and runner integration now have local adversarial/handoff proof and an independent live read; funded publication and combined live discovery evidence remain pending. Root FOSS licensing remains unverified. Classic versus Continuity registration, full provenance, AI/human contribution disclosure, final sponsor docs and videos remain unverified. No sponsor is marked submission-ready.

## Phase discipline

Every phase must update this register with implemented behavior, measured outcomes, raw evidence and remaining gaps, or explicitly state that it changes no sponsor claim. Fetch/integrate, verify the phase, then commit and push to origin/main under the repository workflow. Keep historical evidence intact and use append-only per-run reports. Never change an expected threshold after seeing a failed result without recording the reason and previous threshold.
