# RelayBudget frontend

Next.js dashboard for payment-aware agent recovery. Testnet only.

## Setup

1. Run `npm install --legacy-peer-deps`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_PRIVY_APP_ID` to your public Privy App ID.
4. Set `PRIVY_VERIFICATION_KEY` to your app's ES256 PEM public verification key from the Privy dashboard. Use double quotes and literal `\n` between PEM lines. No App Secret is required.
5. In Privy, enable email and Ethereum wallet login, allow your deployed origin and `http://localhost:3000`, and enable embedded Ethereum wallets. Configure Sepolia support. WalletConnect may need its project configuration in Privy.
6. Run `npm run dev` and open http://localhost:3000.

## Integration

Email OTP and wallet authentication use Privy's modal. Email users without a wallet receive an embedded Ethereum wallet. Redirect happens after Privy confirms authentication. No demo authentication, pretend OTP, fabricated wallet address, ENS name, or portfolio balance is used.

The Wallet screen reads the selected connected wallet, chain ID, and Sepolia ETH gas balance through its EIP-1193 provider. Supports wallet selection, connection, refresh, explorer links, logout, and switching to Sepolia. Other networks do not display a Sepolia balance. Embedded owners can open Privy's secure wallet export. The recovery checkbox is a session-only attestation, not proof of export or a durable funding gate.

`GET /api/session` takes a Bearer access token and verifies ES256 signature, issuer, app audience, required expiry/issued-at/subject claims, and Privy DID. Missing/invalid/expired tokens return 401; missing/invalid server configuration returns 503. Responses are not cached. Tokens and keys are never logged. Public dashboard layout exposes no private tenant data. Future protected APIs must verify identity and tenant permissions on every request.

## Financial scope

No treasury contract or backend is present. Deposits, assignments, recovery, and withdrawals are unavailable. Wallet authentication does not imply custody integration. Default dashboard is empty. Explore example opens a labeled mock-unit fixture using the PRD's 1,000 deposit and Task A spent=20/reserved=10/available=70 example. Export produces illustrative accounting JSON, not a recovery bundle. No transactions or receipts are fabricated.

Sepolia is the only admitted network. Hedera is not claimed. An independent Privy-free recovery build remains to be implemented before funding can be enabled.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

Before enabling funding, complete email/wallet login on your configured origin, wrong-network/rejected-switch checks, expired-session checks, embedded export, and the PRD's contract/recovery release gates.
