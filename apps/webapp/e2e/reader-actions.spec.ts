import { expect, test } from "@playwright/test";
import { afterPaint, copied, coupletInURL, openPoem, stubNetwork } from "./reader";

test.beforeEach(async ({ page }) => {
  await stubNetwork(page);
});

test.describe("the «آ» sheet", () => {
  test("a font chosen shows at once, and stays after a reload", async ({ page }) => {
    await openPoem(page, "?c=1");
    const couplet = page.getByTestId("couplet-1");
    await expect(couplet).toHaveCSS("font-family", /yebeyt-poem/);
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    const sheet = page.getByRole("dialog", { name: "متن" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "گندم" }).click();
    await expect(sheet.getByRole("radio", { name: "گندم" })).toHaveAttribute("aria-checked", "true");
    await expect(couplet).toHaveCSS("font-family", /yebeyt-gandom/);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("reader.textSettings")))!).font).toBe("gandom");
    await sheet.getByRole("button", { name: "تمام" }).click();
    await expect(sheet).toBeHidden();

    await page.reload();
    await expect(page.getByTestId("couplet-1")).toHaveCSS("font-family", /yebeyt-gandom/);
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    await expect(page.getByRole("radio", { name: "گندم" })).toHaveAttribute("aria-checked", "true");
  });

  test("has the board's defaults and ranges, and the size, spacing, layout and theme change the page", async ({ page }) => {
    await openPoem(page, "?c=1");
    const couplet = page.getByTestId("couplet-1");
    await expect(couplet).toHaveCSS("font-size", "21px");
    await expect.poll(() => couplet.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight))).toBeCloseTo(44.1, 1);
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    const sheet = page.getByRole("dialog", { name: "متن" });
    const slider = sheet.getByRole("slider", { name: "اندازه‌ی حروف" });
    await expect(slider).toHaveAttribute("min", "15");
    await expect(slider).toHaveAttribute("max", "25");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(couplet).toHaveCSS("font-size", "25px");
    await page.keyboard.press("Home");
    await expect(couplet).toHaveCSS("font-size", "15px");

    await sheet.getByRole("radio", { name: "کم" }).click();
    await expect.poll(() => couplet.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight))).toBeCloseTo(22.5, 1);
    await sheet.getByRole("radio", { name: "وسط‌چین" }).click();
    await expect(couplet.locator("> div").first()).toHaveCSS("text-align", "center");
    await sheet.getByRole("radio", { name: "تیره" }).click();
    await expect(page.getByTestId("reader")).toHaveCSS("background-color", "rgb(20, 17, 43)");
    await expect(sheet.getByRole("radio", { name: "معمولی" }).first()).toBeVisible();
  });

  test("the weight can only be chosen for Parastoo", async ({ page }) => {
    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    const sheet = page.getByRole("dialog", { name: "متن" });
    await sheet.getByRole("radio", { name: "پررنگ" }).waitFor();
    await sheet.getByRole("radiogroup", { name: "وزن قلم" }).getByRole("radio", { name: "معمولی" }).click();
    await expect(page.getByTestId("couplet-1")).toHaveCSS("font-family", /yebeyt-poem-regular/);
    await sheet.getByRole("radio", { name: "نسخ" }).click();
    await expect(sheet.getByRole("radiogroup", { name: "وزن قلم" })).toHaveAttribute("aria-disabled", "true");
  });

  test("while it is open only the couplet shows, at the top", async ({ page }) => {
    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    await page.getByRole("dialog", { name: "متن" }).waitFor();
    await expect(page.getByRole("button", { name: "پسند" })).toBeHidden();
    expect((await page.getByTestId("couplet-1").boundingBox())!.y).toBeLessThan(page.viewportSize()!.height / 2);
  });
});

