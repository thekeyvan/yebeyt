import { test, type Page } from "@playwright/test";
import { newId } from "./account";
import { openMe, openSettings, signInFromProfile, todayNumber } from "./me";

// Screenshots of the Me screens at the small phone, and the profile at the desktop (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web5-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

const stats = (day: number) => ({ points: 2480, solvedDays: Array.from({ length: 7 }, (_, back) => day - back), best: {}, daily: {} });

test.beforeEach(async ({ page }, info) => {
  const { width, height } = page.viewportSize()!;
  test.skip(!info.project.name.startsWith("chromium") || !((width === 375 && height === 667) || (width === 1280 && height === 800)), "one browser, the small phone and the desktop");
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("games.stats")) localStorage.setItem("games.stats", JSON.stringify(saved));
  }, stats(todayNumber));
});

const phoneOnly = (page: Page) => test.skip(page.viewportSize()!.width !== 375, "the phone's screens");

test("the profile of a guest and of a signed-in person, and the desktop", async ({ page }) => {
  const phone = page.viewportSize()!.width === 375;
  await openMe(page, "/me", { seed: true });
  await page.getByTestId("profile-couplet-/hafez/ghazal/sh1#0").waitFor();
  await settled(page);
  if (phone) await shot(page, "profile-guest");
  await signInFromProfile(page, { id: newId(), displayName: "نیلوفر" });
  await settled(page);
  await shot(page, phone ? "profile-signed-in" : "profile-1280");
});

test("the divan, the avatar and the badges", async ({ page }) => {
  phoneOnly(page);
  await openMe(page, "/me/divan", { seed: true });
  await page.getByTestId("divan-couplet-/hafez/ghazal/sh1#0").waitFor();
  await settled(page);
  await shot(page, "divan");
  await page.goto("/me/avatar");
  await page.getByTestId("avatar-draft").waitFor();
  await settled(page);
  await shot(page, "avatar");
  await page.goto("/me/badges");
  await page.getByTestId("badge-streak7").waitFor();
  await settled(page);
  await shot(page, "badges");
});

test("the invite, the settings with the delete question, and the privacy settings", async ({ page }) => {
  phoneOnly(page);
  await openMe(page, "/me", { seed: true });
  await signInFromProfile(page, { id: newId(), displayName: "نیلوفر" });
  await page.getByTestId("invite-friends").click();
  await page.getByTestId("invite-link").waitFor();
  await settled(page);
  await shot(page, "invite");
  await page.goto("/me");
  await openSettings(page);
  await settled(page);
  await shot(page, "settings");
  await page.getByTestId("delete-account").click();
  await page.getByTestId("delete-confirm").waitFor();
  await settled(page);
  await shot(page, "delete-confirm");
  await page.getByTestId("delete-cancel").click();
  await page.getByTestId("delete-confirm").waitFor({ state: "hidden" });
  await page.getByTestId("settings-privacy").click();
  await page.getByTestId("privacy-kept").waitFor();
  await settled(page);
  await shot(page, "privacy");
});
