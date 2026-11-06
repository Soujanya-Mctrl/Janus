# Primary source register

Checked 6 November 2026. Links support factual background, API capabilities, and event requirements. Proposed architecture, thresholds, prices, and product benefits remain our design choices or hypotheses.

Research was located through official arXiv/publisher pages. Firecrawl Developer and Research CLI calls returned network-access errors in this environment, so primary web pages were the fallback. No paper reproduction or source-code audit was performed. Some documentation changes faster than papers; pin the actual source commit/version during implementation.

## Research

### R1

[SoK: Blockchain Agent-to-Agent Payments](https://arxiv.org/abs/2604.03733), submitted 4 April 2026. Systematizes discovery, authorization, execution, and accounting. Used to motivate cross-stage state, not a market forecast.

### R2

[Free-Riding the Agentic Web: A Systematic Security Analysis of x402 Payments](https://arxiv.org/abs/2605.30998), v2 revised 22 June 2026. The current title differs from the older title in the input workbook. Describes request/payment binding and settlement-race issues in evaluated versions. Does not establish current exploitable bugs in all products.

### R3

[When HTTP 402 Meets the Blockchain: Risks on Emerging x402 Payments](https://arxiv.org/abs/2607.19545), submitted 21 July 2026. Empirical facilitator security study; includes disclosure and mitigation context. Its historical sample is not our current security assessment.

### R4

[Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657), v3 revised 26 October 2025. MAST failure taxonomy and annotated traces. Motivates separating tool faults, coordination, and verification failures; not a paid-agent market estimate.

### R5

[OrchestraBench: Evaluating Multi-Agent Orchestration Failure Modes, Recovery, and Decomposition Quality](https://arxiv.org/abs/2608.05263), submitted 5 August 2026. Controlled fault-injection research. Its restricted mechanism probes must not be presented as real-world RelayBudget recovery rates.

### R6

[How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html), Martin Kleppmann, 8 February 2016. Author's explanation of fencing stale lock holders. Conceptual foundation for epoch enforcement at the write resource.

## Developer documentation

### D1

[LangGraph JavaScript persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence). Existing checkpointers and stores; the old durable-execution URL redirected here. Persistent workflow state is a baseline capability.

### D2

[x402 Payment-Identifier extension](https://docs.x402.org/extensions/payment-identifier). Current idempotency and request-fingerprint conventions. Our design must compare against this and preserve durable operation identity beyond a volatile result cache.

### D3

[Safe agent spending-limit guide](https://docs.safe.global/home/ai-agent-quickstarts/agent-with-spending-limit). Existing allowance-based token spending. Evidence of overlap, not proof of our differentiation.

### D4

[x402 Signed Offers & Receipts](https://docs.x402.org/extensions/offer-receipt). Existing receipt/offer extension to investigate and reuse; not our invention.

### D5

[OpenZeppelin ERC20 utilities](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20). Safe token handling references. Actual supported token behavior still requires target-network testing.

### D6

[OpenZeppelin utilities](https://docs.openzeppelin.com/contracts/5.x/api/utils). Reentrancy and other helper references. Select compatible implementations; a library import does not prove application safety.

### D7

[Foundry Forge](https://www.getfoundry.sh/forge/index.html). Contract build/test, fuzz/invariant, trace, and gas workflows. Pin the installed release and verify command options there.

### D8

[viem repository](https://github.com/wevm/viem). TypeScript Ethereum interface. The direct getting-started page returned an unsupported-content response in this environment; repository is the verified primary fallback.

### D9

[Fastify documentation](https://fastify.dev/docs/latest/). Proposed HTTP backend. Lock its actual version and read corresponding APIs before implementation.

### D10

[node-postgres transactions](https://node-postgres.com/features/transactions). Transaction statements must use the same client connection.

### D11

[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html). Database concurrency primitives; they do not replace contract authority checks.

### D12

[x402 payment schemes](https://docs.x402.org/schemes/overview) and [official repository](https://github.com/x402-foundation/x402). Verify scheme/network registration and payment flow against the pinned version. A new adapter does not imply universal facilitator support.

### D13

[Arkiv expiration](https://docs.arkiv.network/writing/expiration/). SDK expiration facilities. Expiry is not equivalent to privacy or guaranteed historical deletion.

### D14

[OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/). Proposed local traces and metrics. Redaction and retention are application responsibilities.

### D15

[Slither](https://github.com/crytic/slither). Solidity/Vyper static analyzer. Its findings need triage and reproductions.

### D16

[Echidna](https://github.com/crytic/echidna). Optional property-based contract fuzzer after core Foundry properties exist.

### D17

[Hedera x402 exact scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_hedera.md). Defines a contract-executor route as well as direct transfers. Facilitator availability is a separate compatibility question. Pin the reviewed commit.

### D18

[Playwright installation and testing](https://playwright.dev/docs/intro). Browser automation, isolation, and CI tools for recovery journeys.

### D19

[Vitest guide](https://vitest.dev/guide/). Proposed TypeScript test runner. Financial properties need meaningful assertions, not coverage alone.

### D20

[Anon-RPC](https://ethereum.github.io/anon-rpc/). Optional origin-anonymizing RPC reads; it does not make public treasury balances private.

### D21

[Unlink trust model](https://docs.unlink.xyz/trust-model). Earlier in this session the page described hosted proving/viewing/authorization boundaries; a later refetch failed. Reverify before choosing a private-balance extension. No Unlink recovery capability is assumed in the MVP.

## Winning project references

### W1

[AEGIS, Lisbon 2026](https://ethglobal.com/showcase/aegis-93ox5). Official showcase confirms the 0G infrastructure/tooling award and describes policy/recovery architecture plus submission limitations. Not a current code audit.

### W2

[ACL, Open Agents](https://ethglobal.com/showcase/acl-6hwos). Official showcase confirms first-place 0G tooling and ENS agent-integration awards. Agent-commerce SDK and private negotiation are substantial prior overlap.

### W3

[x402-flash, New York 2025](https://ethglobal.com/showcase/x402-flash-yj9wd). Official finalist and Coinbase award. Its latency claims are project claims, not independently reproduced benchmarks here.

### W4

[Aegis402, Open Agents](https://ethglobal.com/showcase/aegis402-o8x6z). Official finalist; distinct from AEGIS. Describes pre/post-payment auditing and escrow behavior.

## Event and sponsor sources

### S1

[Mumbai event details](https://ethglobal.com/events/mumbai/info/details). Official deadline, partner-selection limit, judging process, build provenance, and submission guidance. Recheck the dashboard before submission.

### S2

[Ethereum Foundation prizes](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation). CROPS requirements and EF category restrictions. This dossier plans compliance; it does not claim eligibility has been earned.

### S3

[Arkiv prizes](https://ethglobal.com/events/mumbai/prizes/arkiv). Current tracks are published, superseding the workbook's pending-rules entry. Use the current from-scratch/Continuity rules matching the actual project.

### S4

[Hedera prizes](https://ethglobal.com/events/mumbai/prizes/hedera). Protected paid endpoint, autonomous payment, setup/transaction evidence, and demo requirements. Confirm adapter specifics with sponsor staff.

### S5

[Arc prizes](https://ethglobal.com/events/mumbai/prizes/arc). Studio-origin requirement makes this an early architecture choice, not a late integration badge.

### S6

[Chainlink prizes](https://ethglobal.com/events/mumbai/prizes/chainlink). CRE workflow and accepted simulation route. Separate from CCIP's actual contract integration requirement.

## Market signal

### M1

[Coinbase paid SQL API via x402](https://www.coinbase.com/developer-platform/discover/launches/sql-api-x402). Demonstrates an actual paid API offering. Does not establish customer demand for RelayBudget or justify a market-size estimate.

## Codex

### C1

[Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex). Official workflow guidance. Adapt repository instructions and phase context to the project rather than copying every example convention.

### C2

[Custom Code Review rules for Codex](https://developers.openai.com/blog/custom-code-review-rules-for-codex). Official guidance on repository-specific review expectations.

### C3

[Build skills](https://learn.chatgpt.com/docs/build-skills). Official reusable-workflow guidance. Proposed project skills should wrap working procedures, not pretend to provide an audit by themselves.

## Evidence status summary

Verified: the cited event pages, awards, research descriptions, and selected documentation capabilities. Designed: RelayBudget's contract/state machine/SDK/benchmark. Not established: implementation correctness, exact facilitator compatibility, customer willingness to pay, novelty across all products, product speed/cost improvements, or sponsor acceptance.
