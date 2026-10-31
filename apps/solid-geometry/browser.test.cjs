const {chromium,expect}=require('../geometry-board/node_modules/@playwright/test');
const path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url');
(async()=>{
const browser=await chromium.launch({headless:true});
try{
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1050},reducedMotion:'reduce',acceptDownloads:true});
const page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
// Capture real geometry only inside the test browser; production has no test-only APIs.
await page.addInitScript(()=>{Object.defineProperty(window,'SolidNets',{configurable:true,set(value){
 const original=value.unfold;value.unfold=function(model,amount,topology){const result=original(model,amount,topology);window.qaModel=model;window.qaNet=result;window.qaAmount=amount;return result};
 const originalCurved=value.curvedUnfold;value.curvedUnfold=function(...args){const result=originalCurved(...args);window.qaCurved=result;return result};
 Object.defineProperty(window,'SolidNets',{value,writable:true,configurable:true});
}})});
const url=pathToFileURL(path.resolve(__dirname,'../../site/solid-geometry/index.html')).href;
await page.goto(url);await expect(page.locator('#shapeTitle')).toHaveText('正方体');
await expect(page.locator('.net-choice')).toHaveCount(11);
await page.locator('#toggleNet').click();await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','1.0000');
await expect(page.locator('[data-net-face]')).toHaveCount(6);await expect(page.locator('[data-fold-line]')).toHaveCount(5);
// All faces retain area and meet the same plane. Adjacent hinge endpoints stay connected.
async function verifyGeometry(){await expect.poll(()=>page.evaluate(()=>window.qaAmount)).toBe(1);return page.evaluate(()=>{
 const {qaModel:m,qaNet:n,SolidNets:N}=window;
 const fail=[];
 for(const f of n.faces){const a=N.polygonArea(f.points),b=N.polygonArea(m.faces[f.id].map(i=>m.vertices[i]));if(Math.abs(a-b)>1e-7)fail.push('area '+f.id)}
 const y=m.vertices[m.faces[n.rootFace][0]][1];
 if(n.faces.some(f=>f.points.some(p=>Math.abs(p[1]-y)>1e-7)))fail.push('not planar');
 for(const h of n.hinges){for(const p of [h.a,h.b])for(const i of [h.face,h.parent])if(!n.faces[i].points.some(v=>Math.hypot(...N.sub(p,v))<1e-7))fail.push('broken hinge')}
 // Strict convex polygon intersection. Shared boundaries have zero area.
 function intersect(a,b){let out=a.map(p=>[p[0],p[2]]),clip=b.map(p=>[p[0],p[2]]);let signed=clip.reduce((s,p,i)=>s+p[0]*clip[(i+1)%clip.length][1]-p[1]*clip[(i+1)%clip.length][0],0);if(signed<0)clip.reverse();
 for(let k=0;k<clip.length;k++){const A=clip[k],B=clip[(k+1)%clip.length],input=out;out=[];const side=p=>(B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]);for(let i=0;i<input.length;i++){const P=input[i],Q=input[(i+1)%input.length],u=side(P),v=side(Q);if(u>=-1e-9)out.push(P);if((u>1e-9&&v< -1e-9)||(u< -1e-9&&v>1e-9)){const t=u/(u-v);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t])}}}
 return Math.abs(out.reduce((s,p,i)=>s+p[0]*out[(i+1)%out.length][1]-p[1]*out[(i+1)%out.length][0],0))/2;
 }
 for(let i=0;i<n.faces.length;i++)for(let j=i+1;j<n.faces.length;j++)if(intersect(n.faces[i].points,n.faces[j].points)>1e-6)fail.push('overlap '+i+','+j);
 return fail;
})}
if((await verifyGeometry()).length)throw Error((await verifyGeometry()).join(', '));
await page.locator('#cubeNetGallery summary').click();
// The four standard families have 6, 3, 1 and 1 genuinely different nets.
for(const [type,count] of [['1-4-1',6],['2-3-1',3],['2-2-2',1],['3-3',1]]){
 await page.locator(`[data-net-type="${type}"]`).click();await expect(page.locator('.net-choice')).toHaveCount(count);
 expect(await page.locator('.net-choice').evaluateAll((buttons,type)=>buttons.every(b=>b.dataset.group===type),type)).toBeTruthy();
 const rowCounts=await page.locator('.net-choice svg').evaluateAll(svgs=>svgs.map(svg=>{const rows=new Map();svg.querySelectorAll('polygon').forEach(p=>{const points=[...p.points],cy=points.reduce((s,q)=>s+q.y,0)/points.length,key=cy.toFixed(5);rows.set(key,(rows.get(key)||0)+1)});return [...rows].sort((a,b)=>Number(a[0])-Number(b[0])).map(r=>r[1]).join('-')}));
 expect(rowCounts.every(rows=>rows===type)).toBeTruthy();
}
await page.locator('[data-net-type="all"]').click();
for(let i=0;i<11;i++){await page.locator(`[data-net="${i}"]`).click();await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','1.0000');const fail=await verifyGeometry();if(fail.length)throw Error('cube net '+i+': '+fail.join(','))}
// Partial unfolding must preserve every face area too.
await page.locator('#netAmount').fill('48');
await expect.poll(()=>page.evaluate(()=>window.qaAmount)).toBe(.48);
const partial=await page.evaluate(()=>window.qaNet.faces.every(f=>Math.abs(SolidNets.polygonArea(f.points)-SolidNets.polygonArea(window.qaModel.faces[f.id].map(i=>window.qaModel.vertices[i])))<1e-7));
if(!partial)throw Error('Partial unfold changes face area');
// Size inputs and the net share the same model.
await page.locator('#num-a').fill('4');await page.locator('#num-a').press('Enter');
await expect(page.locator('#volumeResult')).toContainText('64.00');await expect(page.locator('#surfaceResult')).toContainText('96.00');
await page.locator('#netAmount').fill('100');if((await verifyGeometry()).length)throw Error('Resized net invalid');
// Face switches affect both solid and net without changing the actual surface area.
const areaBefore=await page.locator('#surfaceResult').textContent();
await page.locator('#faceOptions input').nth(0).uncheck();await expect(page.locator('[data-net-face]')).toHaveCount(5);
await page.locator('#hideAllFaces').click();await expect(page.locator('[data-net-face]')).toHaveCount(0);
await expect(page.locator('#surfaceResult')).toHaveText(areaBefore);
await page.locator('#faceOptions input').nth(0).check();await expect(page.locator('[data-net-face]')).toHaveCount(1);
await page.locator('#toggleNet').click();await expect(page.locator('[data-solid-face]')).toHaveCount(1);
await page.locator('#showAllFaces').click();await expect(page.locator('#faceOptions input:checked')).toHaveCount(6);
for(const id of ['showLength','showWidth','showHeight'])await page.locator('#'+id).check();
await expect(page.locator('[data-dimension]')).toHaveCount(3);await page.locator('#showWidth').uncheck();await expect(page.locator('[data-dimension]')).toHaveCount(2);await page.locator('#showWidth').check();
// Click rendered geometry in screen coordinates, including after zooming.
async function vertexPoint(p,id){await p.locator('#scene').scrollIntoViewIfNeeded();await p.waitForTimeout(80);return p.locator(`[data-pick-vertex="${id}"]`).first().evaluate(e=>{const p=new DOMPoint(Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y}})}
async function clickVertex(p,id){const q=await vertexPoint(p,id);await p.mouse.click(q.x,q.y)}
await clickVertex(page,0);await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','3');
await expect.poll(()=>page.locator('[data-highlight-edge]').evaluateAll(a=>new Set(a.map(e=>e.dataset.highlightEdge)).size)).toBe(3);
await page.locator('#clearSelection').click();
const a=await vertexPoint(page,0),b=await vertexPoint(page,1);await page.mouse.click((a.x+b.x)/2,(a.y+b.y)/2);
await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','4');await expect(page.locator('#selectionStatus')).toContainText('长方向');
for(const axis of [0,2,1]){await page.locator('#edgeSelect').selectOption('axis-'+axis);await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','4')}
await page.locator('#zoomIn').click();await clickVertex(page,6);await expect(page.locator('#vertexSelect')).toHaveValue('6');await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','3');
await page.locator('#clearSelection').click();const stage=await page.locator('#scene').boundingBox();await page.mouse.move(stage.x+stage.width*.5,stage.y+stage.height*.4);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.5+70,stage.y+stage.height*.4+30,{steps:8});await page.mouse.up();await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','0');
for(const shape of ['cuboid','frustum','triprism','hexprism','pyramid','tetra']){
 await page.locator(`[data-shape="${shape}"]`).click();await page.locator('#toggleNet').click();
 await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','1.0000');const fail=await verifyGeometry();if(fail.length)throw Error(shape+': '+fail.join(','));
 if(shape==='cuboid'){
  await expect(page.locator('.net-choice')).toHaveCount(11);
  for(const sizes of [[4,2.4,3],[5,1,5],[2,4,1]]){
   for(const [j,key] of ['a','b','h'].entries()){await page.locator('#num-'+key).fill(String(sizes[j]));await page.locator('#num-'+key).press('Enter')}
   for(let i=0;i<11;i++){await page.locator(`[data-net="${i}"]`).click();const fail=await verifyGeometry();if(fail.length)throw Error('cuboid '+sizes+' net '+i+': '+fail.join(','))}
   await page.locator('#edgeSelect').selectOption('axis-0');await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count','4');
  }
  await expect(page.locator('#observations')).toContainText('长 = 2');await expect(page.locator('#observations')).toContainText('宽 = 4');await expect(page.locator('#observations')).toContainText('高 = 1');
  for(const [key,value] of [['a',4],['b',2.4],['h',3]]){await page.locator('#num-'+key).fill(String(value));await page.locator('#num-'+key).press('Enter')}
  await page.locator('#toggleNet').click();await page.locator('[data-view="front"]').click();await expect(page.locator('[data-dimension]')).toHaveCount(3);
  await page.locator('[data-view="space"]').click();await page.locator('#vertexSelect').selectOption('0');await page.locator('#faceOptions label').filter({hasText:'上面'}).locator('input').uncheck();
  await page.locator('#vertexSelect').scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(__dirname,'../../.edgeone/solid-geometry-qa/desktop-observe.png'),fullPage:true});
 }
}
const names={3:'三',4:'四',5:'五',6:'六',7:'七',8:'八',9:'九',10:'十',11:'十一',12:'十二'};
for(const shape of ['triprism','pyramid']){
 await page.locator(`[data-shape="${shape}"]`).click();await expect(page.locator('#familyPicker')).toBeVisible();
 for(let n=3;n<=12;n++){
  await page.locator('#sideCount').selectOption(String(n));await expect(page.locator('#shapeTitle')).toHaveText(names[n]+'棱'+(shape==='pyramid'?'锥':'柱'));
  expect(await page.locator('.fact b').allTextContents()).toEqual((shape==='pyramid'?[n+1,2*n,n+1]:[2*n,3*n,n+2]).map(String));
  await expect(page.locator('#faceOptions input')).toHaveCount(shape==='pyramid'?n+1:n+2);
  await page.locator('#toggleNet').click();const failure=await verifyGeometry();if(failure.length)throw Error(shape+' '+n+': '+failure.join(','));
  const a=Number(await page.locator('#num-a').inputValue()),h=Number(await page.locator('#num-h').inputValue()),volume=n*a*a/(4*Math.tan(Math.PI/n))*h/(shape==='pyramid'?3:1);await expect(page.locator('#volumeResult')).toContainText(volume.toFixed(2));
  await page.locator('#vertexSelect').selectOption(String(shape==='pyramid'?n:0));await expect(page.locator('#scene')).toHaveAttribute('data-highlight-count',String(shape==='pyramid'?n:3));
 }
}
const qaDir=path.resolve(__dirname,'../../.edgeone/solid-geometry-qa');
await fs.mkdir(qaDir,{recursive:true});
for(const shape of ['cylinder','cone']){
 await page.locator(`[data-shape="${shape}"]`).click();await expect(page.locator('#familyPicker')).toBeHidden();await expect(page.locator('#netSliderRow')).toBeVisible();
 await page.locator('#netAmount').scrollIntoViewIfNeeded();const track=await page.locator('#netAmount').boundingBox();await page.mouse.move(track.x+8,track.y+track.height/2);await page.mouse.down();await page.mouse.move(track.x+track.width*.65,track.y+track.height/2,{steps:6});await page.mouse.up();
 await expect.poll(()=>page.locator('#netAmount').inputValue()).toMatch(/^(5[5-9]|6\d|7[0-5])$/);
 let previous='';for(const amount of [25,50,75,100]){
  await page.locator('#netAmount').fill(String(amount));await expect(page.locator('#scene')).toHaveAttribute('data-net-amount',(amount/100).toFixed(4));await expect(page.locator('#scene')).toHaveAttribute('data-curved-amount',(amount/100).toFixed(4));
  const image=await page.locator('#surfaces').innerHTML();expect(image).not.toBe(previous);previous=image;
  expect(await page.evaluate(()=>qaCurved.faces.every(f=>f.points.every(p=>p.every(Number.isFinite))))).toBeTruthy();
  if(amount===50||amount===100){await page.locator('#scene').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qaDir,shape+'-'+amount+'.png'),fullPage:true})}
 }
 await expect(page.locator('[data-net-face]')).toHaveCount(shape==='cylinder'?3:2);await expect(page.locator('#netNote')).toContainText(shape==='cylinder'?'长方形':'扇形');
 await page.locator('#netAmount').fill('0');await expect(page.locator('#scene')).toHaveAttribute('data-curved-amount','0.0000');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#toggleNet').click();await expect.poll(()=>page.evaluate(()=>{const t=Number(document.getElementById('scene').dataset.curvedAmount);return t>0&&t<1})).toBeTruthy();
 await page.locator('#netAmount').fill('37');await page.waitForTimeout(180);await expect(page.locator('#scene')).toHaveAttribute('data-curved-amount','0.3700');
 await page.locator('#toggleNet').click();await expect(page.locator('#scene')).toHaveAttribute('data-curved-amount','0.0000',{timeout:5000});await page.emulateMedia({reducedMotion:'reduce'});
}
await page.locator('[data-shape=sphere]').click();await expect(page.locator('#toggleNet')).toBeDisabled();await expect(page.locator('#netNote')).toContainText('没有完整、无变形');
await page.locator('[data-shape=cube]').click();await page.locator('#toggleNet').click();
const dir=path.resolve(__dirname,'../../.edgeone/solid-geometry-qa');await fs.mkdir(dir,{recursive:true});
await page.screenshot({path:path.join(dir,'desktop-net.png'),fullPage:true});
const downloadPromise=page.waitForEvent('download');await page.locator('#exportPNG').click();const download=await downloadPromise;await download.saveAs(path.join(dir,'net.png'));const bytes=await fs.readFile(path.join(dir,'net.png'));if(bytes.readUInt32BE(0)!==0x89504e47)throw Error('Invalid PNG');
await page.locator('#toggleNet').click();await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','0.0000');
// A full animation reaches both endpoints without leaving stale faces.
await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#toggleNet').click();await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','1.0000',{timeout:5000});
await page.locator('#toggleNet').click();await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','0.0000',{timeout:5000});
const mobileContext=await browser.newContext({offline:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(url);
await mobile.locator('#toggleNet').tap();await expect(mobile.locator('#scene')).toHaveAttribute('data-net-amount','1.0000');
await mobile.locator('#cubeNetGallery summary').tap();await mobile.locator('[data-net="8"]').tap();
await mobile.locator('[data-net-type="2-3-1"]').tap();await expect(mobile.locator('.net-choice')).toHaveCount(3);await mobile.locator('.net-choice').first().tap();
await mobile.locator('#showHeight').check();await expect(mobile.locator('[data-dimension="高"]')).toHaveCount(1);
await mobile.locator('#hideAllFaces').tap();await expect(mobile.locator('[data-net-face]')).toHaveCount(0);await mobile.locator('#showAllFaces').tap();
await mobile.locator('#toggleNet').tap();await mobile.locator('#scene').scrollIntoViewIfNeeded();
const tapPoint=await vertexPoint(mobile,2);await mobile.touchscreen.tap(tapPoint.x,tapPoint.y);await expect(mobile.locator('#scene')).toHaveAttribute('data-highlight-count','3');
await mobile.locator('#toggleNet').tap();
await mobile.evaluate(()=>scrollTo(0,0));if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Phone overflow');
await mobile.screenshot({path:path.join(dir,'mobile-net.png'),fullPage:true});
const box=await mobile.locator('#scene').boundingBox(),tx=box.x+box.width/2,ty=box.y+box.height/2;
const client=await mobileContext.newCDPSession(mobile);const before=await mobile.locator('#surfaces').getAttribute('transform')||await mobile.locator('#surfaces').innerHTML();
await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx-30,y:ty,id:1},{x:tx+30,y:ty,id:2}]});
await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx-50,y:ty+15,id:1},{x:tx+70,y:ty+15,id:2}]});
await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);
if(before===await mobile.locator('#surfaces').innerHTML())throw Error('Pinch does not change diagram');
await mobile.locator('#fit').tap();await mobile.setViewportSize({width:844,height:390});if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Landscape overflow');
await mobile.setViewportSize({width:390,height:844});await mobile.locator('[data-shape="pyramid"]').tap();await mobile.locator('#sideCount').selectOption('9');await expect(mobile.locator('#shapeTitle')).toHaveText('九棱锥');
await mobile.locator('[data-shape="cylinder"]').tap();await mobile.locator('#netAmount').scrollIntoViewIfNeeded();const sliderBox=await mobile.locator('#netAmount').boundingBox();await mobile.touchscreen.tap(sliderBox.x+sliderBox.width*.6,sliderBox.y+sliderBox.height/2);
await expect.poll(()=>mobile.locator('#scene').getAttribute('data-curved-amount')).toMatch(/^0\.[1-9]/);await mobile.locator('#scene').scrollIntoViewIfNeeded();await mobile.screenshot({path:path.join(dir,'mobile-curved.png'),fullPage:true});
if(errors.length)throw Error(errors.join('\n'));if(network.length)throw Error('Unexpected external network requests');
console.log('PASS: all previous box/face/dimension/picking checks; 20 prism/pyramid choices (3–12) with exact counts, volumes and valid non-overlapping nets; cylinder/cone at 25/50/75/100%, smooth timed animations and drag interruption; mobile side selection and touch slider; PNG, landscape, offline and no errors. '+dir);
await context.close();await mobileContext.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
