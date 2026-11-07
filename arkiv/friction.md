# Integration observations

The installed SDK is 1.0.1 and uses typed schemas and `.select().from().where().fetch()`. Earlier attribute-only examples should not be copied without checking this API. Its wallet client includes Arkiv write actions and `addChain`, but not `switchChain`; the implementation uses the EIP-1193 wallet request to switch. Rabdi access keys are public origin/IP-restricted RPC keys, unlike secret LLM API keys.

Observed on 7 November: the public-endpoint v2 query returned block 305652, zero matching Hedera research profiles and 391 ms query latency. This is one observation, not a benchmark. No dedicated writer was configured at that observation; publication timing and external feedback remain unmeasured.

Expiry units were the consequential integration issue: `$expiresAt` is a block height, while application availability uses Unix seconds. Reproduce by selecting `$expiresAt` and `validUntil` in the independent query. We now check both separately. Suggested improvement: prominently show both units in a worker-directory recipe.

Schema-mismatched rows appear in `skipped`; stopping on decoded row count alone can omit candidates. Our pager uses decoded-plus-skipped to detect the last page. Pages can read different blocks, so the directory is not an atomic snapshot. A recipe covering units, pagination, duplicate publications and revalidation would help. These are documentation suggestions, not claims of a node defect.

## Funded verification, 7 November 2026

Writer `0xf4F1a10309FCb1514bF6b0eb1E4813E220D936F0` published two one-hour Rabdi entities (one per execution-network filter) with confirmed receipts. Independent CLI reads and an actual React directory read found the Hedera-compatible profile. Live Arkiv selection drove the local financial handoff: epoch 2, five distinct purchases totaling 100 local units, original payment reused, stale worker rejected and unrelated tasks preserved. See [raw evidence and scope](../backend/arkiv/evidence/2026-11-07/README.md). There is one writer and no measured external adoption. Profiles and availability leases expire; this is historical proof, not a promise of an always-populated directory. Early browser-test attempts required correcting the fixture heading and replacing the public environment variable as Next does; those were test-harness issues, not an Arkiv node failure. No new Hedera transaction or complete remote research orchestration is claimed.
