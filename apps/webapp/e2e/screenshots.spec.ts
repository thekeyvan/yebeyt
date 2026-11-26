import { test } from "@playwright/test";

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
