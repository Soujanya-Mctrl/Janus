# Shared Janus context

Research workspace: [WORKBENCH.md](WORKBENCH.md) covers research-role configuration, encrypted provider keys and Hedera/Arkiv preparation. The current product story and runnable handoff are defined in [demo.md](../demo.md).


See [DOCKER.md](DOCKER.md) for the one-command local Compose stack and its integration boundaries.

Read [CONTEXT.md](CONTEXT.md) for product intent and verified implementation boundaries, [PLAN.md](PLAN.md) for the next milestones, and [ARCHITECTURE.md](ARCHITECTURE.md) for module/configuration ownership.

This folder is the common context for frontend, backend, contracts and future contributors. Update it when a milestone, interface or decision changes. Runtime-neutral network configuration, wire/operation rules, the independent accounting model, versioned ABI export and historical deployment manifest live here. Read [TREASURY_INTERFACE.md](TREASURY_INTERFACE.md) for the supported scope and [RECOVERY.md](RECOVERY.md) for independent owner exit. Do not store credentials, generated build caches or duplicate module implementation here.

The root README owns setup instructions. Module READMEs own local usage. `docs/` holds reference research and historical records, not the current execution plan.

Use [demo.md](../demo.md) for the presentation walkthrough, feature coverage and intended track mapping. It labels local proofs, recorded testnet evidence and planned integrations separately; it changes no sponsor verification claim.

See [PAID_WORKFLOW.md](PAID_WORKFLOW.md) for the task-aware SDK, signed HTTP adapter, result durability and local proof boundaries.

Use the [sponsor verification plan](../docs/SPONSOR_VERIFICATION.md) and [evidence register](../docs/evidence/sponsor-status.json) for every phase that changes a sponsor claim. Record measured outcomes, reviewer evidence and unresolved eligibility requirements.

Use [ARKIV.md](ARKIV.md) for wallet setup, independent queries, discovery-driven handoff and the live-discovery/local-payment demo.
