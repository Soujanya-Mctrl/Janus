# Worker directory schema

Schema `janus.worker.v2`; SDK 1.0.1; Rabdi chain 7794095. Constants: `shared/arkiv-worker.json`. Implementations: `backend/arkiv/directory.mjs` and `frontend/src/lib/arkiv-directory.ts`.

| Attribute | Type/index | Purpose |
| --- | --- | --- |
| worker | addr, indexed | Worker identity; discovery requires entity owner = worker |
| role | str, indexed | researcher |
| status | str, indexed | ready |
| capabilities | str, indexed | research; one capability in this version |
| network | str, indexed | Execution network, e.g. eip155:296; separate from Arkiv chain |
| scheme | str, indexed | janus-task-v1; current signed adapter, not standard x402 certification |
| validUntil | u64, indexed | Availability deadline in Unix seconds |
| name | str, nonindexed | Display name, 1–50 characters |

System `$key`, `$owner`, `$updatedAt` and `$expiresAt` are selected. **Arkiv expiry/update fields are block heights, not timestamps.** Native lifetime and the separate availability lease are both one hour. Filtering covers role/status/capability/network/scheme/lease; discovery checks native blocks, ownership, failed/busy/unauthorized workers and signatures. Multiple publications resolve per wallet by latest update block, then entity key. v1 profiles are not execution candidates.

Only public worker metadata is stored. Prompts, credentials, budgets, task IDs and private checkpoint references stay off Arkiv. Readiness challenges and assignment evidence are private. Expiry is availability management, not historical erasure. Actual writer/entity/transaction evidence must come from publication output; no writer is invented here. See `shared/ARKIV.md`.
