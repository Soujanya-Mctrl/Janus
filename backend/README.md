# Janus backend

Hedera merchant/facilitator and settlement verification. Run `npm ci` here or root `npm run setup`. Run `npm test` for offline settlement validation. Testnet secrets belong in ignored `.env.hedera` here. Live scripts require dedicated testnet accounts and may spend testnet funds.

`hedera:serve` runs the existing restricted Phase-0 HTTP payment proof, not the future task-aware workflow API. Compile artifacts via root `npm run contracts:compile` before deployment. Historical proof data lives in `hedera/evidence/`.
