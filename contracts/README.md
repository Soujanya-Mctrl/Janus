# Janus contracts

Solidity financial core with two preserved phases. Phase 0 proves bounded payment and owner withdrawal. Phase 1 implements multi-task accounting, reservations, epoch handoff, expiry and owner recovery.

Run `npm ci` here or root `npm run setup`. Root `npm run contracts:compile` compiles both phases; `npm run test:treasury` runs the multi-task suite. `npm test` here runs both local suites on ephemeral EVMs without user credentials or live funds.

Phase-1 live tooling depends on `../backend/hedera/lib/` and ignored `../backend/.env.hedera`. Install backend dependencies before using it. See phase READMEs for historical proof details. The original dossier and handoff are archived in `../docs/archive/`.
