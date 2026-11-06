# Integration observations

The installed SDK is 1.0.1 and uses typed schemas and `.select().from().where().fetch()`. Earlier attribute-only examples should not be copied without checking this API. Its wallet client includes Arkiv write actions and `addChain`, but not `switchChain`; the implementation uses the EIP-1193 wallet request to switch. Rabdi access keys are public origin/IP-restricted RPC keys, unlike secret LLM API keys.

Observed on 7 November: the public-endpoint v2 query returned block 305652, zero matching Hedera research profiles and 391 ms query latency. This is one observation, not a benchmark. No dedicated writer was configured at that observation; publication timing and external feedback remain unmeasured.

Expiry units were the consequential integration issue: `$expiresAt` is a block height, while application availability uses Unix seconds. Reproduce by selecting `$expiresAt` and `validUntil` in the independent query. We now check both separately. Suggested improvement: prominently show both units in a worker-directory recipe.

Schema-mismatched rows appear in `skipped`; stopping on decoded row count alone can omit candidates. Our pager uses decoded-plus-skipped to detect the last page. Pages can read different blocks, so the directory is not an atomic snapshot. A recipe covering units, pagination, duplicate publications and revalidation would help. These are documentation suggestions, not claims of a node defect.
