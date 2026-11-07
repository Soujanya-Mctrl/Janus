import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPrivateJsonStore } from '../lib/private-json.mjs';

const domains = new Set(['research-v1', 'paid-checkpoint-v1', 'merchant-operations-v1']);

// Explicit offline migration/rotation only. Does not delete or reset records.
export async function maintainPrivateState({ directory, domain, apply = false, allowLegacy = false, keyFile }) {
  if (!path.isAbsolute(directory) || !domains.has(domain)) throw new Error('Use an absolute protected directory and a supported domain');
  const root = await fs.realpath(directory), lockPath = path.join(root, '.maintenance.lock');
  const lock = await fs.open(lockPath, 'wx', 0o600).catch(() => { throw new Error('Storage already under maintenance; reconcile before retry'); });
  try {
    const files = [];
    const walk = async dir => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (file === lockPath) continue;
        if (entry.isSymbolicLink()) throw new Error('Symlinks are not supported during private-state maintenance');
        if (entry.name.endsWith('.lock') || entry.name.endsWith('.tmp')) throw new Error('Active or unresolved storage; stop services and reconcile locks/intents first');
        if (entry.isDirectory()) { await walk(file); continue; }
        if (!entry.name.endsWith('.json')) continue;
        const relative = path.relative(root, file).split(path.sep).join('/');
        const supported = domain === 'research-v1'
          ? /^[a-f0-9]{64}\/[a-f0-9-]{36}\/(?:run|control|[a-f0-9]{64}\.intent)\.json$/.test(relative)
          : /^[a-f0-9]{64}\.json$/.test(relative);
        if (!supported) throw new Error('Unexpected JSON record; choose the specific protected storage directory');
        if ((await fs.stat(file)).size > 16 * 1024 * 1024 || files.length >= 5000) throw new Error('Maintenance size bound exceeded; use a reviewed migration');
        files.push(file);
      }
    };
    await walk(root);
    const store = createPrivateJsonStore(root, { domain, keyFile, allowLegacy, production: false, maintenance: true });
    // Authenticate EVERY record before mutating any, including retained keys.
    const values = await Promise.all(files.map(file => store.read(file)));
    if (apply) for (let index = 0; index < files.length; index++) await store.write(files[index], values[index]);
    return { domain, records: files.length, mode: apply ? 'applied' : 'read-only plan', plaintextPermitted: allowLegacy,
      limitations: 'Stop services first. Per-record atomic writes, not a directory transaction. Keep old keys/backups until all domains are migrated. No payloads printed.' };
  } finally { await lock.close(); await fs.unlink(lockPath); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  try {
    console.log(JSON.stringify(await maintainPrivateState({ directory: option('--directory') ?? '', domain: option('--domain'),
      apply: args.includes('--apply'), allowLegacy: args.includes('--allow-legacy'), keyFile: process.env.JANUS_DATA_KEYRING_FILE }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
