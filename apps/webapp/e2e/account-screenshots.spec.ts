import { test, type Page } from "@playwright/test";
import { newId, openAccountApp, openOnboarding, signInAs } from "./account";
import { fillByTaps } from "./games";
import { openSettings } from "./me";

// Screenshots of the account screens at the small phone (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web4-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

test.beforeEach(({ page }, info) => {
  const { width, height } = page.viewportSize()!;
  test.skip(!info.project.name.startsWith("chromium") || width !== 375 || height !== 667, "one browser, the small phone");
});

test("the gate, the username step and the sign-out warning", async ({ page }) => {
  await openAccountApp(page, "/");
  await page.getByRole("button", { name: "پسند" }).click();
  await page.getByRole("dialog", { name: /یه حساب لازمه/ }).waitFor();
  await settled(page);
  await shot(page, "gate");
  await signInAs(page, { id: newId(), username: null, providerName: "نیلوفر" });
  await page.getByRole("dialog", { name: "یه نام کاربری انتخاب کن" }).waitFor();
  await page.getByTestId("username").fill("sara");
  await page.getByTestId("username-problem").waitFor();
  await settled(page);
  await shot(page, "username-taken");
  await page.getByTestId("username").fill("niloo.far");
  await page.getByTestId("username-available").waitFor();
  await settled(page);
  await shot(page, "username");
  await page.getByTestId("username-done").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "نگه دار" }).click();
  await openSettings(page);
  await page.getByTestId("settings-username").waitFor();
  await settled(page); // the tab's page transition is over
  await shot(page, "me");
});

test("the sign-out warning", async ({ page }) => {
  await openAccountApp(page, "/");
  await page.getByRole("button", { name: "نگه دار" }).click();
  await page.getByRole("button", { name: "پسند" }).click();
  await signInAs(page, { id: newId(), username: "niloofar", syncFails: true });
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await openSettings(page);
  await page.getByTestId("sign-out").click();
  await page.getByRole("dialog", { name: "از حسابت بیرون بری؟" }).waitFor();
  await settled(page);
  await shot(page, "sign-out-ask");
  await page.getByRole("button", { name: "بیرون برو" }).click();
  await page.getByTestId("unsynced-stay").waitFor();
  await settled(page);
  await shot(page, "sign-out-warning");
});

test("every onboarding step, and the home with the taste", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  await openOnboarding(page);
  await page.getByTestId("onb-start").waitFor();
  await settled(page);
  await shot(page, "onb-welcome");
  await page.getByTestId("onb-start").click();
  await page.getByTestId("poet-hafez").click();
  await page.getByTestId("poet-khayyam").click();
  await page.getByTestId("mood-love").click();
  await page.getByTestId("mood-mystic").click();
  await settled(page);
  await shot(page, "onb-taste");
  await page.getByTestId("onb-next").click();
  await page.getByTestId("jigsaw-card").waitFor();
  await fillByTaps(page, "wrong");
  await settled(page);
  await shot(page, "onb-game");
  await page.getByTestId("onb-check").click();
  await page.waitForTimeout(300);
  await shot(page, "onb-game-wrong");
  await page.waitForTimeout(1500);
  await fillByTaps(page, "right");
  await page.getByTestId("onb-check").click();
  await page.getByTestId("onb-reward").waitFor();
  await settled(page);
  await shot(page, "onb-account");
  await signInAs(page, { id: newId(), username: null, providerName: "نیلوفر", provider: "google" });
  await page.getByTestId("username-done").waitFor();
  await settled(page);
  await shot(page, "onb-username");
  await page.getByTestId("username").fill("niloo.far");
  await page.getByTestId("username-available").waitFor();
  await page.getByTestId("username-done").click();
  await page.getByTestId("onb-home").waitFor();
  await settled(page);
  await shot(page, "onb-friends");
  await page.getByTestId("onb-home").click();
  await page.getByTestId("daily-couplet").waitFor();
  await settled(page);
  await shot(page, "home-taste");
});
