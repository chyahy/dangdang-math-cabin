import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const target=process.env.PYTHAGORAS_QA_URL||'http://127.0.0.1:4193/';
const out=fileURLToPath(new URL('../../../outputs/pythagoras/v2/',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[],bad=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url())});
 await page.clock.install();
 await page.goto(target);
 const open=()=>page.locator('.header-actions .open-gallery').click();
 const pick=async n=>{await open();await page.locator('[data-video-proof="'+n+'"]').click();await page.locator('.geometry').waitFor()};
 const progress=async()=>Number(await page.locator('.scene').getAttribute('data-progress'));
 const at=async i=>{await page.locator('.step-list button').nth(i).click();assert.equal(await progress(),i)};
 const shot=(name)=>page.screenshot({path:out+name+'.png'});
 await open();assert.equal(await page.locator('[data-video-proof]').count(),15);await shot('gallery');
 await page.getByRole('checkbox',{name:'显示拓展证明'}).uncheck();assert.equal(await page.locator('[data-video-proof]').count(),12);
 await page.getByRole('checkbox',{name:'显示拓展证明'}).check();await page.getByRole('button',{name:'关闭总览'}).click();
 await page.getByRole('combobox',{name:'动画速度'}).selectOption('2');
 for(let n=1;n<=15;n++){
  await pick(n);assert.equal(await progress(),0);
  await page.getByRole('button',{name:'自动播放',exact:true}).click();
  await page.clock.runFor(400);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const paused=await progress();assert(paused>0&&paused<1,String(paused));
  await page.clock.runFor(500);assert.equal(await progress(),paused);
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.clock.runFor(18_000);
  const steps=await page.locator('.step-list button').count();
  assert.equal(await progress(),steps-1,'full autoplay '+n);
  assert.equal(await page.locator('.formula-ribbon .katex-error').count(),0);
  assert.equal(await page.locator('svg.geometry polygon').evaluateAll(items=>items.some(e=>/NaN|Infinity/.test(e.getAttribute('points')))),false);
  await shot('proof-'+String(n).padStart(2,'0'));
  await page.getByRole('button',{name:'上一演示步骤',exact:true}).click();await page.clock.runFor(4000);
  assert.equal(await progress(),steps-2);
  await page.getByRole('button',{name:'重播',exact:true}).click();assert.equal(await progress(),0);
  console.log('PASS video proof '+n+' pause, resume, full play, rewind, replay');
 }
 await pick(4);await at(9);
 const final=page.locator('[data-proof-piece]');assert.equal(await final.count(),7);
 await final.first().dispatchEvent('click');assert.equal(await page.getByRole('button',{name:'回放此块'}).count(),1);
 await page.getByRole('button',{name:'回放此块'}).click();await page.clock.runFor(2000);
 await page.getByRole('button',{name:'左右对比',exact:true}).click();await shot('seven-trace');
 await page.getByRole('button',{name:'等腰',exact:true}).click();
 assert.equal(await final.count(),4);
 await page.getByRole('button',{name:'恢复原图',exact:true}).click();
 await page.getByRole('button',{name:'逐块拼接',exact:true}).click();await page.clock.runFor(1500);assert.equal(await progress(),3);
 await page.getByRole('button',{name:'全部拼接',exact:true}).click();await page.clock.runFor(600);await page.getByRole('button',{name:'5 · 12 · 13',exact:true}).click();
 const stopped=await progress();assert(Number.isInteger(stopped));await page.clock.runFor(3000);assert.equal(await progress(),stopped);
 await page.getByRole('slider',{name:'演示进度'}).fill('8.5');assert.equal(await progress(),8.5);
 await page.getByRole('button',{name:'隐藏切割线',exact:true}).click();assert.equal(await page.locator('.museum-geometry line[stroke="#f3f6fb"]').count(),0);
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
  await page.setViewportSize(viewport);await open();await shot('gallery-'+viewport.width);
  await page.locator('[data-video-proof="4"]').click();await at(10);await shot('seven-'+viewport.width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log('PASS catalog filters, piece tracing, parameter changes, timeline, cut lines, responsive layouts');
} finally {await browser.close()}
