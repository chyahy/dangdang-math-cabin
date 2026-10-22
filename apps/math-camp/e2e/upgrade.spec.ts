import { test, expect, type Page } from "@playwright/test";
import {
  parse,
  format,
  value,
  initialMerge,
  sources,
  makeSteps,
  getLegalNextSteps,
  type Expr,
} from "../src/engine";
import { defaultConfig, type Session } from "../src/storage";
const KEY = "dangdang-math-camp-v1";
async function current(page: Page): Promise<Session> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).current,
    KEY,
  );
}
async function seed(
  page: Page,
  text: string,
  module: "mixed" | "merge" = "mixed",
  mode: "guided" | "independent" = "guided",
) {
  const original = parse(text),
    config = { ...defaultConfig, module, mode, smartBrackets: true };
  const question = {
    id: "test-" + Math.random(),
    module,
    level: 5,
    original,
    text: format(original),
    answer: value(original),
  };
  const s: Session = {
    question,
    config,
    tree: module === "merge" ? initialMerge(original) : original,
    undo: [],
    redo: [],
    history: [],
    errors: [],
    hints: 0,
    selected: "",
    input: "",
    nextLine: "",
    startedAt: Date.now(),
    done: false,
    stars: 0,
    saved: false,
  };
  await page.goto("/");
  await page.evaluate(
    ({ key, s, config }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          records: [],
          current: s,
          config,
          sound: false,
          motion: true,
        }),
      ),
    { key: KEY, s, config },
  );
  await page.reload();
  await page.getByRole("button", { name: "继续上次训练 →" }).click();
  return s;
}
async function compute(page: Page, id: string) {
  const s = await current(page);
  const node = getLegalNextSteps(s.tree).find((n) => n.id === id)!;
  await page.locator(`[data-op="${id}"]`).click();
  await page.getByLabel("这一步的结果").fill(String(value(node)));
  await page.getByRole("button", { name: "检查这一步 →" }).click();
}
async function solveRest(page: Page) {
  for (let i = 0; i < 8; i++) {
    const s = await current(page);
    if (s.done) return;
    await compute(page, getLegalNextSteps(s.tree)[0].id);
  }
  throw new Error("not complete");
}
for (const order of ["left", "right"] as const)
  for (const mode of ["guided", "independent"] as const)
    test(`both bracket choices accepted: ${order} first / ${mode}`, async ({
      page,
    }) => {
      const s = await seed(page, "[(8+1)*(15/3)]+5*2", "mixed", mode),
        initial = getLegalNextSteps(s.tree),
        first = order === "left" ? initial[0] : initial[1];
      await compute(page, first.id);
      expect((await current(page)).errors).toEqual([]);
      await solveRest(page);
      const result = await current(page);
      expect(result.tree.kind === "num" && result.tree.value).toBe(55);
      expect(result.errors).toEqual([]);
      expect(result.hints).toBe(0);
      expect(result.stars).toBe(3);
      await expect(page.getByText(/鲁老师/)).toHaveCount(0);
    });
