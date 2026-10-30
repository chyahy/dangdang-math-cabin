const {chromium,expect}=require('../geometry-board/node_modules/@playwright/test'),{createServer}=require('./serve.cjs'),path=require('node:path'),fs=require('node:fs/promises');
(async()=>{
const server=createServer();await new Promise(r=>server.listen(4186,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(20000);
await page.addInitScript(()=>document.addEventListener('load',event=>{
if(!(event.target instanceof HTMLScriptElement)||!event.target.src.includes('three.min.js'))return;
const t=window.THREE;
for(const name of ['Scene','PerspectiveCamera']){const Original=t[name];t[name]=new Proxy(Original,{construct(target,args,newTarget){const obj=Reflect.construct(target,args,newTarget);window[name==='Scene'?'qaScene':'qaCamera']=obj;return obj}})}
},true));
const url='http://127.0.0.1:4186/';await page.goto(url);await expect(page.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});
const dir=path.resolve(__dirname,'../../.edgeone/solid-geometry-qa');await fs.mkdir(dir,{recursive:true});
await page.screenshot({path:path.join(dir,'cabin-entrance.png'),fullPage:true});
// A real ray click on the little folding cube, rather than the overlay button.
const point=await page.evaluate(()=>{const g=qaScene.getObjectByName('solid-geometry-entrance'),p=g.localToWorld(new THREE.Vector3(0,1.55,0)).project(qaCamera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight}});
await page.mouse.click(point.x,point.y);await expect(page).toHaveURL(/solid-geometry\/$/,{timeout:15000});
console.log('PASS physical ray click');
await expect(page.locator('#cubeNetChoices .net-choice')).toHaveCount(11);
await page.locator('#backHome').click();await expect(page.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});
await page.locator('#gameShelfToggle').click();await page.locator('.gameShelfLink[href="solid-geometry/"]').click();await expect(page).toHaveURL(/solid-geometry\/$/,{timeout:15000});
await page.goBack();await expect(page.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});
if(await page.locator('#gameShelf').getAttribute('class')==='open')await page.locator('#gameShelfToggle').click();
await page.locator('#solidGeometryPrompt').click();await expect(page).toHaveURL(/solid-geometry\/$/,{timeout:15000});
await page.goBack();await expect(page.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});
// An isolated first-person camera still uses the actual app's centre ray and E handler.
console.log('PASS quick list and return');
await page.locator('#menuDot').click();await page.locator('#viewFpBtn').click();
await page.evaluate(()=>{
 const g=qaScene.getObjectByName('solid-geometry-entrance'),target=g.localToWorld(new THREE.Vector3(0,1.55,0)),eye=target.clone().add(new THREE.Vector3(1.5,.2,1.6)),c=qaCamera;
 const set=c.position.set.bind(c.position),look=c.lookAt.bind(c);c.position.set=()=>set(eye.x,eye.y,eye.z);c.lookAt=()=>look(target);
 Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>null});
 // The desktop centre-ray path requires an active pointer lock.
 Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.querySelector('canvas')});
 document.exitPointerLock=()=>{};
});
await expect(page.locator('#hint')).toContainText('立体图形观察站',{timeout:15000});await page.keyboard.press('KeyE');await expect(page).toHaveURL(/solid-geometry\/$/,{timeout:15000});
console.log('PASS first-person E');
if(errors.length)throw Error(errors.join('\n'));
const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));
mobile.setDefaultTimeout(20000);
await mobile.goto(url);await expect(mobile.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});await mobile.locator('#gameShelfToggle').tap();await mobile.locator('.gameShelfLink[href="solid-geometry/"]').tap();await expect(mobile.locator('#shapeTitle')).toHaveText('正方体');await mobile.locator('#backHome').tap();await expect(mobile.locator('#solidGeometryPrompt')).toHaveClass(/visible/,{timeout:30000});await mobile.locator('#solidGeometryPrompt').tap();await expect(mobile).toHaveURL(/solid-geometry\/$/,{timeout:15000});
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: visible outdoor pedestal, true 3D ray click, animation/navigation, cabin quick list, return and browser back reset, first-person E, phone list and physical prompt, no runtime errors. '+dir);
await context.close();await touch.close();
}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
