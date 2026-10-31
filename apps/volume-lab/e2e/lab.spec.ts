import { test, expect, type Page } from '@playwright/test';
async function input(page: Page, id: string, value: string) { await page.locator(id).fill(value); await page.locator(id).press('Enter'); }
async function open(page: Page) { await page.goto('/'); await expect(page.locator('.scene-viewport canvas').first()).toBeVisible(); await expect(page.locator('.scene-fallback:visible')).toHaveCount(0); }
test('desktop real 3D rendering and 1mL microscopic water without exaggerating main height', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await expect(page.locator('#unit-mL')).toHaveValue('500'); await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '5');
  await page.waitForTimeout(1400); await page.screenshot({ path: 'test-results/desktop-water.png', fullPage: true });
  await page.getByRole('button', { name: '1 mL', exact: true }).click();
  await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '0.01'); await expect(page.getByTestId('magnifier')).toContainText('局部放大');
  await expect(page.getByTestId('magnifier')).toContainText('0.01 cm');
  await page.screenshot({ path: 'test-results/one-ml.png', fullPage: true }); expect(errors).toEqual([]);
});
test('all four editable units, exact decimals, invalid input and overcapacity', async ({ page }) => {
  await open(page); await input(page, '#unit-L', '0.3');
  await expect(page.locator('#unit-mL')).toHaveValue('300'); await expect(page.locator('#unit-cm3')).toHaveValue('300'); await expect(page.locator('#unit-dm3')).toHaveValue('0.3');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '3');
  await input(page, '#unit-cm3', '750'); await expect(page.locator('#unit-L')).toHaveValue('0.75');
  await input(page, '#unit-dm3', '0.001'); await expect(page.locator('#unit-mL')).toHaveValue('1');
  await input(page, '#unit-mL', '1200'); await expect(page.locator('.conversion-warning')).toContainText('超出本实验水箱容量');
  await expect(page.locator('#unit-L')).toHaveValue('1.2'); await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '0.01');
  await input(page, '#unit-mL', '-1'); await expect(page.getByRole('alert')).toContainText('大于或等于 0');
  await input(page, '#unit-mL', '1000'); await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '10'); await expect(page.locator('.completion')).toContainText('1 dm³');
});
test('1000 real unit cubes, slicing and mode data isolation', async ({ page }) => {
  await open(page); await input(page, '#unit-mL', '750');
  await page.getByRole('button', { name: '立方体装箱', exact: true }).click();
  await page.getByRole('button', { name: '开始装箱', exact: true }).click();
  await expect(page.getByTestId('scene')).toHaveAttribute('data-cube-count', '1000'); await expect(page.locator('.completion')).toContainText('1000 cm³');
  await page.getByLabel('剖层观察，看看里面').check(); await page.locator('#slice-layer').fill('3');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-visible-cubes', '300'); await expect(page.locator('#cube-count')).toHaveValue('1000');
  await page.screenshot({ path: 'test-results/cubes.png', fullPage: true });
  await input(page, '#unit-mL', '2.5'); await expect(page.locator('.conversion-warning')).toContainText('整数'); await expect(page.locator('#cube-count')).toHaveValue('1000');
  await page.getByRole('button', { name: '透明水箱', exact: true }).click(); await expect(page.locator('#unit-mL')).toHaveValue('750');
  await page.getByRole('button', { name: '立方体装箱', exact: true }).click(); await expect(page.locator('#cube-count')).toHaveValue('1000');
});
test('pour conservation, four options, manual redistribution, resetting only current mode', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: '量杯倒水', exact: true }).click();
  for (const [amount, tank] of [['100', '100'], ['250', '350'], ['500', '850'], ['1000', '1000']]) {
    await page.locator('.pour-options button').filter({ hasText: amount }).first().click(); await page.getByRole('button', { name: '开始倒水', exact: true }).click();
    await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-tank-ml', tank); await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-total-ml', '1000');
  }
  await expect(page.locator('.completion')).toContainText('量杯中的 1 L 水');
  await input(page, '#unit-L', '.5'); await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-cup-ml', '500');
  await input(page, '#unit-L', '0.5'); await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-cup-ml', '500');
  await page.getByRole('button', { name: '重置本实验', exact: true }).click(); await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-cup-ml', '1000');
  await page.getByRole('button', { name: '透明水箱', exact: true }).click(); await expect(page.locator('#unit-mL')).toHaveValue('500');
});
test('animated pouring stays conserved on every frame, pauses and skips, shows tilted cup', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: '量杯倒水', exact: true }).click(); await page.locator('.pour-options button').last().click();
  await page.evaluate(() => {
    (window as any).qaConservation = [];
    const observe = () => { const e = document.querySelector('[data-testid="pour-balance"]'); if (e) { const a = Number(e.getAttribute('data-cup-ml')), b = Number(e.getAttribute('data-tank-ml')); if (a + b !== 1000) (window as any).qaConservation.push([a, b]); } };
    new MutationObserver(observe).observe(document.querySelector('[data-testid="pour-balance"]')!, { attributes: true });
  });
  await page.getByRole('button', { name: '开始倒水', exact: true }).click(); await expect(page.getByRole('button', { name: '暂停动画', exact: true })).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('pour-balance').getAttribute('data-tank-ml'))).toBeGreaterThan(250);
  await page.getByRole('button', { name: '暂停动画', exact: true }).click(); const paused = await page.getByTestId('pour-balance').getAttribute('data-tank-ml');
  await page.waitForTimeout(250); await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-tank-ml', paused!);
  await page.screenshot({ path: 'test-results/pour-animation.png', fullPage: true });
  await page.getByRole('button', { name: '继续动画', exact: true }).click(); await page.getByRole('button', { name: '直接到位', exact: true }).click();
  await expect(page.getByTestId('pour-balance')).toHaveAttribute('data-tank-ml', '1000'); expect(await page.evaluate(() => (window as any).qaConservation)).toEqual([]); expect(errors).toEqual([]);
});
test('knowledge focuses and all four challenges provide feedback and real experiment verification', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /1 mL = 1 cm³.*看边长/ }).click(); await expect(page.getByTestId('scene-expression')).toContainText('1 cm × 1 cm × 1 cm'); await expect(page.locator('#unit-mL')).toHaveValue('1');
  await page.getByRole('button', { name: /为什么是 1000 倍/ }).click(); await expect(page.getByTestId('scene')).toHaveAttribute('data-cube-count', '1000');
  for (const [i, answer] of [[0, '500'], [1, '1'], [2, '1000']] as const) {
    await page.getByRole('button', { name: `第 ${i + 1} 题`, exact: true }).click(); await page.getByLabel('填写练习答案').fill(answer); await page.getByRole('button', { name: '检查答案', exact: true }).click(); await expect(page.locator('.answer-feedback')).toContainText('答对了');
  }
  await page.getByRole('button', { name: '第 4 题', exact: true }).click(); await page.getByLabel('10 × 10 × 10 = 1000', { exact: true }).check(); await page.getByRole('button', { name: '检查答案', exact: true }).click(); await expect(page.locator('.answer-feedback')).toContainText('答对了');
  await page.getByRole('button', { name: '用实验验证', exact: true }).click(); await expect(page.getByTestId('scene')).toHaveAttribute('data-mode', 'cubes'); await expect(page.getByTestId('scene')).toHaveAttribute('data-cube-count', '1000');
});
test('water operation amount, cube acceleration, pause/continue/skip and fullscreen controls', async ({ page }) => {
  await open(page); await input(page, '#water-step', '250');
  await page.getByRole('button', { name: '注水', exact: true }).click(); await expect(page.locator('#water-amount')).toHaveValue('750');
  await page.getByRole('button', { name: '排水', exact: true }).click(); await expect(page.locator('#water-amount')).toHaveValue('500');
  await page.getByRole('button', { name: '全屏授课', exact: true }).click(); await expect(page.locator('.app')).toHaveClass(/presentation/);
  await page.getByRole('button', { name: '退出全屏授课', exact: true }).click(); await expect(page.locator('.app')).not.toHaveClass(/presentation/);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.getByRole('button', { name: '立方体装箱', exact: true }).click();
  await page.getByRole('button', { name: '1× 速度', exact: true }).click(); await page.getByRole('button', { name: '2× 速度', exact: true }).click();
  await page.getByRole('button', { name: '开始装箱', exact: true }).click(); await expect(page.getByRole('button', { name: '暂停动画', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停动画', exact: true }).click(); const count = await page.locator('#cube-count').inputValue(); await page.waitForTimeout(180); await expect(page.locator('#cube-count')).toHaveValue(count);
  await page.getByRole('button', { name: '继续动画', exact: true }).click(); await page.getByRole('button', { name: '直接到位', exact: true }).click(); await expect(page.locator('#cube-count')).toHaveValue('1000');
});
test('phone portrait and landscape remain usable with real touch rotation and pinch', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4178'); await expect(page.locator('.scene-viewport canvas').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await page.locator('.scene-viewport').boundingBox(); const client = await context.newCDPSession(page); const x = bounds!.x + bounds!.width / 2, y = bounds!.y + bounds!.height / 2;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 45, y: y + 12, id: 1 }, { x: x + 65, y: y + 12, id: 2 }] }); await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await input(page, '#unit-L', '0.25'); await expect(page.getByTestId('scene')).toHaveAttribute('data-main-water-height', '2.5');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true }); await page.setViewportSize({ width: 844, height: 390 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '恢复正面视角', exact: true }).click(); await page.screenshot({ path: 'test-results/landscape.png', fullPage: true }); expect(errors).toEqual([]); await context.close();
});
