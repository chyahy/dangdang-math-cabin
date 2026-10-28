import { test, expect, type Page } from "@playwright/test";
import { distance, rotate } from "../src/geometry";
const point = (page: Page, label: string) =>
  page.locator(`[data-point][data-label="${label}"]`);
async function position(page: Page, label: string) {
  const p = point(page, label);
  const x = Number(await p.getAttribute("data-world-x")),
    y = Number(await p.getAttribute("data-world-y"));
  return { x, y };
}
async function center(page: Page, label: string) {
  const b = await point(page, label).locator("circle").last().boundingBox();
  return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
}
async function clickPoint(page: Page, label: string) {
  const p = await center(page, label);
  await page.mouse.click(p.x, p.y);
}
async function drawPoints(page: Page, offsets: number[][]) {
  await page.getByRole("button", { name: "点工具", exact: true }).click();
  const b = (await page.getByRole("application").boundingBox())!;
  for (const [x, y] of offsets) await page.mouse.click(b.x + x, b.y + y);
}
async function triangle(page: Page) {
  await drawPoints(page, [
    [180, 240],
    [360, 240],
    [280, 100],
  ]);
  await page.getByRole("button", { name: "三角形工具" }).click();
  for (const l of ["A", "B", "C"]) await clickPoint(page, l);
}
async function loadExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "加载例5", exact: true }).click();
}
test("free drawing -> select triangle -> center A -> 30 then 60 then 90, cancel, confirm and undo/redo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await triangle(page);
  await expect(page.getByTestId("selected-name")).toHaveText("△ABC");
  const before = await Promise.all(
    ["A", "B", "C"].map((l) => position(page, l)),
  );
  await page.getByRole("button", { name: "旋转工具", exact: true }).click();
  await clickPoint(page, "A");
  await page.getByLabel("旋转角度", { exact: true }).fill("30");
  await page.getByLabel("旋转角度", { exact: true }).fill("60");
  await expect(page.locator("[data-rotation-handle]")).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator("[data-rotation-handle]")).toHaveCount(0);
  await expect(page.locator("[data-point]")).toHaveCount(3);
  await page.getByRole("button", { name: "旋转工具", exact: true }).click();
  await clickPoint(page, "A");
  await page.getByLabel("旋转角度", { exact: true }).fill("90");
  await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    expect(await position(page, ["A", "B", "C"][i])).toEqual(before[i]);
    const expected = rotate(before[i], before[0], 90),
      actual = await position(page, ["A′", "B′", "C′"][i]);
    expect(distance(expected, actual)).toBeLessThan(1e-8);
  }
  await page.getByRole("button", { name: "↶ 撤销", exact: true }).click();
  await expect(page.locator("[data-point]")).toHaveCount(3);
  await page.getByRole("button", { name: "↷ 重做", exact: true }).click();
  await expect(page.locator("[data-point]")).toHaveCount(6);
  expect(errors).toEqual([]);
});
test("polygon selection from existing vertices and mouse handle rotation remain accurate after zoom/pan", async ({
  page,
}) => {
  await page.goto("/");
  await drawPoints(page, [
    [130, 250],
    [330, 240],
    [350, 100],
    [170, 90],
  ]);
  await page.getByRole("button", { name: "多边形工具" }).click();
  for (const l of ["A", "B", "C", "D", "A"]) await clickPoint(page, l);
  // Deselect the quadrilateral so rotate enters the vertex-combination flow.
  await page.getByRole("button", { name: "选择工具", exact: true }).click();
  const box = (await page.getByRole("application").boundingBox())!;
  await page.mouse.click(box.x + 50, box.y + 60);
  await page.getByRole("button", { name: "旋转工具", exact: true }).click();
  for (const l of ["A", "B", "D"]) await clickPoint(page, l);
  await expect(page.getByTestId("selected-name")).toHaveText("△ABD");
  await page.getByRole("button", { name: "完成选择并指定中心" }).click();
  await clickPoint(page, "D");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -230);
  await page.getByRole("button", { name: "平移工具" }).click(); // Should not silently abandon active rotation.
  await expect(page.getByRole("status")).toContainText("确认或取消");
  const c = await center(page, "D"),
    handle = (await page.locator("[data-rotation-handle]").boundingBox())!,
    start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    dx = start.x - c.x,
    dy = start.y - c.y;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dy, c.y - dx, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByLabel("旋转角度", { exact: true })).toHaveValue("90");
  const before = await Promise.all(
    ["A", "B", "D"].map((l) => position(page, l)),
  );
  await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  for (let i = 0; i < 3; i++)
    expect(
      distance(
        await position(page, ["A′", "B′", "D′"][i]),
        rotate(before[i], before[2], 90),
      ),
    ).toBeLessThan(1e-8);
});
test("example5 satisfies givens, rotates A onto C, preserves originals and permits auxiliary segments", async ({
  page,
}) => {
  await loadExample(page);
  await expect(page.getByText("✓ 当前三个已知条件均成立")).toBeVisible();
  await expect(page.getByText("题干待核对", { exact: true })).toBeVisible();
  const original = await position(page, "A"),
    c = await position(page, "C");
  await page.getByRole("button", { name: "选择△ABD", exact: true }).click();
  await page
    .getByRole("button", { name: "以D为旋转中心", exact: true })
    .click();
  await page
    .getByRole("button", { name: "旋转60°（顺时针）", exact: true })
    .click();
  await page.getByLabel("旋转角度", { exact: true }).fill("30");
  await page.getByLabel("旋转角度", { exact: true }).fill("60");
  await expect(page.getByText("A′ = C", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  expect(distance(await position(page, "A′"), c)).toBeLessThan(1e-8);
  expect(await position(page, "A")).toEqual(original);
  await page.getByRole("button", { name: "线段工具", exact: true }).click();
  await clickPoint(page, "B");
  await clickPoint(page, "B′");
  await expect(page.locator("[data-shape]")).toHaveCount(4);
});
test("drag updates linked lines, invalidates givens and never forces coincidence; one undo restores drag", async ({
  page,
}) => {
  await loadExample(page);
  const a = await center(page, "A"),
    old = await position(page, "A");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 50, a.y - 15, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByText("! 原图已改变，已知条件不再全部成立"),
  ).toBeVisible();
  const edited = await position(page, "A");
  expect(edited.x).not.toBe(old.x);
  await page.getByRole("button", { name: "选择△ABD", exact: true }).click();
  await page
    .getByRole("button", { name: "以D为旋转中心", exact: true })
    .click();
  await page
    .getByRole("button", { name: "旋转60°（顺时针）", exact: true })
    .click();
  await expect(page.getByText("A′ = C", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "↶ 撤销", exact: true }).click();
  expect(await position(page, "A")).toEqual(old);
});
test("point reuse, source selection by shape click, deletion, local save and restore", async ({
  page,
}) => {
  await page.goto("/");
  await triangle(page);
  await page.getByRole("button", { name: "点工具", exact: true }).click();
  await clickPoint(page, "A");
  await expect(page.locator("[data-point]")).toHaveCount(3);
  await page.getByRole("button", { name: "选择工具", exact: true }).click();
  const shape = page.locator("[data-shape]").first(),
    polygon = shape.locator("polygon").first();
  const b = (await polygon.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.7);
  await expect(page.getByTestId("selected-name")).toHaveText("△ABC");
  await page.getByRole("button", { name: "本地保存", exact: true }).click();
  await page.reload();
  await expect(page.locator("[data-point]")).toHaveCount(3);
  await expect(page.locator("[data-shape]")).toHaveCount(1);
  await page.getByRole("button", { name: "删除工具", exact: true }).click();
  await clickPoint(page, "A");
  await expect(page.locator("[data-point]")).toHaveCount(2);
  await expect(page.locator("[data-shape]")).toHaveCount(0);
  await page.getByRole("button", { name: "↶ 撤销", exact: true }).click();
  await expect(page.locator("[data-point]")).toHaveCount(3);
  await expect(page.locator("[data-shape]")).toHaveCount(1);
});
test("SVG PNG export and JSON round trip, invalid import is non-destructive", async ({
  page,
}) => {
  await loadExample(page);
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出PNG", exact: true }).click();
  const image = await png;
  expect(image.suggestedFilename()).toMatch(/\.png$/);
  const stream = await image.createReadStream();
  const bytes: Buffer[] = [];
  for await (const chunk of stream!) bytes.push(Buffer.from(chunk));
  const data = Buffer.concat(bytes);
  expect(data.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(data.length).toBeGreaterThan(5000);
  await page.locator("summary").click();
  const json = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存JSON", exact: true }).click();
  const file = await json,
    path = (await file.path())!;
  await page.getByRole("button", { name: "＋ 新建画板", exact: true }).click();
  await expect(page.locator("[data-point]")).toHaveCount(0);
  await page.getByLabel("加载JSON文件", { exact: true }).setInputFiles(path);
  await expect(page.locator("[data-point]")).toHaveCount(4);
  await expect(page.locator("[data-shape]")).toHaveCount(2);
  await page.getByLabel("加载JSON文件", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("status")).toContainText("加载失败");
  await expect(page.locator("[data-point]")).toHaveCount(4);
});
test("clockwise slider, zoom anchor, canvas pan and cleanup on pointer release outside canvas", async ({
  page,
}) => {
  await loadExample(page);
  const before = await position(page, "A"),
    p = await center(page, "A"),
    box = (await page.getByRole("application").boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 110);
  await page.mouse.up();
  const after = await center(page, "A");
  expect(after.x - p.x).toBeCloseTo(70, 0);
  expect(after.y - p.y).toBeCloseTo(40, 0);
  expect(await position(page, "A")).toEqual(before);
  await page.getByRole("button", { name: "选择△ABD", exact: true }).click();
  await page
    .getByRole("button", { name: "以D为旋转中心", exact: true })
    .click();
  await page.getByRole("button", { name: "↻ 顺时针", exact: true }).click();
  await page.getByLabel("旋转角度滑块", { exact: true }).fill("90");
  await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  expect(
    distance(await position(page, "A′"), rotate(before, { x: 0, y: 0 }, -90)),
  ).toBeLessThan(1e-8);
});
test("mobile and tablet: touch point creation, portrait/landscape sizing and pinch-pan", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "点工具", exact: true }).click();
  const first = (await page.getByRole("application").boundingBox())!;
  await page.touchscreen.tap(first.x + 120, first.y + 140);
  await expect(page.locator("[data-point]")).toHaveCount(1);
  await page.getByRole("button", { name: "加载例5", exact: true }).click();
  const svg = page.getByRole("application");
  await svg.scrollIntoViewIfNeeded();
  const b = (await svg.boundingBox())!,
    dBefore = await center(page, "D");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: b.x + 100, y: b.y + 150 },
      { id: 2, x: b.x + 200, y: b.y + 250 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: b.x + 110, y: b.y + 155 },
      { id: 2, x: b.x + 250, y: b.y + 295 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => distance(await center(page, "D"), dBefore))
    .toBeGreaterThan(1);
  await expect(page.locator("[data-point]")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
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
  await page.screenshot({
    path: "test-results/tablet-board.png",
    fullPage: true,
  });
  await context.close();
});

