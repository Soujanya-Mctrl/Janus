export const defaultAgents = [
  { id: 'orchestrator', name: 'Orchestrator', responsibility: 'Coordinate the task, review risk and recover interrupted workers.', credentialId: '', model: '' },
  { id: 'alpha', name: 'Alpha', responsibility: 'Evaluate the DEMOA paper position and explain each decision.', credentialId: '', model: '' },
  { id: 'beta', name: 'Beta', responsibility: 'Evaluate the DEMOB paper position independently within its allowance.', credentialId: '', model: '' },
  { id: 'gamma', name: 'Gamma', responsibility: 'Test order limits on DEMOC and hold when risk checks reject an order.', credentialId: '', model: '' },
];
export const defaultConfig = { totalBudget: '100', taskBudget: '30', interrupt: true, agents: defaultAgents };
export function dollars(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,3})(\.\d{1,6})?$/.test(value)) throw new Error('Budget must be a decimal amount with up to six places');
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))).toString();
}
export function validateWorkbenchConfig(config) {
  if (!config || typeof config.interrupt !== 'boolean' || !Array.isArray(config.agents) || config.agents.length !== 4) throw new Error('Configure one orchestrator and three workers');
  const total = BigInt(dollars(config.totalBudget)), task = BigInt(dollars(config.taskBudget));
  if (total <= 0n || total > 1000000000n || task < 1000000n || task * 3n > total) throw new Error('Use a total of at most 1000 paper USD and fund all three task allowances');
  const agents = config.agents.map((agent, index) => {
    if (agent.id !== defaultAgents[index].id || typeof agent.name !== 'string' || !agent.name.trim() || agent.name.length > 50
      || typeof agent.responsibility !== 'string' || !agent.responsibility.trim() || agent.responsibility.length > 1500
      || typeof agent.credentialId !== 'string' || !/^(|[a-f0-9-]{36})$/.test(agent.credentialId)
      || typeof agent.model !== 'string' || agent.model.length > 100) throw new Error('Invalid agent configuration');
    return { id: agent.id, name: agent.name.trim(), responsibility: agent.responsibility.trim(), credentialId: agent.credentialId, model: agent.model.trim() };
  });
  return { totalBudget: config.totalBudget, taskBudget: config.taskBudget, interrupt: config.interrupt, agents };
}
