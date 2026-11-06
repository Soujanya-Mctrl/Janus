# Funded Arkiv publication and discovery proof

Writer: `0xf4F1a10309FCb1514bF6b0eb1E4813E220D936F0`. Rabdi chain: `7794095`. Dedicated testnet signer; its private key stays in ignored `backend/.env.arkiv` and is not included here.

Two real expiring entities were published by **one wallet**, not two independent operators:

| Profile | Entity | Transaction |
|---|---|---|
| Hedera-compatible research discovery (`eip155:296`) | `0x5ef681df509ab05db26d69a921c502a75771321bd8e283a74cfabd4af477e302` | [confirmed publication](https://rabdi.explorer.arkiv.network/tx/0x42574c616d1718a47cdf12f61d2c6b718ec674dd0584497c7c91eedc3827bf30) |
| Local-handoff research discovery (`eip155:1337`) | `0xb5f309c4358e973b37705a0f6085c4a9e44bf2b8eb78a89cd829774c5bf2ebaa` | [confirmed publication](https://rabdi.explorer.arkiv.network/tx/0x0806e4d792d42742c2bc6f8a5e4808a68a735fdf9a157883fc408533538fcf43) |

`publication-receipts.json` independently checks both receipts and records writer balance decreasing from 5 to 4.999650525 tGLM. The observed decrease is 0.000349475 tGLM across these two publications; it is not a general fee benchmark.

## Reproduce reads

From repository root after setup:

```sh
npm run arkiv:query
ARKIV_WORKER_NETWORK=eip155:1337 npm run arkiv:query
```

The first query selects schema `janus.worker.v2`, researcher/ready/research, `eip155:296`, `janus-task-v1` and an unexpired lease. Entities have a one-hour native expiry and a one-hour application lease. After expiry, empty current results are expected; historical evidence is not an always-on directory guarantee. Re-publication spends test gas and should be intentional.

## What was verified

- `hedera-profile.json`: SDK publication result for the normal dashboard's network filter.
- `hedera-query.json`: independent command-line SDK query found that entity and its wallet owner.
- `local-demo-publication.json`, `local-demo-query.json`: real Rabdi publication and initial query for the financial fixture's execution network.
- `local-demo-report.json`: the selected live entity drove replacement; assignment reached epoch 2, the original payment transaction was reused, five distinct local purchases totaled 100 local base units, old-worker commitments were rejected and unrelated tasks continued. Empty/unavailable discovery had no private-directory fallback.
- `browser-read.json` and `browser-directory.png`, when present: the actual React Integrations component queried the live public RPC and rendered the writer. Account/workbench API inputs were isolated fixtures; this does not claim a fresh authenticated-user or browser-publication flow.
- `provenance.json`: source commit, dirty state, implementation hashes and run commands. The source checkout includes unrelated local audit work; the hashed Arkiv implementation itself is unchanged.

`npm run demo:arkiv` publishes another local-network entity and repeats the handoff. It uses **live Arkiv discovery and local EVM financial execution**. No new Hedera settlement, real model report or remote worker process is implied by that test. Browser research-run automatic reassignment remains separate. These records clear the previous missing-writer/funded-publication blocker, not all sponsor requirements or independent review.
