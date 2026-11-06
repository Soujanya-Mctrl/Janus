# Dashboard-created research agents

Status: implementation plan; agent execution and monitoring described below are not yet implemented. Follow [demo.md](../demo.md), preserving the existing paid-task handoff and independent recovery.

## Reference and product fit

Reference: [Lifeline, ETHGlobal Tokyo 2026](https://ethglobal.com/showcase/lifeline-mygz6) and its [source repository](https://github.com/DivyanshGoel20/lifeline). Reviewed `web/src/components/Monitor.tsx`, `Dashboard.tsx`, `EventTape.tsx` and `web/src/lib/provisionAgent.ts` on 7 November 2026. Lifeline provides agent authorization, per-agent status/payment traces and a payment activity feed; provisioning reports whether on-chain authorization succeeded. Its credit and repayment mechanics are outside this Janus plan. This is independent implementation inspired by interaction patterns, with no copied source or new sponsor acceptance claim.

Janus adds user-selected LLM providers and a research orchestrator. Creating an agent saves a worker definition; creating/funding a task establishes a separate budget. A replacement inherits task state and remaining allowance. An identity login, provider key or saved agent definition never grants treasury authority.

## User journey

1. Sign in; save a provider API key in the encrypted credentials vault.
2. Create an agent: name, research responsibility, provider credential reference, model ID and allowed tool capabilities. Start with a coordinator plus three workers; permit a bounded list rather than the current fixed Alpha/Beta/Gamma form.
3. Create a research run: research question, selected workers, dependency graph, task caps, per-operation purchase ceilings and tool allowlist. Review the plan, provider billing notice and chain mode before starting. Owner wallet approval establishes financial authority; show draft/pending/confirmed separately.
4. Janus dispatches independent research branches concurrently. Each agent card shows assigned task, model, status, heartbeat, current step and checkpoint. A run graph shows coordinator -> parallel researchers -> evidence review -> final report.
5. Inspect an ordered activity feed and per-agent drill-down: task assignment, provider request start/result, tool request, reservation, payment receipt, artifact saved/reused, checkpoint, failure, reassignment and completion. Tool parameters/results are sanitized and bounded; show concise execution summaries rather than private model chain-of-thought. Sensitive prompts/artifacts remain account-private.
6. Interrupt a worker after a paid artifact is persisted. Unrelated tasks continue. Reconcile its pending operations, fence the old epoch, assign an eligible replacement and reuse the original artifact without purchasing it again.
7. View the final report, citations/artifacts, payment references and accounting. Refresh/reconnect to the same durable run. Offer pause/resume/cancel with explicit semantics and a link to independent owner recovery.

## Ownership and implementation

| Module | Responsibility |
| --- | --- |
| `frontend/` | Agent creation/edit/archive, provider selection, run creation, monitor cards/graph, account-private timeline and evidence inspection. Replace illustrative controls as each real path is connected. |
| `backend/workbench/` | Existing encrypted vault/provider adapters plus bounded agent registry; credentials resolved server-side by verified identity. Never return keys to clients or include them in worker messages/events. |
| `backend/runner/` | Janus orchestrator, durable run/task state, bounded concurrency, worker lifecycle, tool gateway, checkpoint replay and replacement reconciliation. Reuse existing task payment SDK; do not introduce another financial ledger. |
| `backend/hedera/` and `contracts/` | Authoritative task budgets, reservations, settlement, worker epoch and direct recovery. Financial actions remain constrained by contract policy. |
| `backend/arkiv/` / shared directory interface | Eligible research-worker discovery. Account for ongoing directory work; do not replace its interfaces with a hardcoded fallback. No candidate yields a visible waiting state. |
| Private persistent state | Versioned agents, immutable run configuration, append-only ordered events, inference intents/results and checkpoint references. Begin with the supported single-host durable store; multi-host execution requires transactional storage before scaling. |

A durable background supervisor owns run lifetime independently of the browser request. Use separate worker processes with bounded slots and heartbeats. Provider calls go through a server broker that resolves credentials and records request intent; workers receive only scoped execution data. Prevent duplicate supervisors with exclusive run/task ownership. A process exit does not prove a pending payment or inference was unbilled.

Proposed authenticated APIs: `/api/agents` for definitions; `/api/runs` for create/list; `/api/runs/[id]` for account-scoped snapshot; `/api/runs/[id]/events?after=SEQUENCE` for reconnectable events; `/api/runs/[id]/actions` for idempotent pause/resume/cancel and demo interruption. Use event IDs and replay from storage; browser disconnect must not terminate or duplicate a run. All requests verify account ownership, configured capabilities and credential scope. Apply bounded body sizes, concurrency and retention.

Persist event ID/sequence, run/task/agent IDs, epoch, operation ID, event type, timestamp, safe summary and artifact/transaction reference. A live feed is a projection of persisted events and receipts, not client-side generated activity. Heartbeats measure worker liveness, not proof of useful progress. Explicit run states include draft, awaiting-authorization, queued, running, pausing, paused, reconciling, waiting-for-worker, completed, failed and cancelled.

## Financial and recovery rules

- Display available, reserved, spent, released and withdrawn from authoritative chain state, tagged with network and latest observed block. Do not infer balances from animation or model responses.
- Provider API billing is external to treasury tool payments. Require explicit provider-run consent, cap requests/output tokens and expose provider usage when returned. Without verified pricing, label costs unknown/estimated; task USDC caps cannot guarantee the external provider bill. Use provider-side account limits.
- Record inference intent before submission and the response before accepting dependent work. An uncertain outcome blocks automatic rebilling and exposes reconciliation. Replaying completed inference or a paid tool step reuses its stored result.
- Pause stops dispatching new work; reconcile in-flight calls before claiming paused. Cancel stops new work and requests the authorized contract action; it does not refund spent funds or erase reservations. Resume uses the original versioned run configuration.
- Reassignment waits for confirmed authority/epoch and reconciles lost acknowledgements. A revoked credential prevents new calls; an agent archive does not silently cancel its tasks or invalidate financial obligations.
- The model proposes research work; deterministic tool policy and the contract enforce spending. No arbitrary shell execution, provider URLs or unbounded autonomous loops.

## Delivery phases and acceptance

1. **Agent creation and run records.** Extend fixed configuration to account-owned bounded agent definitions, preserve existing vault keys, version/migrate configuration and snapshot immutable run inputs. UI creates/edits/archives agents; rejects another account's credential. Tests prove account isolation and migration. No model call on save.
2. **Parallel orchestrator and monitoring.** Implement supervisor, actual concurrent workers and durable ordered events. Use credential-free research fixtures first. Show start, heartbeat, step, failure, pause and completion. Acceptance: two independent workers overlap, browser reload replays the same events, and concurrent resume cannot duplicate execution. Fixtures remain labelled local.
3. **User-key model execution.** Connect existing provider adapters through the broker with explicit billing consent, bounded calls and persisted inference. Acceptance: mocked provider tests prove key isolation, response reuse and uncertain-call blocking; separately authorized live calls produce a real research artifact. Never silently spend API credit while testing.
4. **Paid tools and visible financial handoff.** Connect research steps to existing task SDK/contracts and authoritative dashboard accounting. Acceptance: confirmed payment, injected worker-process failure, continued unrelated task progress, confirmed epoch change, original artifact reuse and no duplicate debit; pending funds stay protected. Reuse the existing local demo oracle, not hardcoded UI totals. Keep recorded Hedera evidence separate from a fresh run.
5. **Arkiv replacement and owner exit.** Consume the ongoing directory adapter, reject ineligible/expired profiles and visibly wait with no eligible candidate. Stop application services and demonstrate independent recovery. Acceptance records positive/removal tests and captures actual receipts. Update sponsor evidence without inflating qualification claims.

Each phase requires its focused regressions, frontend lint/types/build when changed, documentation and remote synchronization before publishing. Retain the existing merchant/treasury regressions. No phase is complete merely because its UI renders.

## Presentation

Create research agents -> select saved credentials/models -> start a task -> watch parallel branches -> inspect a paid source receipt -> interrupt one worker -> watch other tasks continue -> replacement reuses the source -> display final report -> show independent recovery.

This strengthens the demo by making Janus's financial continuity observable. Keep scope to research, one settlement network and bounded workflows. Separate local fixtures, live provider inference, recorded Hedera evidence and planned integrations on screen. No new trading, lending or unrelated sponsor dependency is needed.
