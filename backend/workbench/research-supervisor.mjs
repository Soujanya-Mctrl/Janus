import { loadRuntimeDeployment } from '../lib/runtime-deployment.mjs';
import { sameDeployment } from '../../shared/runtime-deployment.mjs';
import { readRun, executeResearch } from './research.mjs';
import { createRunPaidTools } from './paid-runtime.mjs';
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw new Error('Invalid supervisor input'); }
const options = JSON.parse(input);
const { deployment } = await loadRuntimeDeployment({ verify: Boolean(process.env.JANUS_DEPLOYMENT_FILE) });
const run = await readRun(options.root, options.user, options.id);
if (run.deployment && !sameDeployment(run.deployment, deployment)) throw new Error('Run deployment changed; reconcile before resuming');
await executeResearch({ ...options, paidToolsFactory: createRunPaidTools });
