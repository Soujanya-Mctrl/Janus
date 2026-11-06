import { listArkivWorkers } from '../src/lib/arkiv-directory.ts';
console.log(JSON.stringify(await listArkivWorkers(), null, 2));
