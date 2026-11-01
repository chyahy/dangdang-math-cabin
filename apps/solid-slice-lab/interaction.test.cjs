const {chromium,expect:baseExpect}=require('../geometry-board/node_modules/@playwright/test');
const expect=baseExpect.configure({timeout:30000});
const {createServer}=require('../solid-geometry/serve.cjs');
const path=require('node:path'),fs=require('node:fs/promises');
const prompts='#deckPrompt.visible,#factorPrompt.visible,#rubikPrompt.visible,#geometryPrompt.visible,#multiplePrompt.visible,#campPrompt.visible,#rotationBoardPrompt.visible,#solidGeometryPrompt.visible,#slicePrompt.visible';
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(4188,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}),errors=[];
 const dir=path.resolve(__dirname,'../../.edgeone/cabin-interaction-qa');await fs.mkdir(dir,{recursive:true});
 const url='http://127.0.0.1:4188/cabin.html';
 async function makePage(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block',...options}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  // Test-only closure access. All production input handlers remain unmodified.
  await page.route(url,async route=>{const response=await route.fetch();const body=(await response.text()).replace('            animate(0);','window.qa={scene,camera,player,setViewMode,resetCharacters,roots:{slice:sliceG,solid:solidGeometryG},getView:()=>[fixYaw,fixPitch,fixDist,...viewPan.toArray()],getPending:()=>Math.abs(pendYaw)+Math.abs(pendPitch),getClick:()=>clickInfo};\n            animate(0);');await route.fulfill({response,body})});
  await page.goto(url);await page.waitForFunction(()=>window.qa && document.querySelector('canvas')?.width>0);
  await expect.poll(()=>page.evaluate(()=>qa.scene.getObjectByName('slice-upper-half')?.matrixWorld.elements[12])).not.toBe(0);
  return {page,context};
 }
 async function point(page,key='slice'){
  return page.evaluate(key=>{const g=qa.roots[key],p=key==='slice'?g.getObjectByName('slice-upper-half').localToWorld(new THREE.Vector3(0,.175,0)):g.localToWorld(new THREE.Vector3(0,1.55,0));p.project(qa.camera);return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight}},key);
 }
 async function hover(page,key='slice'){
  const p=await point(page,key);await page.mouse.move(p.x,p.y);await expect(page.locator(key==='slice'?'#slicePrompt':'#solidGeometryPrompt')).toHaveClass(/visible/);await expect(page.locator(prompts)).toHaveCount(1);return p;
 }
 async function aimAtSlice(page){
  await page.evaluate(()=>{
   qa.setViewMode('fp');const target=qa.roots.slice.localToWorld(new THREE.Vector3(0,1.45,0)),eye=target.clone().add(new THREE.Vector3(.2,.1,1.4));
   qa.player.pos.set(eye.x,3.12,eye.z);qa.player.vy=0;
   const c=qa.camera,set=c.position.set.bind(c.position),look=c.lookAt.bind(c);c.position.set=()=>set(eye.x,eye.y,eye.z);c.lookAt=()=>look(target);
  });
  await expect(page.locator('#crosshair')).toHaveClass(/show/);await expect(page.locator('#slicePrompt')).toHaveClass(/visible/);await expect(page.locator('#hint')).toContainText('切割台');
 }
 try{
  const {page,context}=await makePage();
  await expect(page.locator(prompts)).toHaveCount(0);await page.screenshot({path:path.join(dir,'desktop-clean.png')});
  let p=await hover(page);await expect(page.locator('#hint')).toContainText('切割');
  await page.screenshot({path:path.join(dir,'desktop-hover.png')});
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,p)).toBe('CANVAS');
  await page.mouse.move(20,180);await expect(page.locator(prompts)).toHaveCount(0);
  // Near a stand: show its label. Directly below it: no upstairs label.
  await page.evaluate(()=>{qa.player.pos.set(2.65,3.12,3.25);qa.player.vy=0});await expect(page.locator('#slicePrompt')).toHaveClass(/visible/);await expect(page.locator(prompts)).toHaveCount(1);
  await page.evaluate(()=>{qa.player.pos.set(2.65,0,3.25);qa.player.vy=0});await expect(page.locator('#slicePrompt')).not.toHaveClass(/visible/);
  // Windows can deliver a zero-button move just before release; retain a valid click.
  p=await hover(page);await page.mouse.down();await page.evaluate(p=>{const c=document.querySelector('canvas'),info=qa.getClick();c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:info.id,pointerType:'mouse',clientX:p.x,clientY:p.y,buttons:0}))},p);await page.mouse.up();
  await expect(page).toHaveURL(/solid-slice-lab\/$/);await expect(page.locator('#sectionTarget')).toBeVisible();console.log('PASS hover/proximity/floor gating and left click after zero-button move');
  await page.locator('#backHome').click();await page.waitForFunction(()=>window.qa);await page.mouse.move(20,180);await expect(page.locator(prompts)).toHaveCount(0);
  // Drag changes the view without activating a portal or sticking after release.
  p=await point(page);await page.mouse.move(p.x,p.y);const before=await page.evaluate(()=>qa.getView());await page.mouse.down();await page.mouse.move(p.x+90,p.y+25,{steps:6});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>qa.getView()[0])).not.toBe(before[0]);expect(page.url()).toBe(url);
  await expect.poll(()=>page.evaluate(()=>qa.getClick())).toBe(null);
  await expect.poll(()=>page.evaluate(()=>qa.getPending())).toBeLessThan(.00001);const released=await page.evaluate(()=>qa.getView());await page.mouse.move(70,230,{steps:5});const after=await page.evaluate(()=>qa.getView());expect(Math.abs(after[0]-released[0])).toBeLessThan(.005);console.log('PASS drag does not activate or stick after release');
  await page.reload();await page.waitForFunction(()=>window.qa);await aimAtSlice(page);expect(await page.evaluate(()=>document.pointerLockElement)).toBe(null);
  await page.mouse.click(720,500);await expect(page).toHaveURL(/solid-slice-lab\/$/);console.log('PASS first-person first left click without pointer lock');
  await page.locator('#backHome').click();await page.waitForFunction(()=>window.qa);await aimAtSlice(page);await page.keyboard.press('KeyE');await expect(page).toHaveURL(/solid-slice-lab\/$/);console.log('PASS first-person E uses a fresh centre ray');
  await context.close();
  const touch=await makePage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mobile=touch.page;
  await expect(mobile.locator(prompts)).toHaveCount(0);await mobile.screenshot({path:path.join(dir,'mobile-clean.png')});
  const cdp=await touch.context.newCDPSession(mobile),send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const v0=await mobile.evaluate(()=>qa.getView());await send('touchStart',[{id:1,x:120,y:390},{id:2,x:230,y:390}]);await send('touchMove',[{id:1,x:105,y:410},{id:2,x:265,y:410}]);await send('touchEnd',[]);
  await expect.poll(()=>mobile.evaluate(()=>qa.getView()[2])).not.toBe(v0[2]);expect(mobile.url()).toBe(url);const v1=await mobile.evaluate(()=>qa.getView());expect(v1.slice(3)).not.toEqual(v0.slice(3));
  await mobile.reload();await mobile.waitForFunction(()=>window.qa);p=await point(mobile);await mobile.touchscreen.tap(p.x,p.y);await expect(mobile).toHaveURL(/solid-slice-lab\/$/);console.log('PASS mobile physical tap, two-finger pan and pinch without accidental activation');
  await touch.context.close();expect(errors).toEqual([]);console.log('PASS no page errors; screenshots: '+dir);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
