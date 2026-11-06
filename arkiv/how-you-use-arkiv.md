# How Janus uses Arkiv

The Integrations view publishes a profile through the connected wallet and reads ready trader profiles using the official SDK. The directory returns names, capabilities, writer/worker addresses, entity keys and expiry. Selecting a profile applies its name/public capabilities to Alpha's configuration, which the user can save and use in a later run. The profile does not automatically grant spend authority or turn a remote wallet into an executing worker.

Reproduce after funding a dedicated Rabdi wallet: open `/dashboard/agents`, choose Integrations, connect a wallet, publish Alpha, and read the directory. Record the wallet, entity key and transaction hash. From the repository root, `node --experimental-strip-types --env-file-if-exists=frontend/.env.local frontend/scripts/query-arkiv.mjs` runs the same read query. This makes a real RPC request; it has not been run in this phase.
