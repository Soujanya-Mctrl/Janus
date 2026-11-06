import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';

const identity = value => createHash('sha256').update(value).digest('hex');
export function createWorkbenchStore(directory, configuredKey = process.env.JANUS_VAULT_KEY) {
  async function masterKey() {
    if (configuredKey) {
      const key = Buffer.from(configuredKey, 'base64');
      if (key.length !== 32) throw new Error('JANUS_VAULT_KEY must encode 32 bytes');
      return key;
    }
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const target = path.join(directory, 'master.key');
    try { await fs.writeFile(target, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const key = await fs.readFile(target);
    if (key.length !== 32) throw new Error('Vault key is unavailable');
    return key;
  }
  const file = user => path.join(directory, identity(user) + '.vault');
  async function load(user) {
    if (typeof user !== 'string' || !user.startsWith('did:privy:')) throw new Error('Verified identity required');
    const key = await masterKey();
    try {
      const envelope = JSON.parse(await fs.readFile(file(user), 'utf8'));
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from(user)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch (error) { if (error.code === 'ENOENT') return { credentials: [], config: null }; throw new Error('Vault could not be decrypted'); }
  }
  async function mutate(user, action) {
    await masterKey();
    const lock = await fs.open(file(user) + '.lock', 'wx', 0o600).catch(error => {
      if (error.code === 'EEXIST') throw new Error('Vault busy; retry after the current update'); throw error;
    });
    try {
      const state = await load(user), result = action(state), key = await masterKey(), iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(user));
      const data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
      const handle = await fs.open(file(user) + '.tmp', 'w', 0o600);
      try { await handle.writeFile(JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(file(user) + '.tmp', file(user)); return result;
    } finally { await lock.close(); await fs.unlink(file(user) + '.lock'); }
  }
  const metadata = ({ id, provider, label, createdAt }) => ({ id, provider, label, createdAt });
  return {
    async list(user) { return (await load(user)).credentials.map(metadata); },
    async saveCredential(user, { provider, label, key }) {
      if (!['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'nvidia'].includes(provider) || typeof label !== 'string' || !label.trim() || label.length > 60
        || typeof key !== 'string' || key.length < 16 || key.length > 4096 || /\s/.test(key)) throw new Error('Enter a provider, label and valid API key');
      return mutate(user, state => {
        if (state.credentials.length >= 12) throw new Error('Credential limit reached');
        const record = { id: randomUUID(), provider, label: label.trim(), key, createdAt: new Date().toISOString() };
        state.credentials.push(record); return metadata(record);
      });
    },
    async removeCredential(user, id) {
      return mutate(user, state => { state.credentials = state.credentials.filter(record => record.id !== id); });
    },
    async credential(user, id) {
      const record = (await load(user)).credentials.find(record => record.id === id);
      if (!record) throw new Error('Credential not found in this account'); return record;
    },
    async config(user) { return (await load(user)).config; },
    async saveConfig(user, config) { return mutate(user, state => { state.config = config; }); },
  };
}