test("explicit hints highlight ALL eligible groups; outside product is rejected", async ({
  page,
}) => {
  const s = await seed(page, "[(8+1)*(15/3)]+5*2");
  await page.getByRole("button", { name: "✦ 查看提示" }).click();
  await expect(page.locator(".hint-legal")).toHaveCount(2);
  const outside = s.tree.kind === "bin" ? s.tree.right.id : "";
  await page.locator(`[data-op="${outside}"]`).click();
  expect((await current(page)).errors[0].type).toBe("parentheses");
  await expect(page.getByRole("status").first()).toContainText("括号");
});
test("square brackets change dynamically and mixed undo/redo restores tree and history", async ({
  page,
}) => {
  await seed(page, "100-[24+(18/3)]*2");
  await expect(page.getByLabel("当前算式")).toHaveText("100－[24＋(18÷3)]×2");
  let s = await current(page);
  await compute(page, getLegalNextSteps(s.tree)[0].id);
  await expect(page.getByLabel("当前算式")).toHaveText("100－(24＋6)×2");
  await page.getByRole("button", { name: "↶ 撤销上一步" }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("100－[24＋(18÷3)]×2");
  expect((await current(page)).history).toHaveLength(0);
  await page.getByRole("button", { name: "↷ 重做上一步" }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("100－(24＋6)×2");
  expect((await current(page)).history).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "继续上次训练 →" }).click();
  await solveRest(page);
  expect((await current(page)).stars).toBe(3);
});
test("three-step mouse dragging shows legal targets, rejects wrong source, snaps and auto-completes", async ({
  page,
}) => {
  await seed(page, "(12+8)*3-15", "merge");
  let s = await current(page),
    ref = sources(s.tree)[0],
    steps = makeSteps(s.question.original),
    source = steps.find((t) => t.id === ref.ref)!;
  const card = page.locator(`[data-card="${source.id}"]`),
    target = page.locator(`[data-target="${ref.id}"]`);
  let a = (await card.boundingBox())!,
    b = (await target.boundingBox())!;
  await page.mouse.move(a.x + 20, a.y + 30);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + 50, { steps: 3 });
  await expect(page.locator(".drop-legal")).toHaveCount(1);
  await expect(page.locator(".drag-preview")).toBeVisible();
  await page.mouse.move(b.x + b.width / 2, b.y - 16, { steps: 8 });
  await expect(page.locator(".drop-hover")).toHaveCount(1);
  await expect(page.locator(".drag-preview")).toHaveClass(/snapping/);
  await page.screenshot({
    path: "test-results/drag-snap.png",
    animations: "disabled",
  });
  await page.mouse.up();
  await expect(page.getByLabel("当前算式")).toHaveText("20来源1×3－15待确认");
  await page.getByRole("button", { name: "不需要括号", exact: true }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("20来源1×3－15＝45");
  expect((await current(page)).done).toBe(false);
  await page.getByRole("button", { name: "↶ 撤销上一步" }).click();
  await expect(page.getByLabel("当前算式")).toContainText("60");
  await page.getByRole("button", { name: "↷ 重做上一步" }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("20来源1×3－15＝45");
  s = await current(page);
  ref = sources(s.tree)[0];
  source = steps.find((t) => t.id === ref.ref)!;
  await page.locator(`[data-card="${source.id}"]`).click();
  await page.locator(`[data-target="${ref.id}"]`).press("Enter");
  await page.getByRole("button", { name: "需要加括号", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "又解开一道数学机关！" }),
  ).toBeVisible();
  await expect(page.getByLabel("当前算式")).toHaveText("(12＋8)×3－15＝45");
  expect((await current(page)).stars).toBe(3);
  await page.getByRole("button", { name: "↶ 撤销上一步" }).click();
  expect((await current(page)).done).toBe(false);
  await page.getByRole("button", { name: "↷ 重做上一步" }).click();
  await expect(
    page.getByRole("heading", { name: "又解开一道数学机关！" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).records.length,
      KEY,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  await expect(page.getByLabel("当前算式")).toContainText("60");
  expect(sources((await current(page)).tree)).toHaveLength(1);
});
test("equal numeric results cannot be replaced from the wrong source", async ({
  page,
}) => {
  const s = await seed(page, "(2+3)*(8-3)", "merge"),
    refs = sources(s.tree),
    steps = makeSteps(s.question.original),
    source = steps.find((t) => t.id === refs[0].ref)!;
  await page.locator(`[data-card="${source.id}"]`).click();
  await expect(page.locator(".drop-legal")).toHaveCount(1);
  await page.locator(`[data-target="${refs[1].id}"]`).click();
  await expect(page.getByRole("status").first()).toContainText("来源编号");
  expect((await current(page)).tree).toEqual(s.tree);
  expect((await current(page)).errors).toHaveLength(1);
  await page.screenshot({
    path: "test-results/wrong-source.png",
    animations: "disabled",
  });
});
test("student chooses parentheses after subtraction and division via keyboard alternative", async ({
  page,
}) => {
  for (const [text, expected] of [
    ["50-(6+4)", "50－(6＋4)＝40"],
    ["24/(4+2)", "24÷(4＋2)＝4"],
  ]) {
    const s = await seed(page, text, "merge"),
      ref = sources(s.tree)[0],
      source = makeSteps(s.question.original).find((t) => t.id === ref.ref)!;
    await page.locator(`[data-card="${source.id}"]`).press("Enter");
    await page.locator(`[data-target="${ref.id}"]`).press("Enter");
    await expect(page.locator(".answer-suffix")).toHaveCount(0);
    await page
      .getByRole("button", { name: "需要加括号", exact: true })
      .press("Enter");
    await expect(
      page.getByRole("heading", { name: "又解开一道数学机关！" }),
    ).toBeVisible();
    await expect(page.getByLabel("当前算式")).toHaveText(expected);
    await expect(
      page.getByRole("button", { name: "检查综合算式 ✓" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "加上括号再放入" }),
    ).toHaveCount(0);
  }
});
test("short phone screens auto-scroll during a four-card touch drag", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage();
  const s = await seed(page, "(12+8)*(9-4)-3", "merge"),
    target = sources(s.tree)[0],
    source = makeSteps(s.question.original).find((t) => t.id === target.ref)!;
  const card = page.locator(`[data-card="${source.id}"]`),
    dest = page.locator(`[data-target="${target.id}"]`);
  await card.scrollIntoViewIfNeeded();
  const a = (await card.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: a.x + 30, y: a.y + 35 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 200, y: 655 }],
  });
  await expect
    .poll(async () => {
      const b = await dest.boundingBox();
      return b!.y + b!.height;
    })
    .toBeLessThan(630);
  const b = (await dest.boundingBox())!;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => sources((await current(page)).tree).length)
    .toBe(2);
  expect((await current(page)).errors).toHaveLength(0);
  await page.getByRole("button", { name: "不需要括号", exact: true }).click();
  expect((await current(page)).pendingBracket).toBeUndefined();
  await context.close();
});

