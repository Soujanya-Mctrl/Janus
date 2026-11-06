# Integration observations

The installed SDK is 1.0.1 and uses typed schemas and `.select().from().where().fetch()`. Earlier attribute-only examples should not be copied without checking this API. Its wallet client includes Arkiv write actions and `addChain`, but not `switchChain`; the implementation uses the EIP-1193 wallet request to switch. Rabdi access keys are public origin/IP-restricted RPC keys, unlike secret LLM API keys.

TypeScript compilation passes. No account, funded wallet, live write or live query has been exercised in this phase at the user's request. Runtime RPC friction, time to first successful transaction and sponsor feedback are therefore not measured yet.
