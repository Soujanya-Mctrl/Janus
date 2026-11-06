# Checkpointed worker reference

Use root `npm run demo:handoff` after setup/contract compilation. The fixture deploys only an ephemeral local EVM and saves actual observed evidence under ignored `backend/.runner-state/demo/report.json`.

`createCheckpointRunner` exposes `inspect`, `run`, and `handoff`. `selectReplacement` applies deterministic eligibility filters. See [the runner boundary and evidence](../../shared/RUNNER.md). No background service, live-chain transaction or model API call starts on import.
