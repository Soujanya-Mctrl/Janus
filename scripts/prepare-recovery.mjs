// Generate a self-contained static copy before Next starts/builds. No API dependency.
import { build } from '../contracts/node_modules/esbuild/lib/main.js';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = new URL('../frontend/public/recovery/', import.meta.url);
await mkdir(out,{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('../contracts/phase1/browser/main.mjs',import.meta.url))],outfile:fileURLToPath(new URL('recovery.js',out)),bundle:true,platform:'browser',target:'es2022'});
await copyFile(new URL('../contracts/phase1/browser/index.html',import.meta.url),new URL('index.html',out));
console.log('Independent static recovery copy prepared at /recovery/index.html');
