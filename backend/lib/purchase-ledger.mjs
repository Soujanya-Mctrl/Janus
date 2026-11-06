import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export class PurchaseConflict extends Error {}

// One durable row per logical purchase. SQLite enforces uniqueness across
// processes; all network work happens after the short SQL transactions finish.
export class PurchaseLedger {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS purchases (
        key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, request TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('intent','pending','paid','ready')),
        transaction_id TEXT, receipt TEXT, result TEXT, digest TEXT
      )`);
  }
  get(key) { return this.db.prepare('SELECT * FROM purchases WHERE key=?').get(key) ?? null; }
  prepare(key, fingerprint, request) {
    this.db.prepare("INSERT OR IGNORE INTO purchases(key,fingerprint,request,state) VALUES(?,?,?,'intent')").run(key, fingerprint, request);
    const row = this.get(key);
    if (row.fingerprint !== fingerprint || row.request !== request) throw new PurchaseConflict('Operation identity is bound to a different request');
    return row;
  }
  claim(key) {
    // Only the winner may submit a settlement. A crashed claim is reconciled
    // against the chain, never reset to unpaid based on a timeout.
    return this.db.prepare("UPDATE purchases SET state='pending' WHERE key=? AND state='intent'").run(key).changes === 1;
  }
  submitted(key, transactionId) {
    const row = this.get(key);
    if (!row || row.state !== 'pending' || (row.transaction_id && row.transaction_id !== transactionId)) throw new PurchaseConflict('Unexpected settlement transaction');
    this.db.prepare('UPDATE purchases SET transaction_id=? WHERE key=?').run(transactionId, key);
  }
  paid(key, receipt) {
    const row = this.get(key);
    if (!row) throw new PurchaseConflict('Missing durable purchase intent');
    if (row.state === 'ready' || row.state === 'paid') return row;
    if (row.state !== 'pending') throw new PurchaseConflict('Settlement intent was not recorded');
    this.db.prepare("UPDATE purchases SET state='paid',receipt=? WHERE key=? AND state='pending'").run(JSON.stringify(receipt), key);
    return this.get(key);
  }
  result(key, result) {
    const encoded = JSON.stringify(result);
    const digest = createHash('sha256').update(encoded).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.get(key);
      if (!row || !['paid', 'ready'].includes(row.state)) throw new PurchaseConflict('A confirmed payment is required');
      if (row.state === 'ready' && (row.result !== encoded || row.digest !== digest)) throw new PurchaseConflict('Stored result is immutable');
      this.db.prepare("UPDATE purchases SET state='ready',result=?,digest=? WHERE key=? AND state='paid'").run(encoded, digest, key);
      this.db.exec('COMMIT');
      return this.get(key);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
