# Janus frontend

Next.js UI and wallet authentication. Run `npm ci` here, then `npm run dev`, or use root `npm run setup` and `npm run dev`. Local Privy configuration belongs in ignored `.env.local` in this folder.

`npm run build` and `npm run lint` validate the frontend. The dashboard currently shows illustrative accounting and targets Sepolia; it is not connected to the historical Hedera treasury. The session verification endpoint is a frontend authentication boundary, not a treasury service.
