# Shared Janus context

Read [CONTEXT.md](CONTEXT.md) for product intent and verified implementation boundaries, [PLAN.md](PLAN.md) for the next milestones, and [ARCHITECTURE.md](ARCHITECTURE.md) for module/configuration ownership.

This folder is the common context for frontend, backend, contracts and future contributors. Update it when a milestone, interface or decision changes. `protocol/` contains the shared network selection, generated ABI and interface manifest consumed by backend/frontend. Run root `npm run interface:export` after Solidity interface changes and `npm run interface:check` to verify export freshness. See [direct recovery](RECOVERY.md). Do not store credentials, generated build caches or duplicate module implementation here.

The root README owns setup instructions. Module READMEs own local usage. `docs/` holds reference research and historical records, not the current execution plan.
