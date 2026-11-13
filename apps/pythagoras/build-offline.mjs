import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(app,'../../site/pythagoras'),out=path.resolve(app,'../../outputs/pythagoras');
await fs.mkdir(out,{recursive:true});
const mime={'.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.webp':'image/webp'};
const data=async filename=>`data:${mime[path.extname(filename)]||'application/octet-stream'};base64,${(await fs.readFile(filename)).toString('base64')}`;
let html=await fs.readFile(path.join(dist,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for(const match of scripts){let js=await fs.readFile(path.join(dist,match[1]),'utf8');for(const file of await fs.readdir(path.join(dist,'assets'))){if(/\.(woff2?|ttf|webp)$/.test(file))js=js.replaceAll(file,await data(path.join(dist,'assets',file)))}js=js.replaceAll('../cabin.html','https://dangdanglaoshi.cn/cabin.html').replaceAll('../games/','https://dangdanglaoshi.cn/games/');html=html.replace(match[0],()=>`<script type="module">${js.replaceAll('</script','<\\/script')}</script>`)}
for(const match of [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]){let css=await fs.readFile(path.join(dist,match[1]),'utf8');for(const item of [...css.matchAll(/url\(([^)]+)\)/g)]){const relative=item[1].replaceAll('"','').replaceAll("'",'');if(!relative.startsWith('data:'))css=css.replace(item[0],`url(${await data(path.resolve(dist,'assets',relative))})`)}html=html.replace(match[0],()=>`<style>${css}</style>`)}
html=html.replace(/<script[^>]*data-cabin-return[^>]*><\/script>/g,'');
const file=path.join(out,'勾股定理-课堂演示-离线版.html');await fs.writeFile(file,html);console.log(`Offline HTML: ${file}`);