test("pointer release outside canvas never leaves dragging active; blur rolls back an unfinished drag", async ({
  page,
}) => {
  await loadExample(page);
  let p = await center(page, "A");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(30, 30, { steps: 8 });
  await page.mouse.up();
  const released = await position(page, "A");
  await page.mouse.move(480, 360, { steps: 8 });
  expect(await position(page, "A")).toEqual(released);
  await page.keyboard.press("Control+z");
  await expect(page.getByText("✓ 当前三个已知条件均成立")).toBeVisible();
  const original = await position(page, "A");
  p = await center(page, "A");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 40, p.y + 30);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect(await position(page, "A")).toEqual(original);
  await page.mouse.move(300, 200);
  expect(await position(page, "A")).toEqual(original);
});

test("repeated copies have accurate prime labels; in-place rotation is explicit; deleting a temporary selection preserves geometry", async ({
  page,
}) => {
  await loadExample(page);
  await page.getByRole("button", { name: "选择△ABD", exact: true }).click();
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-point]")).toHaveCount(4);
  await expect(page.locator("[data-shape]")).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "选择△ABD", exact: true }).click();
    await page
      .getByRole("button", { name: "以D为旋转中心", exact: true })
      .click();
    await page
      .getByRole("button", { name: "旋转60°（顺时针）", exact: true })
      .click();
    await expect(
      page.getByText(i === 0 ? "A′ = C" : "A′′ = C", { exact: true }),
    ).toBeVisible();
    if (i === 1)
      await page
        .getByRole("checkbox", { name: "复制后旋转", exact: true })
        .uncheck();
    await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  }
  await expect(page.locator("[data-point]")).toHaveCount(7);
  expect(
    distance(await position(page, "A"), await position(page, "C")),
  ).toBeLessThan(1e-8);
});

test("an arbitrary blank-canvas rotation center works with exact typed angles", async ({
  page,
}) => {
  await page.goto("/");
  await triangle(page);
  const a = await position(page, "A"),
    box = (await page.getByRole("application").boundingBox())!;
  await page.getByRole("button", { name: "旋转工具", exact: true }).click();
  await page.mouse.click(box.x + 500, box.y + 300);
  const center = {
    x: (500 - box.width / 2) / 55,
    y: -(300 - box.height / 2) / 55,
  };
  await page.getByLabel("旋转角度", { exact: true }).fill("90");
  await page.getByRole("button", { name: "确认旋转", exact: true }).click();
  expect(
    distance(await position(page, "A′"), rotate(a, center, 90)),
  ).toBeLessThan(1e-8);
});
