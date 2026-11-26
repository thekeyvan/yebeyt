import { expect, test, type Page } from "@playwright/test";

const OPEN = "باز کردن برگه";

async function openSheet(page: Page) {
  await page.goto("/dev/stickers");
  const trigger = page.getByRole("button", { name: OPEN });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "یه برگه" });
  await expect(sheet).toBeVisible();
  // Let it settle on its resting place before it is measured or dragged.
  await page.waitForTimeout(700);
  return { trigger, sheet };
}

/** A finger (Chromium: real touch events through the protocol) or, where the browser cannot, the mouse, from `from` to `to`. */
async function drag(page: Page, browserName: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 12;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(i)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
  await page.mouse.up();
}

test("the sheet is a bottom sheet on a phone and a centred dialog from 768 px", async ({ page }) => {
  const { width, height } = page.viewportSize()!;
  const { sheet } = await openSheet(page);
  const box = (await sheet.boundingBox())!;
  if (width >= 768) {
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
    expect(box.y).toBeGreaterThan(40);
    expect(box.y + box.height).toBeLessThan(height - 40);
  } else {
    expect(box.width).toBeCloseTo(width, 0);
    expect(box.y + box.height).toBeCloseTo(height, 0);
    await expect(page.getByTestId("grabber")).toBeVisible();
  }
});

test("Escape closes the sheet and focus goes back to what opened it", async ({ page }) => {
  const { trigger, sheet } = await openSheet(page);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("a tap on the dimmed page closes the sheet", async ({ page }) => {
  const { trigger, sheet } = await openSheet(page);
  await page.mouse.click(5, 5);
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("focus stays inside the sheet", async ({ page }) => {
  const { sheet } = await openSheet(page);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await sheet.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  }
});

test("a drag down closes the sheet, a drag up does not", async ({ page, browserName }) => {
  const { width } = page.viewportSize()!;
  test.skip(width >= 768, "a centred dialog is not dragged");
  const { trigger, sheet } = await openSheet(page);
  const top = (await sheet.boundingBox())!.y;
  const x = width / 2;

  await drag(page, browserName, { x, y: top + 30 }, { x, y: top - 150 });
  await page.waitForTimeout(600);
  await expect(sheet).toBeVisible();
  expect((await sheet.boundingBox())!.y).toBeGreaterThan(top - 60);

  const rest = (await sheet.boundingBox())!.y;
  await drag(page, browserName, { x, y: rest + 30 }, { x, y: rest + 330 });
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the sheet follows the finger down", async ({ page, browserName }) => {
  const { width } = page.viewportSize()!;
  test.skip(width >= 768 || browserName !== "chromium", "a touch drag held half way needs the protocol, on a phone");
  const { sheet } = await openSheet(page);
  const top = (await sheet.boundingBox())!.y;
  const cdp = await page.context().newCDPSession(page);
  const x = width / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: top + 30 }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: top + 30 + i * 10 }] });
  await page.waitForTimeout(100);
  const during = (await sheet.boundingBox())!.y;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(during - top).toBeGreaterThan(30);
  expect(during - top).toBeLessThan(90);
});

test("a short sheet does not scroll, and its grabber stays in view after a swipe up", async ({ page, browserName }) => {
  const { width, height } = page.viewportSize()!;
  test.skip(width >= 768, "a centred dialog has no grabber to swipe");
  const { sheet } = await openSheet(page);
  const scrolls = await sheet.evaluate((dialog) => [dialog, ...dialog.querySelectorAll("*")].filter((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== "visible").length);
  expect(scrolls).toBe(0);
  const top = (await sheet.boundingBox())!.y;
  await drag(page, browserName, { x: width / 2, y: top + 30 }, { x: width / 2, y: top - 150 });
  await page.waitForTimeout(600);
  await expect(page.getByTestId("grabber")).toBeInViewport();
  const rest = (await sheet.boundingBox())!;
  expect(rest.y + rest.height).toBeLessThanOrEqual(height + 1);
  expect(await sheet.evaluate((dialog) => dialog.scrollTop)).toBe(0);
});

test("the toast sits above the bar on a phone, and just above the edge beside the rail", async ({ page }) => {
  const { width, height } = page.viewportSize()!;
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "نشون بده" }).click();
  const toast = page.getByRole("region", { name: "اعلان‌ها" }).locator('[data-slot="toast"]');
  await expect(toast).toBeVisible();
  await page.waitForTimeout(700);
  const box = (await toast.boundingBox())!;
  expect(height - (box.y + box.height)).toBeCloseTo(width >= 1024 ? 18 : 96, -1);
});

test("the confirm sheet has the safe button on the right and the red one on the left", async ({ page }) => {
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "باز کردن پرسش" }).click();
  const sheet = page.getByRole("dialog", { name: "از دیوانت برداری؟" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(700);
  const safe = (await sheet.getByRole("button", { name: "نه" }).boundingBox())!;
  const red = (await sheet.getByRole("button", { name: "بردار" }).boundingBox())!;
  expect(safe.x).toBeGreaterThan(red.x + red.width - 1);
  expect(Math.abs(safe.width - red.width)).toBeLessThan(2);
  expect(Math.abs(safe.y - red.y)).toBeLessThan(2);

  await sheet.getByRole("button", { name: "بردار" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("برداشته شد");
});

test("the confirm sheet stacks its buttons, the safe one on top, when a label is too long for half the row", async ({ page }) => {
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "پرسش با نوشته‌ی بلند" }).click();
  const sheet = page.getByRole("dialog", { name: "همه‌اش پاک بشه؟" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(700);
  const safe = (await sheet.getByRole("button", { name: "نه، بمون" }).boundingBox())!;
  const red = (await sheet.getByRole("button", { name: "همه‌ی بیت‌های دیوانم را پاک کن" }).boundingBox())!;
  expect(safe.y + safe.height).toBeLessThanOrEqual(red.y);
  expect(Math.abs(safe.x - red.x)).toBeLessThan(2);
  expect(Math.abs(safe.width - red.width)).toBeLessThan(2);
});

test("everything a screen reader hears is Persian", async ({ page }) => {
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "با برگردون" }).click();
  await page.getByRole("button", { name: "باز کردن برگه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const labels = await page.locator("[aria-label], [aria-roledescription], [data-ui-sdk-announcer]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? el.getAttribute("aria-roledescription") ?? el.textContent ?? ""),
  );
  expect(labels.length).toBeGreaterThan(2);
  for (const label of labels) expect(label, label).not.toMatch(/[A-Za-z]/);
});

test("the toast's undo works", async ({ page }) => {
  await page.goto("/dev/stickers");
  const toasts = page.getByRole("region", { name: "اعلان‌ها" });
  await page.getByRole("button", { name: "با برگردون" }).click();
  await expect(toasts).toContainText("از دیوانت برداشته شد");
  await toasts.getByRole("button", { name: "برگردون" }).click();
  await expect(page.getByRole("status").filter({ hasText: "برگشت." })).toBeVisible();
  await expect(toasts).toBeHidden();
});
