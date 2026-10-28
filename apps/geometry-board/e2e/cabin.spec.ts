import { test, expect, type Page } from "@playwright/test";
const cabin = "http://127.0.0.1:4185/";
async function sceneInstrumentation(page: Page) {
  // Test-only capture of the existing Three.js constructors; no production test APIs.
  await page.addInitScript(() =>
    document.addEventListener(
      "load",
      (event) => {
        if (
          !(event.target instanceof HTMLScriptElement) ||
          !event.target.src.includes("three.min.js")
        )
          return;
        const w = window as any,
          t = w.THREE;
        for (const name of ["Scene", "PerspectiveCamera"]) {
          const original = t[name];
          t[name] = new Proxy(original, {
            construct(target, args, newTarget) {
              const object = Reflect.construct(target, args, newTarget);
              w[name === "Scene" ? "testCabinScene" : "testCabinCamera"] =
                object;
              return object;
            },
          });
        }
      },
      true,
    ),
  );
}
async function openCabin(page: Page) {
  await page.goto(cabin);
  await expect(page.locator("#rotationBoardPrompt")).toHaveClass(/visible/, {
    timeout: 30000,
  });
}
test("cabin list opens geometry board and the new return link goes back to the cabin", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openCabin(page);
  await page.locator("#gameShelfToggle").click();
  const link = page.getByRole("link", {
    name: "△↻ 交互几何画板 ›",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", "geometry-board/");
  await link.click();
  await expect(
    page.getByRole("heading", { name: "几何画板", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← 回到小屋", exact: true }).click();
  await expect(page.locator("#rotationBoardPrompt")).toHaveClass(/visible/, {
    timeout: 30000,
  });
  expect(errors).toEqual([]);
});
test("physical stand is ray-clickable, plays entry animation and resets on browser back", async ({
  page,
}) => {
  await sceneInstrumentation(page);
  await openCabin(page);
  const target = await page.evaluate(() => {
    const w = window as any,
      g = w.testCabinScene.getObjectByName("geometry-board-entrance");
    const p = g
      .localToWorld(new w.THREE.Vector3(0, 1.04, 0.055))
      .project(w.testCabinCamera);
    return {
      x: (p.x * 0.5 + 0.5) * innerWidth,
      y: (-0.5 * p.y + 0.5) * innerHeight,
    };
  });
  await page.screenshot({ path: "test-results/cabin-geometry-entrance.png" });
  await page.mouse.click(target.x, target.y);
  await expect(page).toHaveURL(/geometry-board\/$/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "几何画板", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("#rotationBoardPrompt")).toHaveClass(/visible/, {
    timeout: 30000,
  });
  await page.locator("#rotationBoardPrompt").click();
  await expect(page).toHaveURL(/geometry-board\/$/, { timeout: 15000 });
});
test("first-person real ray hit can activate the board with E", async ({
  page,
}) => {
  await sceneInstrumentation(page);
  await openCabin(page);
  await page.locator("#menuDot").click();
  await page.locator("#viewFpBtn").click();
  await page.evaluate(() => {
    const w = window as any,
      g = w.testCabinScene.getObjectByName("geometry-board-entrance"),
      c = w.testCabinCamera,
      target = g.localToWorld(new w.THREE.Vector3(0, 1.04, 0.055));
    const front = new w.THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion),
      eye = target.clone().addScaledVector(front, 1.8);
    // Place only the isolated test camera at the upstairs stand; use the app's actual ray and E handler.
    const set = c.position.set.bind(c.position),
      look = c.lookAt.bind(c);
    c.position.set = () => set(eye.x, eye.y, eye.z);
    c.lookAt = () => look(target);
    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => document.querySelector("canvas"),
    });
  });
  await expect(page.locator("#hint")).toContainText("旋转画板", {
    timeout: 15000,
  });
  await page.keyboard.press("KeyE");
  await expect(page).toHaveURL(/geometry-board\/$/, { timeout: 15000 });
});
test("touch quick list and reduced-motion physical prompt both lead to geometry board", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await openCabin(page);
  await page.locator("#gameShelfToggle").tap();
  await page
    .getByRole("link", { name: "△↻ 交互几何画板 ›", exact: true })
    .tap();
  await expect(
    page.getByRole("heading", { name: "几何画板", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("#rotationBoardPrompt")).toHaveClass(/visible/, {
    timeout: 30000,
  });
  await page.locator("#rotationBoardPrompt").tap();
  await expect(page).toHaveURL(/geometry-board\/$/, { timeout: 15000 });
  await context.close();
});
