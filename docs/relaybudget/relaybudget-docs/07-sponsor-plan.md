# Sponsor fit and submission evidence

Verified against the current Mumbai pages on 6 November 2026. Eligibility remains conditional on the actual build and event/partner decisions. All evidence below starts **not completed**.

## 1. Recommended three partner choices

| Partner | Target | Role in the product | Selection gate |
|---|---|---|---|
| Ethereum Foundation | Best CROPS App, $3,500 pool | Owner exit and revocation remain usable without our service | Actual backend-off recovery and accurate privacy/trust disclosure |
| Hedera | AI Agents That Pay: x402, $6,500 pool | A real protected paid tool in the agent workflow | Phase 0 contract/HTS/x402 executor compatibility; confirmation if experimental fallback is used |
| Arkiv | Build on Arkiv, from scratch, $4,000 pool | Independently queryable, expiring worker discovery used for replacement | Actual writes plus user-visible discovery reads |

These are pools, not expected earnings. The $14,000 sum is not a forecast or a single-team award. Do not optimize around that sum.

Mumbai permits up to three partner selections. Its page lists the submission deadline as 7 November 2026 at 09:00 IST and a four-minute finalist demo plus Q&A [S1]. Recheck the dashboard. Follow the stricter applicable partner video limit; a three-minute video fits the proposed EF-led submission.

## 2. EF CROPS

Lead property: resilient owner control. Demonstrate cancel/recover with our backend stopped. Keep keys local, remove client trackers, disclose public payment metadata. Ship a runnable FOSS repo, a `CROPS` README section covering each property and dependency, and a maximum-three-minute property demo. EF tooling is optional. A project can receive at most one EF award [S2].

Evidence tasks:

- `README.md`: run steps and license.
- `docs/CROPS.md`: actual dependencies and observer visibility; link from README.
- Recovery build and direct contract calls with service-shutdown evidence.
- Owner key location and exact contract/chain trust assumptions.
- Explicit statement that MVP money flows are public; no "private agent wallet" claim.

Anon-RPC is optional only if supported traffic actually uses it. Alternative-mempool eligibility requires real frame-transaction usage; this architecture does not earn that prize merely because it mentions epochs or account abstraction.

## 3. Hedera x402

Current requirements include a protected endpoint settling on Hedera, an autonomous paid request, a public repo explaining setup/payment flow and a transaction ID, and a video of at most five minutes with HashScan evidence. Spending controls and multi-agent activity are relevant extras [S4].

Our evidence: an agent buys the dataset through the selected scheme; the facilitator invokes the budget contract; a supported HTS asset actually moves; failover reuses that purchase; old authority is rejected. Record chain configuration, token ID/address, decimals, gas payer, transaction IDs, and explorer links. Store no live secrets.

Prefer the specified `exact`/`transferExecutor` route and verify the selected facilitator actually supports it. An experimental `relaybudget-v1` fallback is not stock `exact`; confirm its acceptance before claiming eligibility. A disconnected wallet payment does not demonstrate our budget controls. Mock transfers do not satisfy the required settled-payment evidence.

## 4. Arkiv

For the from-scratch app track, write current-testnet entities, read them in a visible feature, publish writer addresses and a reproducible query, use an open-source license, and supply schema/feedback plus criterion files. Unused logs do not qualify. Judging weights feedback, reach, why Arkiv, and feature use equally [S3].

Required evidence files:

```text
arkiv/schema.md
arkiv/friction.md
arkiv/reach.md
arkiv/why-arkiv.md
arkiv/how-you-use-arkiv.md
```

Our feature: a replacement worker is discovered from wallet-owned capability/availability records, not a hardcoded local array. Expiry limits stale listings; app validates identity and readiness separately. Show an independent client reading the same directory. Do not claim expiration erases historical public data or prevents linkage.

If an ordinary private database would deliver identical user value, the "why Arkiv" case is weak. The proposed benefit is shared discovery and portability across independent operators. Validate it rather than retrofitting a log.

## 5. Alternatives and exclusions

Arc advanced stablecoin logic is a possible alternative, but every Arc track requires Arc Studio as the starting point and a shareable Studio project plus a functional app and diagram [S5]. If selected, start there at Phase 0 and preserve provenance. Do not add it retrospectively to a Codex-only build. Avoid claiming consumer marketplace eligibility without the specific discovery/payment flow.

Chainlink CRE can be a coherent alternative if a real workflow combines chain state with external health/service data and meaningfully drives the product; local simulation is accepted by its current track [S6]. Do not add a decorative oracle read. Independent recovery must not depend on CRE being available.

ENS is relevant only if genuine delegated identity/permissions are central, not a name label. Uniswap is not a natural fit until the product actually includes useful trading functionality. 0G inference is not necessary for financial correctness. Extra chains, bridges, token launches, and sponsor-specific robotics are out of scope.

## 6. Required submission matrix

| Claim | Evidence | Initial status |
|---|---|---|
| Core recovery works | Direct cancel/expire/withdraw with backend/DB/facilitator/registry stopped | Not implemented |
| Budget control is enforced | Contract tests plus actual rejected transaction/call trace | Not implemented |
| Agent B resumes A | Checkpoint, payment reuse, epoch event, completed output | Not implemented |
| Hedera paid request | Protected endpoint code and real settlement transaction | Not implemented |
| Arkiv changes user behavior | Write address, entity/query, replacement selection trace | Not implemented |
| Metrics reproducible | Manifest, raw events, derivation, confidence intervals | Not measured |
| Open source and attribution | License, commit history, dependency credits, AI disclosure | Pending implementation repo |
| Privacy claims accurate | Data-flow table and no trackers; public financial state disclosed | Specification only |

## 7. Fresh versus Continuity

Use prior projects as references, not as undisclosed project-specific code. Classic and Continuity rules differ; document anything reused and confirm eligibility. A source-code fork is not equivalent to using a general library. Preserve incremental commits and the distinction between pre-existing material and hackathon work [S1].
