import { expect, test } from "@playwright/test";
import { coupletInURL, drag, openPoem, poem, stubNetwork } from "./reader";

test.beforeEach(async ({ page }) => {
  await stubNetwork(page);
});

test("opens at the couplet in the address, with the title, the book and the progress", async ({ page }) => {
  await openPoem(page, "?c=2");
  await expect(page.getByTestId("reader-subtitle")).toHaveText("حافظ · غزلیات");
  await expect(page.getByRole("img", { name: "بیت ۳ از ۹" })).toBeVisible();
  await expect(page.getByTestId("couplet-2")).toBeInViewport();
  await expect(page.getByTestId("couplet-2")).toContainText("لولیان");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.title()).resolves.toBe("حافظ · غزل ۳ · یه بیت");
});

test("the first hemistich is at the right and the second at the left, and nothing scrolls sideways", async ({ page }) => {
  await openPoem(page, "?c=1");
  // Where the words of each line are (not the box of the line, which is as wide as the couplet).
  const centres = await page.getByTestId("couplet-1").evaluate((couplet) =>
    [...couplet.children].map((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const { left, width } = range.getBoundingClientRect();
      return left + width / 2;
    }),
  );
  expect(centres[0]).toBeGreaterThan(centres[1]!);
  for (const query of ["?c=1", "?c=1&mode=scroll"]) {
    await page.goto(`${poem}${query}`);
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }
});

test("← is the next couplet and → the one before, and the address follows", async ({ page }) => {
  await openPoem(page, "?c=2");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => coupletInURL(page)).toBe(3);
  await expect(page.getByRole("img", { name: "بیت ۴ از ۹" })).toBeVisible();
  await expect(page.getByTestId("couplet-3")).toBeInViewport();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => coupletInURL(page)).toBe(1);
  await expect(page.getByTestId("couplet-1")).toBeInViewport();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => coupletInURL(page)).toBe(2);
});

test("the buttons beside the page turn it for a mouse, and are not there on a phone", async ({ page }) => {
  await openPoem(page, "?c=2");
  const next = page.getByRole("button", { name: "بیت بعدی" });
  if (page.viewportSize()!.width < 768) return expect(next).toBeHidden();
  await next.click();
  await expect.poll(() => coupletInURL(page)).toBe(3);
  await page.getByRole("button", { name: "بیت قبلی" }).click();
  await expect.poll(() => coupletInURL(page)).toBe(2);
});

test("a swipe up goes to the next couplet and a swipe down to the one before, as the page scrolls on iOS", async ({ page, browserName }) => {
  await openPoem(page, "?c=2");
  const { width, height } = page.viewportSize()!;
  const x = width / 2;
  await drag(page, browserName, { x, y: height * 0.7 }, { x, y: height * 0.3 });
  await expect.poll(() => coupletInURL(page)).toBe(3);
  await expect(page.getByTestId("couplet-3")).toBeInViewport();
  await drag(page, browserName, { x, y: height * 0.3 }, { x, y: height * 0.7 });
  await expect.poll(() => coupletInURL(page)).toBe(2);
  await drag(page, browserName, { x, y: height * 0.3 }, { x, y: height * 0.7 });
  await expect.poll(() => coupletInURL(page)).toBe(1);
});

test("the whole poem and back keep the couplet; a tap picks one", async ({ page }) => {
  await openPoem(page, "?c=3");
  await page.getByRole("radio", { name: "کل شعر" }).click();
  await expect(page).toHaveURL(/c=3&mode=scroll/);
  await expect(page.getByTestId("couplet-3")).toBeInViewport();
  // The couplet at the top is the one that was shown.
  const top = (await page.getByTestId("couplet-3").boundingBox())!.y;
  expect(top).toBeLessThan(page.viewportSize()!.height / 2);
  await page.getByRole("radio", { name: "بیت به بیت" }).click();
  await expect(page).toHaveURL(/c=3$/);
  await expect(page.getByTestId("couplet-3")).toBeInViewport();

  await page.getByRole("radio", { name: "کل شعر" }).click();
  await page.getByTestId("couplet-4").click();
  await expect(page).toHaveURL(/c=4$/);
  await expect(page.getByRole("img", { name: "بیت ۵ از ۹" })).toBeVisible();
  await expect(page.getByTestId("couplet-4")).toBeInViewport();
});

test("in the whole poem a couplet is a button: Enter and Space pick it", async ({ page }) => {
  await openPoem(page, "?c=0&mode=scroll");
  await page.getByTestId("couplet-2").focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/c=2$/);
  await page.getByRole("radio", { name: "کل شعر" }).click();
  await page.getByTestId("couplet-3").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/c=3$/);
});

test("scrolling the whole poem changes the couplet the actions act on, and it is the one kept", async ({ page }) => {
  await openPoem(page, "?c=0&mode=scroll");
  await page.getByTestId("couplet-0").evaluate((row) => {
    for (let list = row.parentElement; list; list = list.parentElement) if (list.scrollHeight > list.clientHeight && getComputedStyle(list).overflowY === "auto") return list.scrollBy(0, 500);
  });
  await expect.poll(() => coupletInURL(page)).toBeGreaterThan(0);
  const top = coupletInURL(page);
  await page.getByRole("button", { name: "نگه دار" }).click();
  await page.getByRole("radio", { name: "بیت به بیت" }).click();
  await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
  expect(coupletInURL(page)).toBe(top);
});

test("the header stays put while the couplets change", async ({ page }) => {
  await openPoem(page, "?c=0");
  const before = (await page.getByTestId("reader-title").boundingBox())!;
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => coupletInURL(page)).toBe(1);
  await page.getByRole("radio", { name: "کل شعر" }).click();
  expect(await page.getByTestId("reader-title").boundingBox()).toEqual(before);
});
