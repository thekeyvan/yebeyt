import { expect, test, type Page } from "@playwright/test";
import { newId, noSidewaysScroll, openOnboarding, signInAs } from "./account";
import { todaysCouplet } from "./browse";
import { fillByTaps, savedStats } from "./games";

const onboarding = (page: Page) => page.getByTestId("onboarding");
const step = (page: Page, name: string) => expect(onboarding(page)).toHaveAttribute("data-step", name);
const kept = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

test("the first visit shows onboarding, the steps follow each other, and once it is skipped it never shows again", async ({ page }) => {
  await openOnboarding(page);
  await step(page, "welcome");
  await expect(onboarding(page)).toContainText("هر بیت، یه بازی.");
  await expect(onboarding(page)).toContainText("بدون حساب هم می‌شه شروع کرد");
  await page.getByTestId("onb-start").click();

  await step(page, "taste");
  await expect(onboarding(page)).toContainText("کدوم شاعرها رو دوست داری؟");
  await expect(onboarding(page).getByRole("img", { name: "مرحله‌ی ۱ از ۳، سلیقه" })).toBeVisible();
  await page.getByTestId("poet-hafez").click();
  await expect(page.getByTestId("poet-hafez")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("mood-love").click();
  await page.getByTestId("mood-longing").click();
  await page.getByTestId("mood-longing").click(); // a second tap takes it back
  expect(JSON.parse((await kept(page, "taste.poets"))!)).toEqual(["hafez"]);
  expect(JSON.parse((await kept(page, "taste.moods"))!)).toEqual(["love"]);
  await page.getByTestId("onb-next").click();

  await step(page, "game");
  await expect(onboarding(page)).toContainText("اولین بیتت رو بچسبون");
  await page.getByTestId("onb-skip").click(); // «رد شو»
  await step(page, "account");
  await expect(onboarding(page)).toContainText("امتیازت رو نگه داریم؟");
  await expect(page.getByTestId("onb-reward")).toHaveCount(0); // nothing was won
  await expect(onboarding(page)).toContainText("ایمیلت رو به هیچ‌کس نشون نمی‌دیم.");
  await page.getByTestId("onb-no-account").click();
  await expect(onboarding(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بیتِ امروز");
  expect(await kept(page, "onboarding.done")).toBe("true");

  await page.reload();
  await expect(page.getByTestId("daily-couplet")).toBeVisible();
  await expect(onboarding(page)).toHaveCount(0);
  await page.getByRole("navigation", { name: "تب‌ها" }).getByRole("link", { name: "کاوش" }).click();
  await page.getByRole("navigation", { name: "تب‌ها" }).getByRole("link", { name: "خونه" }).click();
  await expect(onboarding(page)).toHaveCount(0);
});

test("«رد شو» goes one step on from the taste step too, and a poem opened by its link has no onboarding", async ({ page }) => {
  await openOnboarding(page, "first", "/poem/hafez/ghazal/sh3");
  await expect(page.getByTestId("reader-title")).toBeVisible();
  await expect(onboarding(page)).toHaveCount(0);
  await page.goto("/");
  await step(page, "welcome");
  await page.getByTestId("onb-start").click();
  await page.getByTestId("onb-skip").click();
  await step(page, "game");
});

test("the poets picked in the taste step choose today's couplet", async ({ page }) => {
  await openOnboarding(page);
  await expect(page.getByTestId("daily-couplet")).toContainText("حافظ");
  await page.getByTestId("onb-start").click();
  await page.getByTestId("poet-khayyam").click(); // of the poets picked, only Khayyam's book is among the bundled ones the day's couplet comes from
  await page.getByTestId("onb-next").click();
  await step(page, "game");
  await expect(page.getByTestId("onb-progress")).toBeVisible(); // the deck has loaded: a press on the waiting screen's buttons could be lost as it is swapped
  await page.getByTestId("onb-skip").click();
  await step(page, "account");
  await page.getByTestId("onb-no-account").click();
  await expect(onboarding(page)).toHaveCount(0);
  await expect(page.getByTestId("daily-couplet")).toContainText("خیام");
});

test("the game: sticking the right words earns +۵۰, which the account step shows and the points keep", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  await openOnboarding(page, "game");
  await step(page, "game");
  await expect(page.getByTestId("jigsaw-card")).toBeVisible();
  await expect(page.getByTestId("onb-check")).toBeDisabled();
  await expect(page.getByTestId("onb-progress")).toContainText("تا درست،");
  await fillByTaps(page, "wrong");
  await page.getByTestId("onb-check").click();
  await expect(page.getByTestId("onb-progress")).toBeVisible();
  await expect(page.locator("[data-mark=wrong]").first()).toBeVisible(); // the wrong stickers are red for a moment…
  await expect(page.locator("[data-mark=wrong]")).toHaveCount(0); // …and go back to the sheet
  await fillByTaps(page, "right");
  await page.getByTestId("onb-check").click();
  await step(page, "account");
  await expect(page.getByTestId("onb-reward")).toHaveText("آفرین! +۵۰");
  expect((await savedStats(page)).points).toBe(50);
  expect(JSON.parse((await kept(page, "scores.unsent"))!)).toHaveLength(1); // the round waits for the sign-in
});

test("«از قبل حساب داری؟ وارد شو» goes to the account step; an account that has a username ends onboarding for good", async ({ page }) => {
  await openOnboarding(page);
  await page.getByTestId("onb-have-account").click();
  await step(page, "account");
  await signInAs(page, { id: newId(), username: "niloofar" });
  await expect(onboarding(page)).toHaveCount(0);
  expect(await kept(page, "onboarding.done")).toBe("true");
  await page.reload();
  await expect(page.getByTestId("daily-couplet")).toBeVisible();
  await expect(onboarding(page)).toHaveCount(0);
});

test("a new account picks its username, then the friends step shows its invite link; the round of the first game goes up with the account", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  await openOnboarding(page, "game");
  await fillByTaps(page, "right");
  await page.getByTestId("onb-check").click();
  await step(page, "account");
  const id = newId();
  await signInAs(page, { id, username: null, providerName: "نیلوفر", provider: "google" });
  await step(page, "username");
  await expect(page.getByTestId("provider-chip")).toHaveText("با گوگل وارد شدی");
  await expect(page.getByTestId("display-name")).toHaveValue("نیلوفر");
  await expect(page.getByTestId("username-done")).toBeDisabled();
  await page.getByTestId("username").fill("niloo.far");
  await expect(page.getByTestId("username-available")).toBeVisible();
  await page.getByTestId("username-done").click();
  await step(page, "friends");
  await expect(onboarding(page)).toContainText("دوستات رو پیدا کن");
  await expect(page.getByTestId("onb-invite")).toContainText("yebeyt.com/i/niloo.far");
  await page.getByTestId("onb-invite").click();
  await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("کپی شد");
  await page.getByTestId("onb-home").click();
  await expect(onboarding(page)).toHaveCount(0);
  // The onboarding round and the 50 points went to the account.
  await expect.poll(() => page.evaluate(async () => (await (await fetch("/api/v1/me/stats")).json()).totalPoints)).toBe(50);
});

test("«بعداً» on the friends step ends it", async ({ page }) => {
  await openOnboarding(page, "friends");
  await step(page, "friends");
  await page.getByTestId("onb-later").click();
  await expect(onboarding(page)).toHaveCount(0);
});

test("the account step keeps the buttons off and says «ورود روی وب به‌زودی» while the providers' ids are not set", async ({ page }) => {
  await openOnboarding(page, "account");
  await expect(page.getByRole("button", { name: "ادامه با اپل" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ادامه با گوگل" })).toBeDisabled();
  await expect(onboarding(page)).toContainText("ورود روی وب به‌زودی");
});

test.describe("on a phone", () => {
  test.beforeEach(({ page }) => {
    test.skip(page.viewportSize()!.width > 400, "the phone sizes");
  });

  test("every step fits, right to left, with no sideways scroll, and every button is at least 44 px", async ({ page }) => {
    const fits = async (name: string) => {
      await step(page, name);
      expect(await noSidewaysScroll(page), name).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const small = await onboarding(page)
        .getByRole("button")
        .evaluateAll((buttons) => buttons.filter((button) => button.getBoundingClientRect().height > 0 && button.getBoundingClientRect().height < 43.5).map((button) => button.textContent));
      expect(small, `${name}: buttons under 44 px`).toEqual([]);
    };
    await openOnboarding(page, "welcome");
    await fits("welcome");
    await page.getByTestId("onb-start").click();
    await fits("taste");
    await page.getByTestId("onb-next").click();
    await fits("game");
    await expect(page.getByTestId("onb-progress")).toBeVisible(); // the deck has loaded: the waiting screen's buttons are gone and a click on them could be lost
    await page.getByTestId("onb-skip").click();
    await fits("account");
    await signInAs(page, { id: newId(), username: null });
    await fits("username");
    await page.getByTestId("username").fill("niloo.far");
    await page.getByTestId("username-done").click();
    await fits("friends");
  });

  test("the welcome step needs no scrolling on a small phone, the compact rule at 667 high", async ({ page }) => {
    await openOnboarding(page, "welcome");
    await step(page, "welcome");
    const room = await page.getByTestId("onb-scroll").evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
    expect(room.scroll).toBeLessThanOrEqual(room.client);
    await expect(page.getByTestId("onb-start")).toBeInViewport();
    expect((await page.getByTestId("onb-start").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("at a large text size the sign-in buttons stay at the bottom and the rest can be scrolled to", async ({ page }) => {
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "24px")));
    await openOnboarding(page, "account");
    await step(page, "account");
    await expect(page.getByRole("button", { name: "ادامه با اپل" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "ادامه با گوگل" })).toBeInViewport();
    await page.getByTestId("onb-no-account").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("onb-no-account")).toBeInViewport();
    expect(await noSidewaysScroll(page)).toBe(true);
  });
});

test("the home that onboarding covered is the day's couplet", async ({ page }) => {
  await openOnboarding(page);
  await expect(page.getByTestId("daily-couplet")).toHaveAccessibleName(new RegExp(todaysCouplet.text));
});
