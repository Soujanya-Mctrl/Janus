# Dashboard research runtime

## Use

Start `npm run dev` and sign in. `/dashboard/agents`, `/dashboard/runs` and `/dashboard/credentials` use the original unified dashboard shell: same sidebar, glass surfaces, typography, content area and pill controls. Overview, Tasks, Wallet and Recovery retain their existing layout.

1. On Agents, create/configure a coordinator and up to six worker definitions. Archive/restore workers; keep at least one active worker. Definitions are account-owned and versioned through the existing research configuration. Saving does not call a model or grant financial authority.
2. On Credentials, save a supported provider API key. Existing encrypted vault records and master keys are preserved. Assign each active agent its credential reference and exact model ID.
3. On Runs, enter a research question. Local fixture mode needs no keys and can interrupt the first worker after its artifact is persisted. Live model mode requires explicit external-provider billing consent and credentials/models for all active agents.
4. Inspect persisted run activity, worker process IDs/heartbeats/attempts, artifacts and the final report. Filter events by agent. Refreshing retrieves the same run; browser disconnection does not stop the detached supervisor.
5. Pause stops new dispatch after in-flight calls settle. Resume uses the original configuration and saved artifacts. Cancel is a research execution action, not treasury cancellation or a refund. Unknown inference outcomes enter reconciliation and cannot be automatically retried.

The request budget is one coordinator planning call, one call per active worker and one coordinator report call (maximum eight calls with six workers), each requesting at most 800 output tokens. Provider API charges are external to task USDC caps. Provider-side account limits remain necessary; output limits do not guarantee a dollar invoice ceiling.

## Implemented boundary

The new research runtime has actual parallel worker processes. The supervisor owns event ordering, provider brokerage, checkpoints and bounded replacement. Workers receive no provider keys or signing tools. A replacement reuses a saved inference response; fixture failure/replacement is a local process demonstration, not an on-chain assignment epoch. The supervisor uses the existing fixed-endpoint provider adapters. It does not fetch the web, buy sources, reserve treasury funds or claim citations that were not supplied. Findings are based on supplied context/model knowledge and must identify missing evidence.

Payment-aware research tools are now available through trusted supervisor bindings and verified by the CLI phase-five demo; see [PHASE5.md](PHASE5.md). Dashboard financial projections and discovery-driven research-worker reassignment remain separate integration gates. The existing paid SDK/handoff and independent recovery continue to be verified through their own commands. The browser research fixture must not be presented as that paid handoff. Existing Arkiv work is preserved separately.

## Persistence and deployment

`backend/workbench/research.mjs` stores immutable run inputs, checkpoints and ordered events under ignored `.workbench-state/research/ACCOUNT_HASH/RUN_ID/`. The supervisor is a fixed backend script spawned by the authenticated `/api/research` route, independently of the browser response. Configure `JANUS_WORKSPACE_ROOT` for the full checkout and `JANUS_WORKBENCH_STATE_DIR` for private persistent storage. This requires a long-lived Node host with child-process support, not a frontend-only/serverless deployment.

Run snapshots use file fsync and atomic rename, with an exclusive supervisor lock. They do not claim distributed transactions or power-loss durability across arbitrary filesystems. Killed supervisors can leave locks; inspect the process, intents and results before an operator reconciles them. Locks are not stolen. State/artifacts are private plaintext filesystem records; API keys remain in the encrypted vault. Retain backups and appropriate host permissions. Two unfinished runs per identity and 100 retained runs per identity bound this prototype; multi-host scheduling and global capacity controls remain production follow-ups.

## Verification

- `npm run test:workbench`: actual concurrent processes, replacement/replay, provider-call consent, key/identity isolation, uncertain inference and pause/resume tests; providers are mocked.
- `npm test --prefix frontend`: authenticated route creation, detached supervisor execution, cross-account denial and normal session/vault checks.
- `node frontend/scripts/verify-research-browser.mjs`: real Chromium renders the actual dashboard components with an isolated auth/local-runtime fixture. Verifies agent creation, parallel run, replacement, event filtering and final report at desktop/mobile widths. Requires contracts' esbuild/Playwright dependencies and installed Chromium. Optional `JANUS_CHROMIUM_PATH` selects an existing browser. This fixture does not bypass production authentication; production routes have separate identity tests.
- Frontend lint, types and production build cover the integrated shell and routes.

No live model billing or live payment is performed by these checks. Live provider execution still needs a user-selected key/model and explicit run consent. This milestone changes no sponsor qualification claim.
