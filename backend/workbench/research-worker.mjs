// Worker processes have no credentials, signer, vault path or arbitrary execution tools.
let heartbeat;
process.on('message', message => {
  if (message.type === 'start') {
    heartbeat = setInterval(() => process.send?.({ type: 'heartbeat' }), 1000);
    process.send?.({ type: 'request' });
  }
  if (message.type === 'result') { clearInterval(heartbeat); process.send?.({ type: 'complete' }); }
  if (message.type === 'stop') { clearInterval(heartbeat); process.exit(0); }
});
process.on('disconnect', () => process.exit(0));
