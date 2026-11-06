# Janus frontend

Next.js UI and wallet authentication. Run `npm ci` here, then `npm run dev`, or use root `npm run setup` and `npm run dev`. Copy `.env.example` to ignored `.env.local` in this folder for Privy configuration. Next.js and its bundled documentation must be installed under this module's `node_modules/`.

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` validate the frontend. Session tests use generated local signing keys, check token rejection and PEM encoding, and need no Privy account. Build output and generated route types stay in `.next/` here.

The dashboard currently shows illustrative accounting and targets Sepolia; it is not connected to the historical Hedera treasury. The session verification endpoint is a frontend authentication boundary, not a treasury service. The recovery tab describes readiness; it cannot cancel or withdraw treasury funds.
