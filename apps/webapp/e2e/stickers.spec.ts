import { expect, test } from "@playwright/test";

test("a pressed button squishes to 0.92 and springs back", async ({ page }) => {
  await page.goto("/dev/stickers");
  const button = page.getByRole("button", { name: "بزن بریم" });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  const scale = () => button.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(await scale()).toBeCloseTo(0.92, 2);
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(await scale()).toBeCloseTo(1, 2);
});

test("a page inside tabs slides in 40 from its tab's side and does not fade", async ({ page }) => {
  await page.goto("/dev/stickers");
  const first = page.evaluate(
    () =>
      new Promise<{ x: number; opacity: string }>((resolve) => {
        const tick = () => {
          const moving = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"] > div')].find((el) => el.textContent?.includes("سوم"));
          if (!moving) return requestAnimationFrame(tick);
          resolve({ x: new DOMMatrix(getComputedStyle(moving).transform).m41, opacity: getComputedStyle(moving).opacity });
        };
        tick();
      }),
  );
  await page.getByRole("tab", { name: "سوم" }).click();
  const { x, opacity } = await first;
  // سوم comes after اول, so it is at the left in right-to-left: its page comes from the left, nearly all the 40 still to go.
  expect(x).toBeLessThan(-20);
  expect(x).toBeGreaterThanOrEqual(-40);
  expect(opacity).toBe("1");
  await page.waitForTimeout(800);
  expect(await page.getByRole("tabpanel").evaluate((el) => new DOMMatrix(getComputedStyle(el.firstElementChild!).transform).m41)).toBeCloseTo(0, 1);
});

test("the stickers are the board's: white borders, no outlines, straight cards", async ({ page }) => {
  await page.goto("/dev/stickers");
  const primary = page.getByRole("button", { name: "بزن بریم" });
  await expect(primary).toHaveCSS("background-color", "rgb(47, 53, 245)");
  await expect(primary).toHaveCSS("border-top-width", "5px");
  await expect(primary).toHaveCSS("border-top-color", "rgb(255, 255, 255)");
  await expect(primary).toHaveCSS("border-top-left-radius", "18px");
  await expect(primary).toHaveCSS("font-family", /yebeyt-title/);
  const card = page.getByText("یه کارت سفید");
  await expect(card).toHaveCSS("border-top-width", "5px");
  await expect(card).toHaveCSS("border-top-left-radius", "20px");
  await expect(card).toHaveCSS("box-shadow", /rgba\(20, 17, 43, 0\.18\) 0px 3px 10px 0px$/);
});
