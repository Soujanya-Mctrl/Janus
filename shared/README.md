# Shared Janus context

Read [CONTEXT.md](CONTEXT.md) for product intent and verified implementation boundaries, [PLAN.md](PLAN.md) for the next milestones, and [ARCHITECTURE.md](ARCHITECTURE.md) for module/configuration ownership.

This folder is the common context for frontend, backend, contracts and future contributors. Update it when a milestone, interface or decision changes. Runtime-neutral network configuration, wire/operation rules, the independent accounting model, versioned ABI export and historical deployment manifest live here. Read [TREASURY_INTERFACE.md](TREASURY_INTERFACE.md) for the supported scope and [RECOVERY.md](RECOVERY.md) for independent owner exit. Do not store credentials, generated build caches or duplicate module implementation here.

The root README owns setup instructions. Module READMEs own local usage. `docs/` holds reference research and historical records, not the current execution plan.

See [PAID_WORKFLOW.md](PAID_WORKFLOW.md) for the task-aware SDK, signed HTTP adapter, result durability and local proof boundaries.
