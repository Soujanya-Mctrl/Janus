import spec from './arkiv-worker.json' with { type: 'json' };

// Deliberate public projection. Never spread agent configuration or a private
// checkpoint into an entity. Caller-supplied labels are themselves public.
export function publicWorkerProfile({ worker, network, name = 'Research worker', now = BigInt(Math.floor(Date.now() / 1000)) }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(worker ?? '') || /^0x0{40}$/.test(worker)
    || !/^eip155:[1-9][0-9]*$/.test(network ?? '') || typeof name !== 'string' || !name.trim() || name.length > 50
    || typeof now !== 'bigint' || now < 0n || now + BigInt(spec.leaseSeconds) > (1n << 64n) - 1n) throw new Error('Invalid public worker profile');
  return { worker, role: spec.role, status: 'ready', capabilities: spec.capability, network, scheme: spec.scheme,
    validUntil: (now + BigInt(spec.leaseSeconds)).toString(), name: name.trim() };
}
