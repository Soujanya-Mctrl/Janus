// Compatibility entry point; the independent query belongs to the backend SDK client.
process.env.ARKIV_ACCESS_KEY ??= process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY ?? '';
await import('../../backend/arkiv/cli.mjs');
