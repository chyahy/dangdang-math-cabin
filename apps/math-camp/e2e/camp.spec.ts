import { test, expect, type Page } from "@playwright/test";
import {
  nextStep,
  value,
  sources,
  makeSteps,
  find,
  type Bin,
} from "../src/engine";
import type { Session } from "../src/storage";
const KEY = "dangdang-math-camp-v1";
async function state(page: Page): Promise<Session> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).current,
    KEY,
  );
}
async function launch(
  page: Page,
  name: "开始闯关" | "开始合成" | "反过来练：把综合算式拆开 ↗" = "开始闯关",
  advanced = false,
) {
  await page.goto("/");
  await page.getByRole("button", { name }).click();
  if (advanced) await page.getByLabel(/进阶括号挑战/).check();
  await page.getByRole("button", { name: "选择关卡 →" }).click();
  await page.getByRole("button", { name: /运算新手村/ }).click();
}
async function finishMixed(page: Page) {
  for (let i = 0; i < 8; i++) {
    const s = await state(page);
    if (s.done) return;
    const next = nextStep(s.tree)!;
    await page.locator(`[data-op="${next.id}"]`).click();
    await page.getByLabel("这一步的结果").fill(String(value(next)));
    await page.getByRole("button", { name: "检查这一步 →" }).click();
  }
  throw new Error("mixed did not finish");
}
test("guided mixed calculation, errors, resume, rewards and real report", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page);
  let s = await state(page);
  let next = nextStep(s.tree)!;
  await page.locator(`[data-op="${next.id}"]`).click();
  await page.getByLabel("这一步的结果").fill(String(value(next) + 1));
  await page.getByRole("button", { name: "检查这一步 →" }).click();
  await expect(page.getByRole("status").first()).toContainText("再核对");
  await page.reload();
  await page.getByRole("button", { name: "继续上次训练 →" }).click();
  await finishMixed(page);
  await expect(
    page.getByRole("heading", { name: "又解开一道数学机关！" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "学习报告", exact: true }).click();
  await expect(page.getByText("基本计算", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).records.length,
      KEY,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
test("merge: select source, animate substitution, repair brackets, undo and finish", async ({
  page,
}) => {
  await launch(page, "开始合成", true);
  const s = await state(page),
    target = sources(s.tree)[0],
    step = makeSteps(s.question.original).find((x) => x.id === target.ref)!;
  await page.locator(`[data-target="${target.id}"]`).click();
  await page.locator(`[data-card="${step.id}"]`).click();
  await page.getByRole("button", { name: "不用括号，直接放入" }).click();
  await expect(
    page.getByRole("button", { name: "检查综合算式 ✓" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "检查综合算式 ✓" }).click();
  await expect(page.getByRole("status").first()).toContainText("括号");
  await page.getByRole("button", { name: "↶ 撤销上一步" }).click();
  await page.locator(`[data-target="${target.id}"]`).click();
  await page.locator(`[data-card="${step.id}"]`).click();
  await page.getByRole("button", { name: "加上括号再放入" }).click();
  await expect(
    page.getByRole("heading", { name: "又解开一道数学机关！" }),
  ).toBeVisible();
});
test("mobile touch drag to source target, click alternative and responsive layouts", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await launch(page, "开始合成");
  const s = await state(page),
    target = sources(s.tree)[0],
    step = makeSteps(s.question.original).find((x) => x.id === target.ref)!;
  const card = page.locator(`[data-card="${step.id}"]`),
    dest = page.locator(`[data-target="${target.id}"]`),
    a = (await card.boundingBox())!,
    b = (await dest.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: a.x + 20, y: a.y + 30 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "检查综合算式 ✓" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "又解开一道数学机关！" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-camp.png",
    fullPage: true,
    animations: "disabled",
  });
  await context.close();
});
test("split generates step cards and independent order is checked on submission", async ({
  page,
}) => {
  await launch(page, "反过来练：把综合算式拆开 ↗");
  await finishMixed(page);
  await expect(
    page.getByRole("heading", { name: "我拆出的分步算式" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "训练大厅", exact: true }).click();
  await page.getByRole("button", { name: "开始闯关" }).click();
  await page.getByRole("button", { name: /独立模式/ }).click();
  await page.getByRole("button", { name: "选择关卡 →" }).click();
  await page.getByRole("button", { name: /运算新手村/ }).click();
  const s = await state(page);
  await page.locator(`[data-op="${s.tree.id}"]`).click();
  await page.getByLabel("这一步的结果").fill("999");
  await page.getByRole("button", { name: "检查这一步 →" }).click();
  expect((await state(page)).errors.length).toBe(1);
});
test("home tablet and desktop, no fabricated stats", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(
    page.getByText("还没有练习记录，从你感兴趣的一关开始吧。"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-camp.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 820, height: 1180 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("cabin has working physical entrance and fast-list route", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4179/");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.locator("#gameShelfToggle").click();
  await expect(
    page.getByRole("link", { name: /数学思维训练营/ }),
  ).toHaveAttribute("href", "math-camp/");
  await page.screenshot({ path: "test-results/cabin-camp.png" });
  await page.locator("#campPrompt").click({ force: true });
  await expect(page).toHaveURL(/math-camp/);
  await expect(page.getByRole("button", { name: "开始合成" })).toBeVisible();
  expect(errors).toEqual([]);
});
