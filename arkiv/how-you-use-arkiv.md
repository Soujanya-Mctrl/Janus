# How Janus uses Arkiv

The frontend publishes/reads v2 public profiles and applies them to role configuration. The backend also feeds query results into checkpointed replacement selection. Capability/network/protocol filtering changes eligibility, ownership prevents address impersonation, and native expiry plus the lease excludes stale availability. A signed readiness challenge and explicit owner policy precede treasury assignment. Entity/query references are saved with assignment intent.

Run `npm run arkiv:query` without the Janus API. Run `npm run demo:handoff` for fixture-directory/local-payment proof. With a dedicated funded Rabdi key, `npm run demo:arkiv` publishes and uses live Arkiv reads in the local treasury flow. It labels live discovery and local financial execution separately. Details: `shared/ARKIV.md` and `arkiv/schema.md`.

Empty discovery waits; unavailable reads fail without private-directory fallback. Pending assignments reconcile while Arkiv is offline. Remote-process transport, automatic failure detection, browser orchestration and combined live Hedera/Arkiv execution remain separate work. Deterministic results do not prove model quality.

## Funded verification, 7 November 2026

Writer `0xf4F1a10309FCb1514bF6b0eb1E4813E220D936F0` published two one-hour Rabdi entities (one per execution-network filter) with confirmed receipts. Independent CLI reads and an actual React directory read found the Hedera-compatible profile. Live Arkiv selection drove the local financial handoff: epoch 2, five distinct purchases totaling 100 local units, original payment reused, stale worker rejected and unrelated tasks preserved. See [raw evidence and scope](../backend/arkiv/evidence/2026-11-07/README.md). There is one writer and no measured external adoption. Profiles and availability leases expire; this is historical proof, not a promise of an always-populated directory. Early browser-test attempts required correcting the fixture heading and replacing the public environment variable as Next does; those were test-harness issues, not an Arkiv node failure. No new Hedera transaction or complete remote research orchestration is claimed.
