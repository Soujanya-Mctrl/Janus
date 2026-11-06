import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const out = new URL('../artifacts/recovery-browser/', import.meta.url);
await mkdir(out, { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('../browser/main.mjs', import.meta.url))], outfile: fileURLToPath(new URL('recovery.js', out)), bundle: true, platform: 'browser', target: 'es2022' });
await copyFile(new URL('../browser/index.html', import.meta.url), new URL('index.html', out));
console.log('Static recovery site: contracts/phase1/artifacts/recovery-browser/');
