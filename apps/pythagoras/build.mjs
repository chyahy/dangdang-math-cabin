import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.dirname(fileURLToPath(import.meta.url));
for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vite/bin/vite.js','build']])execFileSync(process.execPath,args,{cwd:app,stdio:'inherit'});
await fs.copyFile(path.join(app,'cover.svg'),path.join(app,'../../site/portal-assets/game-pythagoras.svg'));
console.log('Built Pythagoras classroom and gallery cover.');
