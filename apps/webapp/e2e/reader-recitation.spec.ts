import { expect, test, type Page } from "@playwright/test";
import { audioTime, coupletInURL, openPoem, stubNetwork } from "./reader";

// The Ganjoor API, the audio and the timing are stubbed (see ./reader.ts): a silent WAV, and the timing file where couplet n starts at 2n seconds.

test.beforeEach(async ({ page }) => {
  await stubNetwork(page);
});

const play = (page: Page) => page.getByRole("button", { name: "پخش خوانش" }).first();

test("lists the poem's recitations, and plays the first from the couplet that is shown", async ({ page }) => {
  await openPoem(page, "?c=3");
  await play(page).click();
  const bar = page.getByRole("region", { name: "خوانش" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("با صدای فریدون فرح‌اندوز");
  // Couplet 3 starts 6 seconds in.
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(6);
  expect(await audioTime(page)).toBeLessThan(7.5);
  await expect(bar.getByRole("button", { name: "مکث" })).toBeVisible();

  await bar.getByRole("button", { name: "صدای دیگه" }).click();
  const voices = page.getByRole("dialog", { name: "صدای دیگه" });
  await expect(voices.getByRole("button")).toHaveText(["فریدون فرح‌اندوز", "امیرحسین شهپروصال", "بدون زمان‌بندی"]);
  await expect(voices.getByRole("button", { name: "فریدون فرح‌اندوز" })).toHaveAttribute("aria-pressed", "true");
});

test("the text follows the audio", async ({ page }) => {
  await openPoem(page, "?c=3");
  await play(page).click();
  // 6 s in, couplet 3: it moves to couplet 4 at 8 s.
  await expect.poll(() => coupletInURL(page), { timeout: 6000 }).toBe(4);
  await expect(page.getByRole("img", { name: "بیت ۵ از ۹" })).toBeVisible();
});

test("a change of couplet while it plays moves the audio there, and while it is paused too", async ({ page }) => {
  await openPoem(page, "?c=1");
  await play(page).click();
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => coupletInURL(page)).toBe(3);
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(6);
  expect(await audioTime(page)).toBeLessThan(7.8);

  await page.getByRole("button", { name: "مکث" }).first().click();
  const paused = await audioTime(page);
  const shown = coupletInURL(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => coupletInURL(page)).toBe(shown - 1);
  await expect.poll(() => audioTime(page)).toBeLessThan(paused - 1);
  expect(await page.evaluate(() => (window as unknown as { __audio: HTMLMediaElement }).__audio.paused)).toBe(true);
});

test("the whole poem plays from the couplet at the top, and picking a couplet seeks", async ({ page }) => {
  await openPoem(page, "?c=2&mode=scroll");
  await page.getByRole("button", { name: "بخون برام" }).click();
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(4);
  await expect(page.getByRole("button", { name: "مکث" }).first()).toBeVisible();
  await page.getByTestId("couplet-5").scrollIntoViewIfNeeded();
  await page.getByTestId("couplet-5").click();
  await expect(page).toHaveURL(/c=5$/);
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(10);
});

test("the seek bar moves the audio, and the clock shows the time read and left", async ({ page }) => {
  await openPoem(page, "?c=0");
  await play(page).click();
  const bar = page.getByRole("region", { name: "خوانش" });
  const slider = bar.getByRole("slider", { name: "جای پخش" });
  await expect(slider).toBeEnabled();
  await slider.focus();
  await page.keyboard.press("PageUp");
  await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(5);
  await expect(bar).toContainText("−۰:");
});

test("the lock screen gets the poem and the poet while it plays", async ({ page }) => {
  await openPoem(page, "?c=0");
  await play(page).click();
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe("غزل ۳");
  expect(await page.evaluate(() => navigator.mediaSession.metadata?.artist)).toBe("حافظ");
  expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe("playing");
});

test("a recitation that cannot play says «خوانش باز نشد»", async ({ page }) => {
  await page.route("https://i.ganjoor.net/**/*.mp3", (route) => route.fulfill({ status: 404, body: "" }));
  await openPoem(page, "?c=0");
  await play(page).click();
  await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("خوانش باز نشد");
  await expect(play(page)).toBeVisible();
});

test("without a recitation the play buttons are not there", async ({ page }) => {
  await page.route("https://api.ganjoor.net/**", (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await openPoem(page, "?c=0");
  await expect(page.getByRole("button", { name: "نگه دار" })).toBeVisible();
  await expect(page.getByRole("button", { name: "پخش خوانش" })).toHaveCount(0);
});
