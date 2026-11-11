import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GAMES} from './catalog.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=path.join(repo,'site');
test('Every catalog item has an existing game, unique cover, and real rendered link',async()=>{
  assert.equal(new Set(GAMES.map(g=>g.id)).size,16);
  assert.equal(new Set(GAMES.map(g=>g.image)).size,16);
  const html=await fs.readFile(path.join(site,'games/index.html'),'utf8');
  for(const game of GAMES){
    await fs.access(path.join(site,game.path,game.path.endsWith('/')?'index.html':''));
    const image=await fs.stat(path.join(site,'portal-assets',game.image));
    assert(image.size>2000 && image.size<200000,game.image+' must be a real optimized cover');
    assert(html.includes('play/?game='+game.id),game.id+' missing playable link');
    assert(html.includes(game.description),game.id+' missing description');
  }
});
test('The chooser never preloads the WebGL cabin or a game',async()=>{
  const html=await fs.readFile(path.join(site,'index.html'),'utf8');
  assert(html.includes('href="cabin.html"'));assert(html.includes('href="games/"'));
  assert(!/<iframe|three\.min\.js|new THREE|<canvas/i.test(html));
  const small=await fs.stat(path.join(site,'index.html'));assert(small.size<10000);
});
test('Original game routes and their return integration remain present',async()=>{
  for(const game of GAMES){
    const html=await fs.readFile(path.join(site,game.path,game.path.endsWith('/')?'index.html':''),'utf8');
    assert.equal((html.match(/data-cabin-return/g)||[]).length,1,game.id+' has duplicated/missing return script');
  }
  const cabin=await fs.readFile(path.join(site,'cabin.html'),'utf8');
  assert(cabin.includes('solid-slice-lab-entrance'));assert(cabin.includes('function sceneRayAction'));
  assert(cabin.includes('href="games/"'));
  const version=JSON.parse(await fs.readFile(path.join(site,'version.json'),'utf8')).version;
  assert(cabin.includes(`const PAGE_VERSION = '${version}'`));
});
test('Catalog categories retain every game exactly once',()=>{
  assert.equal(GAMES.filter(g=>g.category==='numbers').length,8);
  assert.equal(GAMES.filter(g=>g.category==='geometry').length,7);
  assert.equal(GAMES.filter(g=>g.category==='language').length,1);
  assert(GAMES.every(g=>['numbers','geometry','language'].includes(g.category)));
});