test("missing necessary brackets stays expanded for retry, including after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const s = await seed(page, "(15+19)*11", "merge"),
    ref = sources(s.tree)[0];
  await page.locator(`[data-card="${ref.ref}"]`).click();
  await page.locator(`[data-target="${ref.id}"]`).click();
  await expect(page.getByLabel("当前算式")).toHaveText("15＋19×11待确认");
  await expect(page.locator(".hint-legal")).toHaveText("15＋19");
  await page.getByRole("button", { name: "不需要括号", exact: true }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("15＋19×11待确认");
  await expect(page.getByRole("status").first()).toContainText("运算顺序");
  expect((await current(page)).errors[0].type).toBe("missing-bracket");
  await page.reload();
  await page.getByRole("button", { name: "继续上次训练 →" }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("15＋19×11待确认");
  await page.screenshot({
    path: "test-results/required-bracket-pending.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "需要加括号", exact: true }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("(15＋19)×11＝374");
  expect((await current(page)).stars).toBe(2);
  expect((await current(page)).actions?.map((a) => a.type)).toEqual([
    "source-correct",
    "bracket-missing",
    "bracket-required",
  ]);
  expect(errors).toEqual([]);
});

for (const add of [true, false])
  test(`optional brackets ${add ? "added" : "omitted"}: correct, 3 stars and honest report`, async ({
    page,
  }) => {
    const s = await seed(page, "12*3+5", "merge"),
      ref = sources(s.tree)[0];
    await page.locator(`[data-card="${ref.ref}"]`).press("Enter");
    await page.locator(`[data-target="${ref.id}"]`).press("Enter");
    await expect(page.getByLabel("当前算式")).toHaveText("12×3＋5待确认");
    await page
      .getByRole("button", {
        name: add ? "需要加括号" : "不需要括号",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("当前算式")).toHaveText(
      add ? "(12×3)＋5＝41" : "12×3＋5＝41",
    );
    if (add)
      await expect(page.getByRole("status").first()).toContainText("不扣星");
    const done = await current(page);
    expect(done.done).toBe(true);
    expect(done.stars).toBe(3);
    expect(done.errors).toEqual([]);
    expect(done.hints).toBe(0);
    await page.getByRole("button", { name: "学习报告", exact: true }).click();
    await expect(page.locator(".merge-report")).toContainText(
      "放对1次，放错0次",
    );
    await expect(page.locator(".merge-report")).toContainText(
      "正确1次，遗漏必要括号0次",
    );
    await expect(page.locator(".merge-report")).toContainText(
      `可省略括号多写了${add ? 1 : 0}次`,
    );
  });

test("four-card two-branch merge uses optional then required brackets, reset and dynamic square groups", async ({
  page,
}) => {
  await seed(page, "(8+16)*(9-4)+3", "merge");
  for (let i = 0; i < 3; i++) {
    const s = await current(page),
      target = sources(s.tree).at(-1)!;
    await page.locator(`[data-card="${target.ref}"]`).click();
    await page.locator(`[data-target="${target.id}"]`).click();
    await page.getByRole("button", { name: "需要加括号", exact: true }).click();
  }
  await expect(page.getByLabel("当前算式")).toHaveText(
    "[(8＋16)×(9－4)]＋3＝123",
  );
  const done = await current(page);
  expect(done.stars).toBe(3);
  expect(done.actions?.map((a) => a.type)).toEqual([
    "source-correct",
    "bracket-extra",
    "source-correct",
    "bracket-required",
    "source-correct",
    "bracket-required",
  ]);
  await page.getByRole("button", { name: "↶ 撤销上一步" }).click();
  expect((await current(page)).done).toBe(false);
  await page.getByRole("button", { name: "↷ 重做上一步" }).click();
  expect((await current(page)).stars).toBe(3);
  expect((await current(page)).actions).toHaveLength(6);
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  await expect(page.getByLabel("当前算式")).toHaveText("120来源3＋3＝123");
  expect((await current(page)).pendingBracket).toBeUndefined();
});
