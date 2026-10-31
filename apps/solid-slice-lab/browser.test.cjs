const {chromium,expect}=require('../geometry-board/node_modules/@playwright/test');
const {createServer}=require('../solid-geometry/serve.cjs');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(4187,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
 const errors=[],dir=path.resolve(__dirname,'../../.edgeone/slice-qa');await fs.mkdir(dir,{recursive:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4187/solid-slice-lab/');
  await expect(page.locator('#sectionName')).not.toHaveText('—');
  await expect(page.locator('.brand')).toContainText('当当老师小课堂');
  await expect(page.locator('body')).not.toContainText('鲁老师');
  for(const img of await page.locator('img').all())expect(await img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
  await expect(page.locator('#canvas canvas')).toBeVisible();
  await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true});
  // Detect the actual cyan 3D vertex markers in a canvas screenshot, then click them.
  const canvas=page.locator('#canvas canvas'),rect=await canvas.boundingBox(),png=await canvas.screenshot();
  const markers=await page.evaluate(async uri=>{
   const img=new Image();img.src=uri;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const {data}=ctx.getImageData(0,0,c.width,c.height),seen=new Set(),dots=[];
   const matches=i=>data[i*4]<90&&data[i*4+1]>80&&data[i*4+1]<170&&data[i*4+1]>data[i*4]*1.5&&Math.abs(data[i*4+1]-data[i*4+2])<25;
   for(let i=0;i<c.width*c.height;i++){if(seen.has(i)||!matches(i))continue;const stack=[i],group=[];seen.add(i);while(stack.length){const p=stack.pop();group.push(p);for(const q of [p-1,p+1,p-c.width,p+c.width]){if(q>=0&&q<c.width*c.height&&!seen.has(q)&&matches(q)){seen.add(q);stack.push(q)}}}if(group.length>12)dots.push({x:group.reduce((s,p)=>s+p%c.width,0)/group.length,y:group.reduce((s,p)=>s+Math.floor(p/c.width),0)/group.length});}
   return dots;
  },'data:image/png;base64,'+png.toString('base64'));
  expect(markers.length).toBeGreaterThanOrEqual(4);
  for(const marker of markers.slice(0,2))await page.mouse.click(rect.x+marker.x,rect.y+marker.y);
  await expect(page.locator('#stage')).toHaveAttribute('data-selected-vertices','2');
  for(const [id,value] of [['tilt','70'],['turn','150'],['tilt','120']]){
   await page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},value);
   expect(Number(await page.locator('#stage').getAttribute('data-anchor-error'))).toBeLessThan(1e-6);
  }
  await expect(page.locator('#offset')).toBeDisabled();await page.locator('#clearVertices').click();await expect(page.locator('#offset')).toBeEnabled();
  for(const [shape,label] of [['prism','四棱柱'],['pyramid','四棱锥'],['cube','正方体']]){
   await page.locator(`[data-shape="${shape}"]`).click();await expect(page.locator('#shapeName')).toHaveText(label);
  }
  await page.locator('[data-preset="horizontal"]').click();await expect(page.locator('#sectionName')).toHaveText('四边形');
  await page.locator('#merge').click();await page.locator('#cut').click();await page.locator('#merge').click();
  await page.waitForTimeout(400);await expect(page.locator('#stage')).toHaveAttribute('data-separation','0');
  await page.locator('#cut').click();await expect(page.locator('#stage')).toHaveAttribute('data-separation','1.15');await page.locator('#resetView').click();
  await page.locator('#backHome').click();await expect(page.locator('#gameShelfToggle')).toBeVisible();
  await page.locator('#gameShelfToggle').click();await page.locator('.gameShelfLink[href="solid-slice-lab/"]').click();await expect(page).toHaveURL(/solid-slice-lab\/$/);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://127.0.0.1:4187/solid-slice-lab/');await expect(mobile.locator('#sectionName')).not.toHaveText('—');
  expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await mobile.locator('[data-shape="pyramid"]').tap();await mobile.locator('#sideButtons button').last().tap();await expect(mobile.locator('#shapeName')).toHaveText('六棱锥');
  await mobile.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  await mobile.setViewportSize({width:844,height:390});expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  const offline=await browser.newContext({offline:true,viewport:{width:1280,height:900}}),local=await offline.newPage(),external=[];
  local.on('pageerror',e=>errors.push(e.message));local.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
  const {pathToFileURL}=require('node:url');await local.goto(pathToFileURL(path.resolve(__dirname,'../../site/solid-slice-lab/index.html')).href);await expect(local.locator('#sectionName')).not.toHaveText('—');
  await local.locator('[data-preset="vertical"]').click();expect(external).toEqual([]);expect(errors).toEqual([]);
  console.log('PASS: branding, actual 3D vertex clicks, two-point lock under 3 angle changes, shapes, presets, merge animation cancellation, cut, cabin entry/return, phone/landscape, offline with zero network requests and no runtime errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
