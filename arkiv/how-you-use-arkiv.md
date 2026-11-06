# How Janus uses Arkiv

The frontend publishes/reads v2 public profiles and applies them to role configuration. The backend also feeds query results into checkpointed replacement selection. Capability/network/protocol filtering changes eligibility, ownership prevents address impersonation, and native expiry plus the lease excludes stale availability. A signed readiness challenge and explicit owner policy precede treasury assignment. Entity/query references are saved with assignment intent.

Run `npm run arkiv:query` without the Janus API. Run `npm run demo:handoff` for fixture-directory/local-payment proof. With a dedicated funded Rabdi key, `npm run demo:arkiv` publishes and uses live Arkiv reads in the local treasury flow. It labels live discovery and local financial execution separately. Details: `shared/ARKIV.md` and `arkiv/schema.md`.

Empty discovery waits; unavailable reads fail without private-directory fallback. Pending assignments reconcile while Arkiv is offline. Remote-process transport, automatic failure detection, browser orchestration and combined live Hedera/Arkiv execution remain separate work. Deterministic results do not prove model quality.
