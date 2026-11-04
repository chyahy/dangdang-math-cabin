import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {GAMES} from './catalog.mjs';
const app=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(app,'../..'),site=path.join(repo,'site'),assets=path.join(site,'portal-assets');
const version=JSON.parse(await fs.readFile(path.join(site,'version.json'),'utf8')).version;
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const cards=GAMES.map((game,index)=>`<article class="game-card" data-category="${game.category}" data-game="${game.id}"><a href="play/?game=${game.id}" aria-label="开始${escape(game.title)}"><div class="game-picture"><img src="portal-assets/${game.image}" alt="${escape(game.title)}的数学实验封面" width="960" height="600" loading="${index<3?'eager':'lazy'}" decoding="async"></div><h2>${escape(game.title)}</h2><p>${escape(game.description)}</p><span class="game-go">开始探索<img class="icon" src="portal-assets/arrow-right.svg" alt="" width="17" height="17"></span></a></article>`).join('\n');
for(const [input,output] of [['entry.html','index.html'],['games.html','games/index.html'],['play.html','play/index.html']]){
  let html=await fs.readFile(path.join(app,input),'utf8');html=html.replace('<!--GAME_CARDS-->',cards).replaceAll('2026.11.01.3',version);
  await fs.mkdir(path.dirname(path.join(site,output)),{recursive:true});await fs.writeFile(path.join(site,output),html);
}
await fs.mkdir(assets,{recursive:true});
for(const file of ['portal.css','game-return.js'])await fs.copyFile(path.join(app,file),path.join(assets,file));
await fs.copyFile(path.join(app,'catalog.mjs'),path.join(assets,'catalog.js'));
await fs.writeFile(path.join(assets,'portal.js'),(await fs.readFile(path.join(app,'portal.mjs'),'utf8')).replace("'./catalog.mjs'",`'./catalog.js?v=${version}'`));
const gamePaths=GAMES.map(game=>game.path.endsWith('/')?game.path+'index.html':game.path);
// Keep this idempotent and run after rebuilding any individual game.
for(const relative of [...new Set([...gamePaths,'sum-difference-multiple/index.html','homework/index.html'])]){
  const filename=path.join(site,relative);let html=await fs.readFile(filename,'utf8');
  const relativeScript=path.relative(path.dirname(filename),path.join(assets,'game-return.js')).split(path.sep).join('/');
  // free/ has an existing base href="../"; document-relative script URLs must respect it.
  const scriptPath=relative==='sum-difference-multiple/free/index.html'?'../portal-assets/game-return.js':relativeScript;
  const tag=`<script src="${scriptPath}?v=${version}" data-cabin-return defer></script>`;
  const next=html.includes('data-cabin-return')?html.replace(/<script[^>]*data-cabin-return[^>]*><\/script>/,tag):html.replace('</head>',tag+'\n</head>');
  if(next!==html)await fs.writeFile(filename,next);
}
const missing=[];
for(const file of ['cabin-night.webp','math-island.webp','night-sky.webp','brand.webp','teacher.webp','galaxy-background-v1.mp4',...GAMES.map(game=>game.image)])try{await fs.access(path.join(assets,file))}catch{missing.push(file)}
if(missing.length)throw new Error('Missing portal image assets: '+missing.join(', '));
const cabin=await fs.readFile(path.join(site,'cabin.html'),'utf8');for(const match of cabin.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
if(!cabin.includes(`const PAGE_VERSION = '${version}'`))throw new Error('Cabin version mismatch');
console.log(`Built entry, ${GAMES.length}-game gallery and player. All images exist; cabin scripts parse; return links are installed.`);
