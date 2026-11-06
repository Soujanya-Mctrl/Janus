import { parentPort, workerData } from 'node:worker_threads';

// Deterministic strategy fixture, not an LLM or live market signal.
let index = 0;
parentPort.on('message', message => {
  if (message.type === 'start' || message.type === 'result') {
    if (message.type === 'result') index += 1;
    const step = workerData.steps[index];
    if (!step) { parentPort.postMessage({ type: 'done', epoch: workerData.epoch }); return; }
    parentPort.postMessage({ type: 'proposal', epoch: workerData.epoch, index, proposal: step.proposal });
  }
});
parentPort.postMessage({ type: 'ready', epoch: workerData.epoch });
