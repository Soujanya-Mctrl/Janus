import { executeResearch } from './research.mjs';
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw new Error('Invalid supervisor input'); }
const options = JSON.parse(input);
await executeResearch(options);
