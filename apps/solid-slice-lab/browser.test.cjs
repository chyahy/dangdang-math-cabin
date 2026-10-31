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
  const canvas=page.locator('#canvas canvas'),rect=await canvas.boundingBox();
  const findMarkers=async()=>{const png=await canvas.screenshot();return await page.evaluate(async uri=>{
   const img=new Image();img.src=uri;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const {data}=ctx.getImageData(0,0,c.width,c.height),seen=new Set(),dots=[];
   const matches=i=>data[i*4]<90&&data[i*4+1]>80&&data[i*4+1]<170&&data[i*4+1]>data[i*4]*1.5&&Math.abs(data[i*4+1]-data[i*4+2])<25;
   for(let i=0;i<c.width*c.height;i++){if(seen.has(i)||!matches(i))continue;const stack=[i],group=[];seen.add(i);while(stack.length){const p=stack.pop();group.push(p);for(const q of [p-1,p+1,p-c.width,p+c.width]){if(q>=0&&q<c.width*c.height&&!seen.has(q)&&matches(q)){seen.add(q);stack.push(q)}}}if(group.length>12)dots.push({x:group.reduce((s,p)=>s+p%c.width,0)/group.length,y:group.reduce((s,p)=>s+Math.floor(p/c.width),0)/group.length});}
   return dots;
  },'data:image/png;base64,'+png.toString('base64'))};const markers=await findMarkers();
  expect(markers.length).toBeGreaterThanOrEqual(4);
  for(const marker of markers.slice(0,2))await page.mouse.click(rect.x+marker.x,rect.y+marker.y);
  await expect(page.locator('#stage')).toHaveAttribute('data-selected-vertices','2');
  for(const [id,value] of [['tilt','70'],['turn','150'],['tilt','120']]){
   await page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},value);
   expect(Number(await page.locator('#stage').getAttribute('data-anchor-error'))).toBeLessThan(1e-6);
  }
  const remainingMarkers=await findMarkers(),freshRect=await canvas.boundingBox();expect(remainingMarkers.length).toBeGreaterThan(0);await page.mouse.click(freshRect.x+remainingMarkers[0].x,freshRect.y+remainingMarkers[0].y);await expect(page.locator('#stage')).toHaveAttribute('data-selected-vertices','3');expect(Number(await page.locator('#stage').getAttribute('data-anchor-error'))).toBeLessThan(1e-6);
  await expect(page.locator('#offset')).toBeDisabled();await page.locator('#clearVertices').click();await expect(page.locator('#offset')).toBeEnabled();
  for(const [shape,label] of [['prism','四棱柱'],['pyramid','四棱锥'],['cube','正方体']]){
   await page.locator(`[data-shape="${shape}"]`).click();await expect(page.locator('#shapeName')).toHaveText(label);
  }
  await page.locator('[data-preset="horizontal"]').click();await expect(page.locator('#sectionName')).toHaveText('正方形');
  await page.locator('#merge').click();await page.locator('#cut').click();await page.locator('#merge').click();
  await page.waitForTimeout(400);await expect(page.locator('#stage')).toHaveAttribute('data-separation','0');
  await page.locator('#cut').click();await expect(page.locator('#stage')).toHaveAttribute('data-separation','1.15');await page.locator('#resetView').click();
  let poses=0;
  for(const shape of ['cube','cuboid','prism','pyramid','cylinder','cone']){
   await page.locator(`[data-shape="${shape}"]`).click();
   for(const sides of ['prism','pyramid'].includes(shape)?[3,4,5,6]:[4]){
    if(['prism','pyramid'].includes(shape))await page.locator('#sideButtons button').nth(sides-3).click();
    const targets=await page.locator('#sectionTarget').evaluate(e=>[...e.options].filter(o=>o.value&&!o.disabled).map(o=>o.value));expect(targets.length).toBeGreaterThanOrEqual(2);
    for(const target of targets){
     await page.locator('#sectionTarget').selectOption(target);await expect(page.locator('#stage')).toHaveAttribute('data-section-kind',target);
     await expect(page.locator('#stage')).toHaveAttribute('data-selected-vertices','0');await expect(page.locator('#offset')).toBeEnabled();
     expect(await page.locator('#stage').evaluate(e=>{const [nx,ny,nz,d]=JSON.parse(e.dataset.plane),points=JSON.parse(e.dataset.sectionPoints);return points.length>=3&&points.every(([x,y,z])=>Math.abs(nx*x+ny*y+nz*z+d)<1e-5)})).toBeTruthy();
     await expect(page.locator('#sectionPreview polygon')).toHaveCount(1);poses++;
     if(shape==='cylinder'&&target==='ellipse'||shape==='cone'&&target==='triangle'||shape==='cube'&&target==='trapezoid')await page.screenshot({path:path.join(dir,shape+'-'+target+'.png'),fullPage:true});
    }
   }
   if(shape==='cylinder'||shape==='cone'){
    await expect(page.locator('#vertexTool')).toBeHidden();const before=await page.locator('#stage').getAttribute('data-plane');
    await expect(page.locator('#sectionTarget option[value="trapezoid"]')).toBeDisabled();
    await page.locator('#sectionTarget').evaluate(e=>{e.value='trapezoid';e.dispatchEvent(new Event('change',{bubbles:true}))});
    await expect(page.locator('#targetNote')).toContainText('不能');expect(await page.locator('#stage').getAttribute('data-plane')).toBe(before);expect(await page.locator('#stage').getAttribute('data-section-kind')).not.toBe('trapezoid');
   }
  }
  await page.locator('[data-shape="cylinder"]').click();await page.locator('#sectionTarget').selectOption('ellipse');
  await page.locator('[data-preset="horizontal"]').click();await expect(page.locator('#stage')).toHaveAttribute('data-section-kind','circle');
  await page.locator('#locateTarget').click();await expect(page.locator('#stage')).toHaveAttribute('data-section-kind','ellipse');
  await page.locator('#backHome').click();await expect(page.locator('#gameShelfToggle')).toBeVisible();
  await page.locator('#gameShelfToggle').click();await page.locator('.gameShelfLink[href="solid-slice-lab/"]').click();await expect(page).toHaveURL(/solid-slice-lab\/$/);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://127.0.0.1:4187/solid-slice-lab/');await expect(mobile.locator('#sectionName')).not.toHaveText('—');
  expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await mobile.locator('[data-shape="pyramid"]').tap();await mobile.locator('#sideButtons button').last().tap();await expect(mobile.locator('#shapeName')).toHaveText('六棱锥');
  await mobile.locator('[data-shape="cylinder"]').tap();await mobile.locator('#sectionTarget').selectOption('circle');await expect(mobile.locator('#sectionName')).toHaveText('圆');
  await mobile.locator('#sectionTarget').selectOption('ellipse');await expect(mobile.locator('#sectionName')).toHaveText('椭圆');
  await mobile.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  await mobile.setViewportSize({width:844,height:390});expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  const offline=await browser.newContext({offline:true,viewport:{width:1280,height:900}}),local=await offline.newPage(),external=[];
  local.on('pageerror',e=>errors.push(e.message));local.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
  const {pathToFileURL}=require('node:url');await local.goto(pathToFileURL(path.resolve(__dirname,'../../site/solid-slice-lab/index.html')).href);await expect(local.locator('#sectionName')).not.toHaveText('—');
  await local.locator('[data-preset="vertical"]').click();await local.locator('[data-shape="cone"]').click();await local.locator('#sectionTarget').selectOption('ellipse');await expect(local.locator('#sectionName')).toHaveText('椭圆');expect(external).toEqual([]);expect(errors).toEqual([]);
  console.log('PASS '+poses+' automatic section targets: real plane/point membership, live labels and section preview; cylinder/cone added, impossible trapezoids disabled and refused; manual cut and re-location; original vertex lock, cut, cabin return, mobile/landscape and offline with no errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
