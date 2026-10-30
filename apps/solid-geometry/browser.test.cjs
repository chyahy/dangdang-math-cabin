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
for(const shape of ['cuboid','frustum','triprism','hexprism','pyramid','tetra']){
 await page.locator(`[data-shape="${shape}"]`).click();await page.locator('#toggleNet').click();
 await expect(page.locator('#scene')).toHaveAttribute('data-net-amount','1.0000');const fail=await verifyGeometry();if(fail.length)throw Error(shape+': '+fail.join(','));
}
for(const shape of ['cylinder','cone']){await page.locator(`[data-shape="${shape}"]`).click();await page.locator('#toggleNet').click();await expect(page.locator('[data-net-face]')).toHaveCount(shape==='cylinder'?3:2);await expect(page.locator('#netNote')).toContainText(shape==='cylinder'?'长方形':'扇形')}
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
await mobile.evaluate(()=>scrollTo(0,0));if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Phone overflow');
await mobile.screenshot({path:path.join(dir,'mobile-net.png'),fullPage:true});
const box=await mobile.locator('#scene').boundingBox(),tx=box.x+box.width/2,ty=box.y+box.height/2;
const client=await mobileContext.newCDPSession(mobile);const before=await mobile.locator('#surfaces').getAttribute('transform')||await mobile.locator('#surfaces').innerHTML();
await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx-30,y:ty,id:1},{x:tx+30,y:ty,id:2}]});
await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx-50,y:ty+15,id:1},{x:tx+70,y:ty+15,id:2}]});
await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(150);
if(before===await mobile.locator('#surfaces').innerHTML())throw Error('Pinch does not change diagram');
await mobile.locator('#fit').tap();await mobile.setViewportSize({width:844,height:390});if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Landscape overflow');
if(errors.length)throw Error(errors.join('\n'));if(network.length)throw Error('Unexpected external network requests');
console.log('PASS: all 11 cube nets, 6 other polyhedra, planarity, area preservation, connected hinges, no overlaps, partial unfolding, resized cube, cylinder/cone nets, sphere limitation, numeric dimensions, surface/volume, PNG export, animation, mobile pinch+pan, landscape, offline and no page errors. '+dir);
await context.close();await mobileContext.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