test.describe("نگه دار", () => {
  test("keeps the couplet in the divan of this browser, which is still kept after a reload", async ({ page }) => {
    await openPoem(page, "?c=2");
    const keep = page.getByRole("button", { name: "نگه دار" });
    await expect(keep).toHaveAttribute("aria-pressed", "false");
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "true");
    const divan = JSON.parse((await page.evaluate(() => localStorage.getItem("reader.divan")))!);
    expect(divan).toEqual([{ key: "/hafez/ghazal/sh3#2", keptAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/) }]);

    await page.reload();
    await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
    // Another couplet is not kept.
    await afterPaint(page);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => coupletInURL(page)).toBe(3);
    await expect(page.getByTestId("couplet-3").locator("xpath=ancestor::div[@data-page]").getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "false");
  });

  test("takes it out at one tap, says so, and the toast's «برگردون» keeps it again", async ({ page }) => {
    await openPoem(page, "?c=2");
    await page.getByRole("button", { name: "نگه دار" }).click();
    await page.getByRole("button", { name: "نگه دار" }).click();
    await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "false");
    const toasts = page.getByRole("region", { name: "اعلان‌ها" });
    await expect(toasts).toContainText("از دیوانت برداشته شد");
    await toasts.getByRole("button", { name: "برگردون" }).click();
    await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
  });
});

test("بفرست uses the browser's share sheet with the couplet and the poet, and copies with a toast where there is none", async ({ page }) => {
  await openPoem(page, "?c=1");
  await page.getByRole("button", { name: "بفرست" }).click();
  await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("کپی شد");
  const text = await copied(page);
  expect(text).toMatch(/^بده ساقی[^\n]+\n[^\n]+\n— حافظ · غزل ۳\nyebeyt\.com$/);

  await page.evaluate(() => {
    (window as unknown as { __shared: unknown }).__shared = undefined;
    Object.defineProperty(navigator, "share", { value: async (data: unknown) => ((window as unknown as { __shared: unknown }).__shared = data), configurable: true });
  });
  await page.getByRole("button", { name: "بفرست" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: { text: string } }).__shared?.text)).toBe(text);
});

