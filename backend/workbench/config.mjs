export const defaultAgents = [
  { id: 'orchestrator', name: 'Orchestrator', responsibility: 'Coordinate research, reuse paid sources and recover interrupted workers.', credentialId: '', model: '' },
  { id: 'alpha', name: 'Alpha', responsibility: 'Gather sources and preserve paid research artifacts.', credentialId: '', model: '' },
  { id: 'beta', name: 'Beta', responsibility: 'Resume unfinished research using the existing task checkpoint.', credentialId: '', model: '' },
  { id: 'gamma', name: 'Gamma', responsibility: 'Review evidence and assemble the research report.', credentialId: '', model: '' },
];
export const defaultConfig = { workflow: 'research-v1', agents: defaultAgents };
export function validateWorkbenchConfig(config) {
  if (config?.workflow !== 'research-v1' || !Array.isArray(config.agents) || config.agents.length !== 4) throw new Error('Configure the research workflow with one coordinator and three workers');
  const agents = config.agents.map((agent, index) => {
    if (agent.id !== defaultAgents[index].id || typeof agent.name !== 'string' || !agent.name.trim() || agent.name.length > 50
      || typeof agent.responsibility !== 'string' || !agent.responsibility.trim() || agent.responsibility.length > 1500
      || typeof agent.credentialId !== 'string' || !/^(|[a-f0-9-]{36})$/.test(agent.credentialId)
      || typeof agent.model !== 'string' || agent.model.length > 100) throw new Error('Invalid agent configuration');
    return { id: agent.id, name: agent.name.trim(), responsibility: agent.responsibility.trim(), credentialId: agent.credentialId, model: agent.model.trim() };
  });
  return { workflow: 'research-v1', agents };
}
