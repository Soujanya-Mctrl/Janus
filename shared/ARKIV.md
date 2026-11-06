# Arkiv replacement discovery

Janus uses Arkiv as a wallet-owned, expiring research-worker directory. `backend/arkiv/discovery.mjs` checks ownership, execution network/protocol/capability, native expiry blocks and a Unix-second availability lease. Owner authorization and a fresh worker-signed readiness challenge are required. `handoffFromArkiv` feeds the selected address into the checkpoint runner, rechecks eligibility with another query/challenge before assignment, and saves the entity key/query block in the private assignment outbox.

## Setup and independent query

Run root `npm run setup`; the backend independently pins SDK 1.0.1. Read without starting the Janus API, merchant or frontend:

```sh
npm run arkiv:query
```

Default filters: `janus.worker.v2`, researcher, ready, research capability, `eip155:296`, `janus-task-v1`, and unexpired `validUntil`. Results include entity keys, owners, native expiry blocks, Unix-second leases, page blocks and latency in milliseconds. Empty results are valid. RPC failures exit unsuccessfully without fallback. The reader handles up to 1,000 ordered records and fails at a full bound rather than selecting from a truncated directory. Pages can come from different blocks; this is not a transactional snapshot.

Copy `backend/.env.arkiv.example` to ignored `backend/.env.arkiv`, restrict it to mode 0600, and configure a dedicated **testnet-only** `ARKIV_WRITER_PRIVATE_KEY`. Fund its address with tGLM from <https://hub.arkiv.network/faucet>. Optional `ARKIV_ACCESS_KEY` avoids the heavily rate-limited public endpoint. Do not reuse a production/Hedera signer or put this key in frontend configuration.

```sh
npm run arkiv:preflight
npm run arkiv:publish
npm run arkiv:query
```

Preflight is read-only and prints the writer/balance. Publish spends Rabdi test gas and prints writer, entity key and transaction hash. `ARKIV_WORKER_NETWORK` defaults to Hedera testnet. Republishing creates a fresh one-hour entity; discovery deduplicates wallet identities. Browser publication/query under `/dashboard/agents` uses the same v2 fields and the connected wallet. v1 profiles are excluded because they lack network, scheme and lease fields.

## Verify the handoff

```sh
npm run contracts:compile
npm run demo:handoff
```

This uses a **fixture directory and local EVM payments**, real worker signatures and real local contracts/HTTP merchant. It checks interruption after payment, independent B/C/D progress, discovery-driven selection, pre-assignment revalidation, lost assignment acknowledgement, paid-result reuse, five unique purchases totaling 100 local units, old-worker rejection, empty-directory waiting and unavailable-directory behavior. Evidence: ignored `backend/.runner-state/demo/report.json`, labelled `fixture-not-testnet`.

With a funded dedicated Rabdi key, explicitly run:

```sh
npm run demo:arkiv
```

This publishes a real one-hour Rabdi entity advertising **`eip155:1337` for the local demo**, queries it, then runs the handoff using live Arkiv reads and the matching replacement signer. Treasury, assignments, purchases and merchant remain **local**, not live Hedera. The worker is an in-process logical client, not remote-process/model execution. Publication, query and report evidence are saved to `backend/.runner-state/arkiv-live/`. If a later step fails, preserve publication evidence and inspect the query before publishing again. To independently read demo profiles, set `ARKIV_WORKER_NETWORK=eip155:1337` in the ignored file, query, then restore the desired network.

## Runtime and authority

`handoffFromArkiv({ runner, directory, publicClient, manifest, taskId, schedulerWallet, authorize, probe })` requires runtime adapters. `authorize(address, record)` must approve only owner-approved workers. `probe({ worker, message, signal })` obtains the worker's signature and `{ busy: false }` from its actual runtime; support the abort signal. The challenge binds task, treasury, execution network, epoch, entity, worker, fresh nonce, 30-second deadline and readiness declaration. Each probe times out after five seconds. The demo signs through local worker wallets; a remote transport and unattended failure detector are not supplied here.

Discovery grants no spending permission. Only the treasury owner/scheduler can assign; the epoch fences old authority. Readiness is a point-in-time declaration, not a capacity lock, reputation score or capability proof. Remote deployments requiring capacity reservations need a worker-side atomic claim. Empty discovery waits without assignment. Already-submitted assignments reconcile without Arkiv or a still-live lease; unknown old-chain outcomes stop rather than rebroadcast. Repeating a confirmed handoff is idempotent. To begin another handoff after a later failure, explicitly pass `failedWorker` matching the currently assigned worker.

Prompts, keys, budgets, financial journals and private checkpoints stay off Arkiv. Independent owner recovery never needs this directory. See [RUNNER.md](RUNNER.md), [RECOVERY.md](RECOVERY.md) and the [sponsor plan](../docs/SPONSOR_VERIFICATION.md).

## Funded verification, 7 November 2026

Writer `0xf4F1a10309FCb1514bF6b0eb1E4813E220D936F0` published two one-hour Rabdi entities (one per execution-network filter) with confirmed receipts. Independent CLI reads and an actual React directory read found the Hedera-compatible profile. Live Arkiv selection drove the local financial handoff: epoch 2, five distinct purchases totaling 100 local units, original payment reused, stale worker rejected and unrelated tasks preserved. See [raw evidence and scope](../backend/arkiv/evidence/2026-11-07/README.md). There is one writer and no measured external adoption. Profiles and availability leases expire; this is historical proof, not a promise of an always-populated directory. Early browser-test attempts required correcting the fixture heading and replacing the public environment variable as Next does; those were test-harness issues, not an Arkiv node failure. No new Hedera transaction or complete remote research orchestration is claimed.
