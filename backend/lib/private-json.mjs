import fs from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

export function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32 || Buffer.from(value, 'base64').toString('base64') !== value) throw new Error('Encryption key must be canonical base64 encoding of 32 bytes');
  return Buffer.from(value, 'base64');
}

export async function syncDirectory(directory) {
  // Windows does not support fsync on a directory handle. File fsync still
  // precedes rename; do not claim Unix directory-entry durability on Windows.
  if (process.platform === 'win32') return;
  const handle = await fs.open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

// Publish a complete development key atomically; concurrent first writers never
// observe an empty/partially written key. Production never generates local keys.
export async function developmentKey(file) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try { return await fs.readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = file + '.' + randomUUID() + '.tmp';
  const handle = await fs.open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(randomBytes(32)); await handle.sync(); await handle.close();
    try { await fs.link(temp, file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { await handle.close().catch(() => {}); await fs.unlink(temp); }
  return fs.readFile(file);
}

export async function externalSecret(file, directory) {
  if (!path.isAbsolute(file)) throw new Error('Secret file must use an absolute path');
  const [secret, state] = await Promise.all([fs.realpath(file), fs.realpath(directory)]);
  const relative = path.relative(state, secret);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Secret file must be outside the protected state directory');
  return (await fs.readFile(secret, 'utf8')).trim();
}

// Host-side encryption, not end-to-end privacy. Bind ciphertext to its domain
// and account/task-relative filename so copying it to another record fails.
export function createPrivateJsonStore(directory, {
  domain, keyring, keyFile = process.env.JANUS_DATA_KEYRING_FILE,
  production = process.env.NODE_ENV === 'production',
  allowLegacy = process.env.JANUS_ALLOW_LEGACY_PLAINTEXT === '1',
  maintenance = false,
} = {}) {
  if (!domain) throw new Error('Private storage domain required');
  const root = path.resolve(directory);
  const relative = file => {
    const value = path.relative(root, path.resolve(file));
    if (!value || value === '..' || value.startsWith('..' + path.sep) || path.isAbsolute(value)) throw new Error('Private record must be inside its storage root');
    return value.split(path.sep).join('/');
  };
  const keys = async () => {
    let config = keyring;
    if (!config && keyFile) {
      // A missing key file is NOT a missing operation. Callers use ENOENT only
      // for absent state; never let key loss reset their payment/checkpoint state.
      let serialized;
      try { serialized = await externalSecret(keyFile, root); }
      catch (error) { throw new Error(error.code === 'ENOENT' ? 'Data keyring unavailable; key unavailable; restore it before retrying' : 'Data keyring unavailable; use an absolute secret path outside the protected state directory'); }
      try { config = JSON.parse(serialized); } catch { throw new Error('Data keyring contains invalid JSON; restore it before retrying'); }
    }
    if (!config) {
      if (production) throw new Error('Production requires an external JANUS_DATA_KEYRING_FILE');
      const key = await developmentKey(path.join(root, '.private-key'));
      if (key.length !== 32) throw new Error('Development encryption key unavailable');
      config = { active: 'development', keys: { development: key.toString('base64') } };
    }
    if (!config || typeof config.active !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(config.active) || !Object.hasOwn(config.keys ?? {}, config.active)) throw new Error('Invalid data keyring');
    const entries = Object.entries(config.keys);
    if (!entries.length || entries.length > 16) throw new Error('Invalid data keyring size');
    return { active: config.active, keys: new Map(entries.map(([id, value]) => [id, decodeKey(value)])) };
  };
  const aad = file => Buffer.from(JSON.stringify(['janus-private-json', 1, domain, relative(file)]));
  const available = async () => {
    if (maintenance) return;
    try { await fs.access(path.join(root, '.maintenance.lock')); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('Private storage maintenance in progress; stop and reconcile before retrying');
  };
  return {
    async read(file) {
      await available();
      const context = aad(file), ring = await keys();
      const raw = await fs.readFile(file, 'utf8');
      let envelope;
      try { envelope = JSON.parse(raw); } catch { throw new Error('Private record contains invalid JSON; reconcile before retrying'); }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Invalid private record envelope');
      if (envelope.format !== 'janus-private-json') {
        if (!production && allowLegacy) return envelope;
        throw new Error('Plaintext private record requires explicit offline migration');
      }
      try {
        const key = ring.keys.get(envelope.keyId);
        if (envelope.version !== 1 || !key) throw new Error('Unsupported encryption identity');
        const iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
        if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid encryption envelope');
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(context); decipher.setAuthTag(tag);
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
      } catch { throw new Error('Private record authentication failed; restore its key and reconcile before retrying'); }
    },
    async write(file, value) {
      await available();
      const context = aad(file);
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const ring = await keys(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', ring.keys.get(ring.active), iv);
      cipher.setAAD(context);
      const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      const envelope = { format: 'janus-private-json', version: 1, keyId: ring.active, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
      const temp = file + '.' + randomUUID() + '.tmp';
      const handle = await fs.open(temp, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(envelope) + '\n'); await handle.sync(); }
      finally { await handle.close(); }
      try { await fs.rename(temp, file); await syncDirectory(path.dirname(file)); } finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    },
  };
}
