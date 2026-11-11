import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const app=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(app,'../..');
const html=await fs.readFile(path.join(app,'index.html'),'utf8');
for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
const target=path.join(repo,'site/juice-fractions');await fs.mkdir(target,{recursive:true});await fs.writeFile(path.join(target,'index.html'),html);
console.log('Built offline-ready juice-fractions/index.html; both scripts parse.');
