# Research workspace setup

The workspace follows [demo.md](../demo.md): task-owned budgets, paid sources, checkpointed worker replacement and independent owner recovery.

## Current browser scope

Start with root `npm run dev`; open `/dashboard/agents` or `/dashboard/credentials`. The workflow view explains the research-task demo and points to `npm run demo:handoff`. Sign in to save research responsibilities, model IDs and encrypted credentials. These settings do not execute models, allocate on-chain budgets or grant spending authority. The treasury dashboard remains illustrative. Browser run/resume controls and their execution API have been removed; unknown execution actions are rejected.

The handoff command retains its real local-contract/HTTP fixture: four logical tasks, five unique purchases, 100 local base units spent and paid-result reuse after failure. It does not call a model or spend live funds. See [RUNNER.md](RUNNER.md), [PAID_WORKFLOW.md](PAID_WORKFLOW.md) and [RECOVERY.md](RECOVERY.md).

## Credentials and storage

Configure Privy through `frontend/.env.local`. All workspace reads and writes require verified identity. Keys are encrypted with AES-256-GCM and identity-bound authenticated data; responses return metadata only. Supported provider adapters remain OpenAI, Anthropic, Gemini, OpenRouter and Groq. Saving a credential makes no provider call. Research-model execution remains an integration gate.

`JANUS_VAULT_KEY` optionally supplies a server-only base64 encoding of 32 random bytes. Development otherwise creates an ignored `.workbench-state/vault/master.key`. Back up the key and vault together; production must inject the master key separately with private persistent storage and HTTPS. Never use `NEXT_PUBLIC_*` for private keys. `JANUS_WORKSPACE_ROOT` identifies the checkout; `JANUS_WORKBENCH_STATE_DIR` selects private state storage.

Existing encrypted credentials are preserved. Older incompatible execution configurations are ignored in favor of research defaults; saving a research configuration updates configuration only. Historical private run journals are retained but no longer accessible through the execution API. No automated deletion of private state occurs.

## Integration preparation

Hedera checks read chain ID and deployment-code presence only; they do not submit payments or establish runtime identity/x402 compliance. The separately recorded paid proof remains in `backend/hedera/evidence/task-aware-live-proof.json`.

Arkiv uses `janus.worker.v2` with researcher/ready/research, execution-network and protocol filters, and a Unix-second lease separate from native block expiry. Publishing a public one-hour profile requires a connected wallet and testnet gas. Reading/applying a profile configures a role; it does not assign treasury authority or implement automatic replacement. Independent live reads and local discovery-driven runner handoff pass; funded publication and browser orchestration remain pending. See [ARKIV.md](ARKIV.md). See [schema](../arkiv/schema.md).

Offline vault/provider/configuration and authenticated-route tests remain supported. This removal changes no sponsor acceptance claim. See [sponsor verification](../docs/SPONSOR_VERIFICATION.md).