test("پسند and بازنشر open the account gate, which is one sheet with the reason in it", async ({ page }) => {
  await openPoem(page, "?c=1");
  await page.getByRole("button", { name: "پسند" }).click();
  const gate = page.getByRole("dialog", { name: /یه حساب لازمه/ });
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("برای پسند و بازنشر");
  await expect(gate).toContainText("با اپل یا گوگل، چند ثانیه طول می‌کشه.");
  await expect(gate.getByRole("button", { name: "ادامه با اپل" })).toBeDisabled();
  await expect(gate.getByRole("button", { name: "ادامه با گوگل" })).toBeDisabled();
  await expect(gate).toContainText("ورود روی وب به‌زودی");
  await gate.getByRole("button", { name: "بعداً" }).click();
  await expect(gate).toBeHidden();
  // Nothing was liked.
  await expect(page.getByRole("button", { name: "پسند" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "بازنشر" }).click();
  await expect(page.getByRole("dialog", { name: /یه حساب لازمه/ })).toContainText("برای پسند و بازنشر");
  await page.keyboard.press("Escape");
  await expect(gate).toBeHidden();
  // The reader is still open: the key went to the sheet.
  await expect(page.getByTestId("reader-title")).toBeVisible();
});

test.describe("the hold menu", () => {
  test("a right-click opens it with the couplet, its caption and the same items, and «کپی متن» copies", async ({ page }) => {
    await openPoem(page, "?c=1");
    await page.getByTestId("couplet-1").click({ button: "right" });
    const menu = page.getByRole("dialog", { name: "کارهای این بیت" });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("حافظ · غزل ۳ · بیت ۲");
    for (const name of ["پسند", "بازنشر", "بفرست", "نگه دار", "معنی این بیت", "بیت به بیت، از همین بیت", "بازی با این بیت", "به دیوان مشترک", "کپی متن"]) {
      await expect(menu.getByRole("button", { name })).toBeVisible();
    }
    await menu.getByRole("button", { name: "کپی متن" }).click();
    await expect(menu).toBeHidden();
    expect(await copied(page)).toMatch(/^بده ساقی[^\n]+\n[^\n]+\n— حافظ$/);
    await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("کپی شد");
  });

  test("a long press opens it too, and Escape closes it and not the reader", async ({ page }) => {
    await openPoem(page, "?c=1");
    const box = (await page.getByTestId("couplet-1").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const menu = page.getByRole("dialog", { name: "کارهای این بیت" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByTestId("reader-title")).toBeVisible();
  });

  test("the keyboard opens it on the focused couplet (the menu key, Shift+F10), focus goes into it and comes back", async ({ page }) => {
    await openPoem(page, "?c=1");
    const couplet = page.getByTestId("couplet-1");
    for (const key of ["ContextMenu", "Shift+F10"]) {
      await couplet.focus();
      await page.keyboard.press(key);
      const menu = page.getByRole("dialog", { name: "کارهای این بیت" });
      await expect(menu).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(couplet).toBeFocused();
    }
  });

  test("keeps from the menu without closing it, and the shared divan and the likes go to the gate", async ({ page }) => {
    await openPoem(page, "?c=1");
    await page.getByTestId("couplet-1").click({ button: "right" });
    const menu = page.getByRole("dialog", { name: "کارهای این بیت" });
    await menu.getByRole("button", { name: "نگه دار" }).click();
    await expect(menu.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
    await menu.getByRole("button", { name: "پسند" }).click();
    await expect(page.getByRole("dialog", { name: /یه حساب لازمه/ })).toContainText("برای پسند و بازنشر");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /یه حساب لازمه/ })).toBeHidden();
    await menu.getByRole("button", { name: "به دیوان مشترک" }).click();
    await expect(page.getByRole("dialog", { name: /یه حساب لازمه/ })).toContainText("برای پیام دادن به دوستات");
  });

  test("«معنی این بیت» and «بیت به بیت، از همین بیت» go to the couplet's page, from the whole poem too", async ({ page }) => {
    await openPoem(page, "?c=0&mode=scroll");
    await page.getByTestId("couplet-2").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "معنی این بیت" }).click();
    await expect(page).toHaveURL(/c=2$/);
    await expect(page.getByRole("region", { name: "معنی" })).toBeVisible();
  });
});

test.describe("the meaning card", () => {
  test("opens from «معنی این بیت», closes with its ×, and closes when the couplet changes", async ({ page }) => {
    await openPoem(page, "?c=1");
    await expect(page.getByRole("region", { name: "معنی" })).toBeHidden();
    await page.getByRole("button", { name: "معنی این بیت" }).click();
    const card = page.getByRole("region", { name: "معنی" });
    await expect(card).toContainText("ساقی");
    // The faint neighbours and the chip give way to the card.
    await expect(page.getByRole("button", { name: "معنی این بیت" })).toBeHidden();
    await card.getByRole("button", { name: "بستن معنی" }).click();
    await expect(card).toBeHidden();

    await page.getByRole("button", { name: "معنی این بیت" }).click();
    await expect(card).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(card).toBeHidden();
    await expect.poll(() => coupletInURL(page)).toBe(2);
  });

  test("opens at once with meaning=1, and a long one is cut at three lines with «بیشتر بخون»", async ({ page }) => {
    await openPoem(page, "?c=8&meaning=1");
    const card = page.getByRole("region", { name: "معنی" });
    await expect(card).toBeVisible();
    const more = card.getByRole("button", { name: "بیشتر بخون" });
    await expect(more).toBeVisible();
    const cut = (await card.locator("p").boundingBox())!.height;
    await more.click();
    await expect(more).toBeHidden();
    expect((await card.locator("p").boundingBox())!.height).toBeGreaterThan(cut);
  });

  test("a short one has no «بیشتر بخون», and no sparkle unless an AI wrote it", async ({ page }) => {
    await openPoem(page, "?c=4&meaning=1");
    const card = page.getByRole("region", { name: "معنی" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "بیشتر بخون" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "با کمک هوش مصنوعی" })).toHaveCount(0);
  });
});
