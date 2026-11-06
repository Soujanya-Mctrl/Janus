# Phase 5: paid research and replacement

The trusted supervisor can now compose `executeResearch` with `createPaidResearchTools`. Each research branch has a pinned task runner, current worker wallet and explicitly eligible replacement. Browser requests cannot supply signer bindings. The dashboard-only research path remains unbilled unless this trusted configuration is supplied; connected financial browser controls remain phase 6.

The broker obtains source artifacts through the existing quote/reserve/purchase SDK before inference. Only the purchased result text enters the model prompt; receipt and wallet metadata stay outside it. This is data minimization, not a comprehensive privacy gateway. The reference source is a deterministic paid dataset, not a web-search service. Research checkpoints remain private plaintext filesystem data.

The regression kills an actual worker process after confirmed payment and before its checkpoint acknowledgement. Unrelated workers continue. The supervisor confirms `assignWorker`, increments the epoch, restarts the worker process with replacement wallet authority and replays the original logical purchase. It verifies three distinct Paid events, 60 units spent total, identical original/reused transaction hash, old-worker refusal and a nonempty final report. Model credentials and transaction signers stay in the supervisor, never in child IPC.

Reproduce after setup/contract compilation:

```sh
npm run demo:paid-research --prefix backend
```

The default regression uses local model fixtures and an ephemeral local EVM. To run five real Groq calls (one plan, three researchers, one report; at most 800 output tokens each), explicitly enable live provider billing with the ignored provider environment file:

```sh
JANUS_LIVE_RESEARCH=1 JANUS_PHASE5_EVIDENCE=.runner-state/phase5 npm run demo:paid-research:live --prefix backend
```

This uses the available `openai/gpt-oss-20b` model. Funds and transactions are local test fixtures even when the model is live. Evidence is written to the selected directory. Unknown provider outcomes stop for reconciliation; never rerun an uncertain paid inference automatically. No new live Hedera transaction or sponsor qualification is claimed by this phase.
