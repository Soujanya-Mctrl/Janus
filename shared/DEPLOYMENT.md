# Runtime deployment configuration

The browser, detached research supervisor and local merchant resolve the same deployment identity through `shared/runtime-deployment.mjs` and `backend/lib/runtime-deployment.mjs`. Without custom configuration, the historical Hedera testnet descriptor remains the default. Treasury reads/actions still validate its chain, bytecode, owner and token against the chain.

For a custom local deployment set these server environment variables together:

- `JANUS_DEPLOYMENT_FILE`: absolute path to the bootstrap's public `deployment.json`.
- `JANUS_RPC_URL`: RPC reachable by the supervisor/frontend host, such as `http://contracts:8545` inside Compose.
- `JANUS_BROWSER_RPC_URL`: credential-free HTTP(S) RPC reachable by the wallet/browser, such as `http://127.0.0.1:8545`. Query strings and embedded credentials are rejected.
- `JANUS_MERCHANT_URL`: merchant service URL, such as `http://backend:4023`. Its `/deployment` identity must match the configured manifest.

Compose supplies these values and mounts the chain manifest read-only into frontend and merchant. Host development can use the same manifest file with loopback service URLs. A port override changes the browser RPC URL as well. Browser RPC access requires appropriate CORS support. Use the host's address rather than browser loopback when opening the site from another computer.

`GET /api/deployment` is request-time, uncached configuration. It exposes an explicit public manifest projection and browser chain definition; it does not expose internal RPC/merchant URLs, file paths or arbitrary manifest fields. Configured deployments are validated against service RPC and merchant before returning. Wallet chain selection, treasury actions, treasury network labels and Arkiv execution-network filtering use this descriptor. Arkiv publication itself still uses the separate Rabdi chain.

New dashboard runs persist the server-selected deployment identity; request-supplied deployment objects are ignored. Resume and detached supervisor startup reject changes to chain, interface, treasury, token, owner or bytecode identity. Older unbound research records retain their existing research-only behavior. This step does not bind runs to funded treasury tasks or enable paid tools; those are the next integration phase.

The local bootstrap now records the treasury deployment block for new deployments. Existing manifests without that field remain supported. Never recreate a deployment merely to populate metadata.

Verification: `backend/workbench/runtime-deployment.test.mjs` deploys real local contracts and tests identity, code, chain and merchant mismatches, browser/service URL separation and public projection. `contracts/phase1/test/dashboard-wallet.test.mjs` exercises the actual React treasury panel through runtime configuration against the local chain. Frontend API tests exercise detached research execution. No sponsor qualification or new live-network execution is claimed. Full Compose startup needs an available Docker Linux engine; configuration validation alone is insufficient.

On 7 November 2026, backend workbench tests (9), frontend tests (9), the paid-research process/payment regression and the actual Chromium treasury acceptance passed. The browser acceptance additionally rejects a changed deployment before any wallet transaction; the API regression rejects changed-deployment resume before dispatch. Repository checks, lint and standalone TypeScript passed. Production compile/generate stages passed after combined build rechecks exhausted host memory; an earlier combined build also passed. Production HTTP smoke verified the historical default, public/no-store configuration, login/dashboard responses and 503 for an invalid manifest supplied at runtime. Compose configuration validates, but the Docker Linux engine is unavailable, so image build/start and container purchase/replay remain unverified. Phase publication remains pending that container gate.

The subsequent Docker retry reached engine 29.6.1 and began `docker compose up --build --wait`. Dependency extraction reported filesystem I/O errors as host C: reached zero free bytes; the engine then disconnected and reported that Docker Desktop could not start. Docker's data disk is on C:, while D: has approximately 101 GB free. No Janus service startup or purchase/replay was verified. No images, volumes or durable state were deleted. Free host storage or relocate Docker storage before retrying; phase publication remains blocked.

The user authorized moving host Docker storage to D:. The stopped data disk was copied and SHA-256 verified, Docker's storage setting was changed, and the original disk was retained. Restart encountered stale IPC-socket errors; transient socket directories were preserved under backup names. Recovery was interrupted before a working engine or active D: disk could be verified. The user subsequently requested publication of the repository fixes as a checkpoint. This does not close container acceptance or claim that the storage move is fully operational. Host storage/settings/backups and credentials are not part of this commit.
