// Trusted supervisor configuration only: never deserialize wallet bindings from a browser.
export function createPaidResearchTools(bindings) {
 const entry = id => { const value = bindings[id]; if (!value) throw new Error('No authorized paid-tool binding for research worker'); return value; };
 return {
  async acquire(agentId, afterPaid) {
   const binding = entry(agentId);
   const state = await binding.runner.run({ walletClient: binding.walletClient, afterPaid });
   // Only purchased content enters the model prompt, never wallet/receipt metadata.
   return state.completed.map(step => ({ step: step.id, content: step.result.result }));
  },
  async replace(agentId) {
   const binding = entry(agentId);
   if (!binding.replacementWallet || typeof binding.eligible !== 'function') throw new Error('No authorized replacement');
   await binding.runner.handoff({ schedulerWallet: binding.schedulerWallet, replacement: binding.replacementWallet.account.address, eligible: binding.eligible });
   binding.walletClient = binding.replacementWallet;
  },
 };
}
