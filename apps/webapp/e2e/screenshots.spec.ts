import { test } from "@playwright/test";
import { openPoem, stubNetwork } from "./reader";

// Screenshots of the screens that prove the shell (not committed: e2e/__screenshots__ is ignored).
const shot = (name: string) => ({ path: `e2e/__screenshots__/${name}.png` });

test("home and the sticker page", async ({ page }, info) => {
  const { width, height } = page.viewportSize()!;
  const size = `${width}x${height}`;
  test.skip(!info.project.name.startsWith("chromium") || width === 390, "one browser, the two sizes of the brief");
  await page.goto("/");
  await page.screenshot(shot(`home-${size}`));
  await page.goto("/dev/stickers");
  await page.screenshot(shot(`stickers-${size}`));
});

test("a sheet open on the phone", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("chromium") || page.viewportSize()!.width !== 375, "the phone size of the brief");
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "باز کردن برگه" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot(shot("sheet-375x667"));
});

test.describe("the reader", () => {
  test.beforeEach(async ({ page }, info) => {
    const { width } = page.viewportSize()!;
    test.skip(!info.project.name.startsWith("chromium") || width === 390, "one browser, the two sizes of the brief");
    await stubNetwork(page);
  });

  test("couplet mode", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await openPoem(page, "?c=1");
    await page.waitForTimeout(500);
    await page.screenshot(shot(`reader-couplet-${width}x${height}`));
  });

  test("meaning, whole poem, hold menu, text sheet and player", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    test.skip(width > 375, "the boards are phone boards");
    const size = `${width}x${height}`;
    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "معنی این بیت" }).click();
    await page.waitForTimeout(1200);
    await page.screenshot(shot(`reader-meaning-${size}`));

    await openPoem(page, "?c=1&mode=scroll");
    await page.waitForTimeout(500);
    await page.screenshot(shot(`reader-whole-${size}`));
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot(shot(`reader-hold-${size}`));
    await page.keyboard.press("Escape");

    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    await page.getByRole("dialog", { name: "متن" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot(shot(`reader-text-${size}`));
    await page.getByRole("button", { name: "تمام" }).click();
    await page.getByRole("dialog", { name: "متن" }).waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "پخش خوانش" }).first().click();
    await page.getByRole("region", { name: "خوانش" }).waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot(shot(`reader-player-${size}`));
  });
});
