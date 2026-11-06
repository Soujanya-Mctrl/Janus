import fs from 'node:fs';
import path from 'node:path';
export function acquireSignerLock(directory, address) {
 if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid signer address');
 fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
 const target = path.join(directory, `signer-${address.toLowerCase()}.lock`);
 let fd;
 try { fd = fs.openSync(target, 'wx', 0o600); }
 catch (error) { if (error.code === 'EEXIST') throw new Error('Signer already locked; reconcile any crashed signer before removing its lock'); throw error; }
 try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, address, startedAt: new Date().toISOString() })); fs.fsyncSync(fd); }
 catch (error) { fs.closeSync(fd); fs.unlinkSync(target); throw error; }
 let released = false;
 return () => {
  if (released) return; released = true;
  try { const a = fs.fstatSync(fd), b = fs.statSync(target); if (a.ino === b.ino && a.dev === b.dev) fs.unlinkSync(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  finally { fs.closeSync(fd); }
 };
}
