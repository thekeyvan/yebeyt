import { expect, test } from "@playwright/test";
import { closeReader, coupletInAddress, deckCardWatched, expectReader, nextCouplet, openApp, todaysCouplet, watchDeckCard } from "./browse";

const couplet = (page: import("@playwright/test").Page) => page.getByTestId("daily-couplet");

test("home shows the date and today's couplet for the fixed day", async ({ page }) => {
  await openApp(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بیتِ امروز");
  await expect(page.getByTestId("date")).toHaveText("دوشنبه ۲ آذر");
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(todaysCouplet.text));
  await expect(couplet(page)).toContainText("حافظ");
  // The same all day: a reload shows the same couplet.
  await page.reload();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(todaysCouplet.text));
});

test("«رد کن» shows another couplet with «برگردون» to take it back, and the reject is kept for the day", async ({ page }) => {
  await openApp(page, "/");
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(todaysCouplet.text));
  await page.getByRole("button", { name: "رد کن" }).click();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));
  await expect(page.getByText("امروز دیگه نشونت نمی‌دیم")).toBeVisible();

  await page.reload();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));

  await page.getByRole("button", { name: "رد کن" }).click();
  await expect(couplet(page)).not.toHaveAccessibleName(new RegExp(nextCouplet.text));
  await page.getByRole("button", { name: "برگردون" }).click();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));
});

test("taking a reject back brings today's first couplet again", async ({ page }) => {
  await openApp(page, "/");
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(todaysCouplet.text));
  await page.getByRole("button", { name: "رد کن" }).click();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));
  await page.getByRole("button", { name: "برگردون" }).click();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(todaysCouplet.text));
});

test("«نگه دار» keeps the couplet, and it is still kept after a reload", async ({ page }) => {
  await openApp(page, "/");
  const keep = page.getByRole("button", { name: "نگه دار" });
  await expect(keep).toHaveAttribute("aria-pressed", "false");
  await keep.click();
  await expect(keep).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(couplet(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
  // The divan the reader keeps is the same one.
  const divan = await page.evaluate(() => JSON.parse(localStorage.getItem("reader.divan") ?? "[]") as { key: string }[]);
  expect(divan.map((item) => item.key)).toEqual([`${todaysCouplet.path}#${todaysCouplet.index}`]);
});

test("the couplet opens the reader at it, rising over home, and closing returns to home", async ({ page }) => {
  await openApp(page, "/");
  await couplet(page).click();
  await expect(page).toHaveURL(new RegExp(`${todaysCouplet.path}\\?c=${todaysCouplet.index}`));
  await expectReader(page, "غزل ۱۲۱");
  expect(coupletInAddress(page)).toBe(todaysCouplet.index);
  // Home is still under the reader.
  await expect(page.locator("[inert]").first()).toBeAttached();
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(couplet(page)).toBeVisible();
});

test("a card thrown away flies off to the side", async ({ page }) => {
  await openApp(page, "/");
  await expect(couplet(page)).toBeVisible();
  await watchDeckCard(page);
  await page.getByRole("button", { name: "رد کن" }).click();
  await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));
  await page.waitForTimeout(500);
  const { farthest } = await deckCardWatched(page);
  expect(farthest).toBeGreaterThan(150);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a card thrown away only fades: it never moves", async ({ page }) => {
    await openApp(page, "/");
    await expect(couplet(page)).toBeVisible();
    await watchDeckCard(page);
    await page.getByRole("button", { name: "رد کن" }).click();
    await expect(couplet(page)).toHaveAccessibleName(new RegExp(nextCouplet.text));
    await page.waitForTimeout(500);
    const { farthest, dimmest } = await deckCardWatched(page);
    expect(farthest).toBe(0);
    expect(dimmest).toBeLessThan(1);
  });
});
