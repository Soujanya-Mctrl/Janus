# Worker directory schema

SDK: `@arkiv-network/sdk` 1.0.1, Rabdi testnet (chain 7794095). Defined in `frontend/src/lib/arkiv-directory.ts` as schema `janus.worker.v1`.

Indexed attributes: `worker` (address), `role` (string), `status` (string), `capabilities` (string). Stored nonindexed attribute: `name` (string). System owner/key/expiry fields are selected with these attributes. A wallet publishes its own address, `role=researcher`, `status=ready`, `capabilities=research`, and a user-selected display name. The entity expires after one hour. No credential, private prompt, balance or financial authorization is stored.

Reads filter ready research workers and return at most 20 profiles. The frontend can apply a returned public profile to Alpha's saved configuration. This is profile selection, not authority to spend from a treasury. Expiry and chain identity do not establish reputation or spending permission. Actual writer address, entity key and transaction hash remain pending a user-authorized write; the UI displays them when one succeeds.
