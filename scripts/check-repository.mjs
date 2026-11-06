import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root })
  .toString().split('\0').filter(Boolean);
const failures = [];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) continue;
  if (path.basename(file).startsWith('._')) failures.push(`${file}: macOS metadata must not be committed`);
  if (!/\.(?:json|mjs|[cm]?tsx?|sol|md|ya?ml)$/.test(file) && file !== '.gitignore') continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (/^(?:<{7} |={7}$|>{7} )/m.test(content)) failures.push(`${file}: unresolved merge marker`);
  if (file.endsWith('.json')) {
    try { JSON.parse(content); }
    catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  // Archived dossiers intentionally describe old layouts; validate current module docs.
  if (/^(?:README\.md|shared\/.*\.md|(?:frontend|backend|contracts)\/README\.md|backend\/hedera\/README\.md|contracts\/phase[01]\/README\.md)$/.test(file)) {
    for (const [, target] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const relative = decodeURIComponent(target.split('#')[0]);
      if (!fs.existsSync(path.resolve(root, path.dirname(file), relative))) {
        failures.push(`${file}: broken local documentation link ${target}`);
      }
    }
  }
}

for (const module of ['', 'frontend/', 'backend/', 'contracts/']) {
  try {
    const manifest = readJson(`${module}package.json`);
    const lock = readJson(`${module}package-lock.json`);
    assert.equal(lock.name, manifest.name, 'lockfile package name differs');
    assert.equal(lock.version, manifest.version, 'lockfile version differs');
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      assert.deepEqual(lock.packages[''][field] ?? {}, manifest[field] ?? {}, `lockfile ${field} differ`);
    }
    if (!module) {
      assert.equal(Object.keys(lock.packages).length, 1, 'root is orchestration only; install dependencies in their module');
    }
  } catch (error) { failures.push(`${module || 'root/'}: ${error.message}`); }
}

// Parse executable JavaScript without importing it: live scripts must never run in checks.
for (const file of files.filter(file => /^(?:scripts|backend|contracts)\/.*\.mjs$/.test(file))) {
  try { execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); }
  catch (error) { failures.push(`${file}: ${error.stderr?.toString() || error.message}`); }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Repository structure, lockfiles, documentation links, merge markers and JavaScript syntax passed.');
}
