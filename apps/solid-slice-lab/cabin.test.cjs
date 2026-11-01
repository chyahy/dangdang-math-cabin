const {chromium,expect}=require('../geometry-board/node_modules/@playwright/test');
const {createServer}=require('../solid-geometry/serve.cjs');
const path=require('node:path'),fs=require('node:fs/promises');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(4188,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}),errors=[];
 const dir=path.resolve(__dirname,'../../.edgeone/slice-cabin-qa');await fs.mkdir(dir,{recursive:true});
 async function makePage(options){
  const context=await browser.newContext(options),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('load',e=>{if(!(e.target instanceof HTMLScriptElement)||!e.target.src.includes('three.min.js'))return;const t=window.THREE;for(const name of ['Scene','PerspectiveCamera']){const Original=t[name];t[name]=new Proxy(Original,{construct(target,args,newTarget){const object=Reflect.construct(target,args,newTarget);window[name==='Scene'?'qaScene':'qaCamera']=object;return object}})}},true));
  return {context,page};
 }
 async function modelPoint(page){return page.evaluate(()=>{const root=qaScene.getObjectByName('solid-slice-lab-entrance'),half=root.getObjectByName('slice-upper-half'),p=half.localToWorld(new THREE.Vector3(0,.175,0)).project(qaCamera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight}})}
 async function ready(page){await page.waitForFunction(()=>window.qaScene?.getObjectByName('slice-upper-half')?.matrixWorld.elements[12]!==undefined && qaScene.getObjectByName('slice-upper-half').matrixWorld.elements[12]!==0)}
 async function hover(page){await ready(page);const p=await modelPoint(page);await page.mouse.move(p.x,p.y);await expect(page.locator('#slicePrompt')).toHaveClass(/visible/,{timeout:30000});return p}
 async function clickStand(page){const p=await hover(page);await page.mouse.click(p.x,p.y)}
 const url='http://127.0.0.1:4188/';
 try{
  if(!process.argv.includes('--animation-only')){
  const {page,context}=await makePage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.goto(url);await hover(page);
  const position=await page.evaluate(()=>qaScene.getObjectByName('solid-slice-lab-entrance').position.toArray());expect(position).toEqual([2.65,3.12,2.2]);
  await page.screenshot({path:path.join(dir,'desktop-entrance.png'),fullPage:true});
  const point=await modelPoint(page);expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,point)).toBe('CANVAS');await page.mouse.click(point.x,point.y);await expect(page).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});await expect(page.locator('#sectionTarget')).toBeVisible();
  console.log('PASS actual physical mesh ray click');
  await page.locator('#backHome').click();await hover(page);
  await clickStand(page);await expect(page).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});await page.goBack();await hover(page);
  // The complete roof/walls contain the stand rather than letting its sign float through.
  await page.locator('#menuDot').click();await page.locator('#houseToggle').click();await expect(page.locator('#slicePrompt')).not.toHaveClass(/visible/);await page.locator('#houseToggle').click();await hover(page);
  await page.locator('#viewFpBtn').click();
  await page.evaluate(()=>{const g=qaScene.getObjectByName('solid-slice-lab-entrance'),target=g.localToWorld(new THREE.Vector3(0,1.45,0)),eye=target.clone().add(new THREE.Vector3(.2,.1,1.4)),camera=qaCamera,set=camera.position.set.bind(camera.position),look=camera.lookAt.bind(camera);camera.position.set=()=>set(eye.x,eye.y,eye.z);camera.lookAt=()=>look(target);Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.querySelector('canvas')});document.exitPointerLock=()=>{}});
  await expect(page.locator('#hint')).toContainText('切割台',{timeout:15000});await page.keyboard.press('KeyE');await expect(page).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});
  console.log('PASS first-person E');await context.close();
  const mobileResult=await makePage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),mobile=mobileResult.page;
  await mobile.goto(url);await ready(mobile);await expect(mobile.locator('#slicePrompt')).not.toHaveClass(/visible/);await mobile.screenshot({path:path.join(dir,'mobile-entrance.png'),fullPage:true});
  const tap=await modelPoint(mobile);expect(tap.x).toBeGreaterThan(0);expect(tap.x).toBeLessThan(390);expect(tap.y).toBeGreaterThan(0);expect(tap.y).toBeLessThan(844);
  await mobile.touchscreen.tap(tap.x,tap.y);await expect(mobile).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});await mobile.locator('#backHome').tap();await ready(mobile);const nextTap=await modelPoint(mobile);await mobile.touchscreen.tap(nextTap.x,nextTap.y);await expect(mobile).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});
  await mobileResult.context.close();
  }
  // Observe the genuine split animation before its navigation timer completes.
  const animated=await makePage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),animation=animated.page;
  // Hold only the app's 1200 ms portal callback so screenshot capture cannot race navigation.
  await animation.addInitScript(()=>{const native=window.setTimeout;window.setTimeout=(fn,ms,...args)=>{if(ms===1200){window.qaSliceContinue=()=>fn(...args);return 2147483000}return native(fn,ms,...args)}});
  await animation.goto(url);await hover(animation);
  await clickStand(animation);await expect.poll(()=>animation.evaluate(()=>qaScene.getObjectByName('slice-upper-half').position.y)).toBeGreaterThan(.085);
  await animation.screenshot({path:path.join(dir,'split-animation.png'),timeout:60000});await animation.evaluate(()=>window.qaSliceContinue());await expect(animation).toHaveURL(/solid-slice-lab\/$/,{timeout:20000});await animated.context.close();
  expect(errors).toEqual([]);console.log(process.argv.includes('--animation-only')?'PASS actual split animation and original navigation callback, no runtime errors.':'PASS upstairs stand visible on desktop and phone, physical clicks/taps, prompt, split animation, first-person E, full-house prompt hiding, return and browser-back reset; no runtime errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
