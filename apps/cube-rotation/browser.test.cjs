const { chromium, expect } = require('../geometry-board/node_modules/@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    const file = path.resolve(__dirname, '../../site/cube-rotation/index.html');
    await page.goto(pathToFileURL(file).href); await expect(page.locator('#viewport canvas')).toBeVisible();
    await expect(page.locator('#fallback')).toBeHidden();
    // Clicking a front-face sticker selects its current physical face.
    await page.locator('[data-face=U]').click();
    const hitBox = await page.locator('#viewport').boundingBox();
    await page.mouse.click(hitBox.x + hitBox.width * .44, hitBox.y + hitBox.height * .57);
    await expect(page.locator('[data-face=F]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-face=R]').click();
    await page.locator('#clockwise').click(); await expect(page.locator('#moveCount')).toHaveText('1 步');
    await expect(page.locator('#cubeState')).toHaveText('探索中');
    await page.locator('#undo').click(); await expect(page.locator('#moveCount')).toHaveText('0 步');
    await expect(page.locator('#cubeState')).toHaveText('已复原');
    await page.locator('#redo').click(); await expect(page.locator('#moveCount')).toHaveText('1 步');
    await page.locator('#reset').click(); await expect(page.locator('#cubeState')).toHaveText('已复原');
    // Full 24-turn demo returns to the solved state.
    await page.locator('#play').click(); await expect(page.locator('#progress')).toHaveText('24 / 24', { timeout: 15000 });
    await expect(page.locator('#cubeState')).toHaveText('已复原');
    // Previous and next are inverse operations on both model and progress.
    await page.locator('#previous').click(); await expect(page.locator('#progress')).toHaveText('23 / 24');
    await expect(page.locator('#cubeState')).toHaveText('探索中');
    await page.locator('#next').click(); await expect(page.locator('#progress')).toHaveText('24 / 24');
    await expect(page.locator('#cubeState')).toHaveText('已复原');
    await page.locator('#demoSelect').selectOption('four'); await page.locator('#play').click();
    await expect(page.locator('#progress')).toHaveText('4 / 4'); await expect(page.locator('#cubeState')).toHaveText('已复原');
    // Pause must stop after the current animated turn.
    await page.locator('#demoSelect').selectOption('six'); await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Ⅱ 暂停演示'); await page.locator('#play').click();
    await expect(page.locator('#clockwise')).toBeEnabled(); const paused = await page.locator('#progress').textContent();
    await page.waitForTimeout(450); if (paused !== await page.locator('#progress').textContent()) throw Error('Pause did not stop');
    // Custom notation validation and playback.
    await page.locator('#demoSelect').selectOption('custom'); await page.locator('#algorithm').fill('R3');
    await page.locator('#loadAlgorithm').click(); await expect(page.locator('#toast')).toContainText('无法识别');
    await page.locator('#algorithm').fill("F F' U2 U2"); await page.locator('#loadAlgorithm').click();
    await page.locator('#play').click(); await expect(page.locator('#progress')).toHaveText('4 / 4');
    await expect(page.locator('#cubeState')).toHaveText('已复原');
    // Keyboard and pointer orbit keep the view responsive; pointer release must stop dragging.
    await page.locator('#viewport').focus(); await page.keyboard.press('r');
    await expect(page.locator('#moveCount')).toHaveText('5 步'); await page.keyboard.press('Control+z');
    await expect(page.locator('#moveCount')).toHaveText('4 步'); await expect(page.locator('#cubeState')).toHaveText('已复原');
    const bounds = await page.locator('#viewport').boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .5 + 100, bounds.y + bounds.height * .5 + 30, { steps: 10 }); await page.mouse.up();
    await page.locator('#resetView').click();
    await page.locator('#demoSelect').selectOption('six');
    const dir = path.resolve(__dirname, '../../.edgeone/cube-rotation-qa'); await fs.mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'desktop.png'), fullPage: true });
    // Twenty randomized turns leave a usable, genuinely scrambled cube.
    await page.locator('#scramble').click(); await expect(page.locator('#progress')).toHaveText('20 / 20', { timeout: 15000 });
    await expect(page.locator('#cubeState')).toHaveText('探索中');
    await expect(page.locator('#undo')).toBeEnabled();
    const mobileContext = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const mobile = await mobileContext.newPage(); mobile.on('pageerror', e => errors.push(e.message));
    await mobile.goto(pathToFileURL(file).href); await expect(mobile.locator('#viewport canvas')).toBeVisible();
    if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile horizontal overflow');
    await mobile.locator('[data-face=F]').tap(); await mobile.locator('#clockwise').tap();
    await expect(mobile.locator('#moveCount')).toHaveText('1 步');
    await mobile.locator('#counterclockwise').tap(); await expect(mobile.locator('#cubeState')).toHaveText('已复原');
    await mobile.evaluate(() => scrollTo(0, 0));
    await mobile.screenshot({ path: path.join(dir, 'mobile.png'), fullPage: true });
    // Two touch contacts cause a real pinch gesture without triggering a face turn.
    const mb = await mobile.locator('#viewport').boundingBox();
    const session = await mobileContext.newCDPSession(mobile);
    const ty = mb.y + mb.height / 2, tx = mb.x + mb.width / 2;
    const beforePinch = await mobile.locator('#viewport').screenshot();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx - 30, y: ty, id: 1 }, { x: tx + 30, y: ty, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx - 65, y: ty, id: 1 }, { x: tx + 65, y: ty, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const afterPinch = await mobile.locator('#viewport').screenshot();
    if (beforePinch.equals(afterPinch)) throw Error('Pinch did not change the rendered view');
    await expect(mobile.locator('#moveCount')).toHaveText('2 步');
    await mobile.setViewportSize({ width: 844, height: 390 });
    if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Landscape horizontal overflow');
    await mobile.screenshot({ path: path.join(dir, 'landscape.png'), fullPage: true });
    if (errors.length) throw Error(errors.join('\n'));
    if (requests.length) throw Error('Unexpected network request: ' + requests.join(', '));
    console.log('PASS: offline rendering, face turns, undo/redo, 24-turn identity demo, previous/next, pause, custom formulas, invalid input, keyboard, drag, scramble, mobile touch, pinch, landscape, zero page errors and zero external requests. Screenshots: ' + dir);
    await context.close(); await mobileContext.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
