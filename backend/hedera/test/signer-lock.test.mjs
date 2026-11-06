import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { acquireSignerLock } from '../lib/signer-lock.mjs';
test('signer lock prevents duplicate writers and releases idempotently', t => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-signer-'));
 t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
 const address = '0x' + '11'.repeat(20);
 const release = acquireSignerLock(directory, address);
 assert.throws(() => acquireSignerLock(directory, address), /already locked/);
 release(); release();
 const again = acquireSignerLock(directory, address); again();
});
