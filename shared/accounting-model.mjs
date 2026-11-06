// Independent event-history oracle: balances are derived from allocations and
// terminal operations, rather than reproducing Solidity's aggregate counters.
export function projectLedger(events) {
  const tasks = new Map();
  let deposited = 0n, withdrawn = 0n, excess = 0n;
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const positive = value => { require(typeof value === 'bigint' && value > 0n, 'Invalid amount'); return value; };
  const balances = task => {
    const ops = [...task.operations.values()];
    const reserved = ops.filter(op => op.status === 'reserved').reduce((sum, op) => sum + op.amount, 0n);
    const spent = ops.filter(op => op.status === 'settled').reduce((sum, op) => sum + op.amount, 0n);
    return { reserved, spent, available: task.cap - reserved - spent - task.returned };
  };
  const unallocated = () => deposited - withdrawn - [...tasks.values()].reduce((sum, task) => sum + task.cap - task.returned, 0n);
  for (const event of events) {
    const { type, taskId, operationId, amount } = event;
    if (type === 'deposit') { deposited += positive(amount); continue; }
    if (type === 'donate') { excess += positive(amount); continue; }
    if (type === 'withdraw') { require(positive(amount) <= unallocated(), 'Insufficient reserve'); withdrawn += amount; continue; }
    if (type === 'create') {
      require(!tasks.has(taskId) && positive(amount) <= unallocated(), 'Invalid allocation');
      require(positive(event.limit) <= amount, 'Invalid limit');
      tasks.set(taskId, { cap: amount, returned: 0n, epoch: 1n, cancelled: false, limit: event.limit, operations: new Map() });
      continue;
    }
    const task = tasks.get(taskId);
    require(task, 'Unknown task');
    const current = balances(task);
    if (type === 'assign') { require(!task.cancelled, 'Cancelled task'); task.epoch++; }
    else if (type === 'cancel') { if (!task.cancelled) { task.cancelled = true; task.epoch++; } }
    else if (type === 'release') { require(positive(amount) <= current.available, 'Insufficient available'); task.returned += amount; }
    else if (type === 'reserve') {
      require(!task.cancelled && task.epoch === event.epoch, 'Stale authority');
      require(positive(amount) <= current.available && amount <= task.limit, 'Insufficient task budget');
      const previous = task.operations.get(operationId);
      require(!previous || previous.status === 'expired', 'Operation already committed');
      require(event.attempt === (previous?.attempt ?? 0n) + 1n, 'Invalid attempt');
      require(!previous || previous.amount === amount && previous.fingerprint === event.fingerprint, 'Changed fingerprint');
      task.operations.set(operationId, { amount, attempt: event.attempt, fingerprint: event.fingerprint, status: 'reserved' });
    } else if (type === 'settle' || type === 'expire') {
      const op = task.operations.get(operationId);
      require(op?.status === 'reserved' && op.attempt === event.attempt, 'Invalid terminal transition');
      op.status = type === 'settle' ? 'settled' : 'expired';
    } else throw new Error('Unknown ledger event');
  }
  const projectedTasks = Object.fromEntries([...tasks].map(([id, task]) => [id, {
    cap: task.cap, ...balances(task), returned: task.returned, epoch: task.epoch, cancelled: task.cancelled,
  }]));
  const values = Object.values(projectedTasks);
  const sum = field => values.reduce((total, task) => total + task[field], 0n);
  const accountedBalance = unallocated() + sum('available') + sum('reserved');
  return { tasks: projectedTasks, deposited, totalWithdrawn: withdrawn, unallocated: unallocated(), totalAvailable: sum('available'),
    totalReserved: sum('reserved'), totalSpent: sum('spent'), accountedBalance, tokenBalance: accountedBalance + excess };
}
