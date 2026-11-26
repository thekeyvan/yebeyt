import { expect, test, type Page } from "@playwright/test";
import { newId, noSidewaysScroll, openAccountApp, sessionCookies, signInAs, ask } from "./account";
import { todaysCouplet } from "./browse";
import { daily, tapKeys } from "./games";
import { openSettings } from "./me";

const coupletKey = `${todaysCouplet.path}#${todaysCouplet.index}`;
const like = (page: Page) => page.getByRole("button", { name: "پسند" });
const gate = (page: Page) => page.getByRole("dialog", { name: /یه حساب لازمه/ });

/** What the browser has kept in localStorage under `key`. */
const kept = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

test("a guest likes: the gate opens, and after a sign-in the like goes through, to the account, and survives a reload", async ({ page }) => {
  await openAccountApp(page, "/");
  await like(page).click();
  await expect(gate(page)).toBeVisible();
  await expect(like(page)).toHaveAttribute("aria-pressed", "false");

  await signInAs(page, { id: newId(), username: "niloofar" });
  await expect(gate(page)).toBeHidden();
  await expect(like(page)).toHaveAttribute("aria-pressed", "true"); // the action that was asked for went ahead
  await expect.poll(async () => (await ask(page, "/v1/me/reactions")).items.map((item: { key: string }) => item.key)).toContain(coupletKey);

  // The session is two httpOnly cookies; no script can read them.
  const cookies = await sessionCookies(page);
  expect(cookies.map((cookie) => cookie.name).sort()).toEqual(["yb_access", "yb_refresh"]);
  expect(cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("yb_");

  // This browser forgets what it kept; the account brings the like back.
  await page.evaluate(() => localStorage.removeItem("reader.marks"));
  await page.reload();
  await expect(like(page)).toHaveAttribute("aria-pressed", "true");
  await like(page).click(); // taking it back needs nothing more
  await expect(like(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await ask(page, "/v1/me/reactions")).items).toEqual([]);
});

test("what a guest kept and earned goes to the account when they sign in", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("games.stats")) localStorage.setItem("games.stats", JSON.stringify({ points: 140, solvedDays: [], best: { jigsaw: 215 }, daily: {} }));
  });
  await openAccountApp(page, "/");
  await page.getByRole("button", { name: "نگه دار" }).click();
  await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("navigation", { name: "تب‌ها" }).getByRole("link", { name: "بازی" }).click();
  await expect(page.getByTestId("points")).toHaveAccessibleName("امتیاز ۱۴۰ و رده‌بندی");

  await page.getByTestId("points").click(); // رده‌بندی needs an account
  await expect(gate(page)).toContainText("برای دیدن رده‌بندی");
  const id = newId();
  const progress = page.waitForRequest((request) => request.method() === "PUT" && request.url().endsWith("/api/v1/me/progress"));
  await signInAs(page, { id, username: "niloofar" });
  await expect(gate(page)).toBeHidden();
  // What the guest earned goes to the account as the phone sends it (the server keeps the larger of each), and so does the divan.
  expect((await progress).postDataJSON()).toEqual({ points: 140, streakDays: 0, streakLastDate: null, bestByGame: { jigsaw: 215 } });
  await expect.poll(async () => (await ask(page, "/v1/me/divan")).items.map((item: { key: string }) => item.key)).toContain(coupletKey);
  await expect(page.getByTestId("points")).toHaveAccessibleName("امتیاز ۱۴۰ و رده‌بندی"); // the points are the account's now
  expect(await kept(page, "games.stats.owner")).toBe(id);
});

test("the daily puzzle solved while signed in is reported to the account: its result, its points", async ({ page }) => {
  await openAccountApp(page, "/games");
  await page.getByTestId("points").click();
  await signInAs(page, { id: newId(), username: "niloofar" });
  await expect(gate(page)).toBeHidden();
  await page.getByTestId("daily-open").click();
  await tapKeys(page, daily.word);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("answer-sheet")).toBeVisible();
  await expect.poll(async () => (await ask(page, "/v1/me/stats")).totalPoints).toBe(100);
  expect(await page.evaluate(() => localStorage.getItem("scores.unsent"))).toBe("[]"); // all of it went
  await page.getByTestId("next").click();
  await expect(page.getByTestId("points")).toHaveAccessibleName("امتیاز ۱۰۰ و رده‌بندی");
});

test("the username step tells «قبلاً گرفته شده», «آزاده», offers suggestions and lets the waiting like go ahead", async ({ page }) => {
  await openAccountApp(page, "/");
  await like(page).click();
  await signInAs(page, { id: newId(), username: null, providerName: "نیلوفر" });
  const step = page.getByRole("dialog", { name: "یه نام کاربری انتخاب کن" });
  await expect(step).toBeVisible();
  await expect(like(page)).toHaveAttribute("aria-pressed", "false"); // it waits for the username
  await expect(step.getByTestId("provider-chip")).toHaveText("با اپل وارد شدی");
  await expect(step.getByTestId("display-name")).toHaveValue("نیلوفر");
  await expect(step).toContainText(" · از حساب اپلت");
  await expect(step.getByTestId("username-done")).toBeDisabled();

  await step.getByTestId("username").fill("sara");
  await expect(step.getByTestId("username-problem")).toHaveText("قبلاً گرفته شده");
  await expect(step.getByTestId("username-done")).toBeDisabled();
  await step.getByTestId("username").fill("ab");
  await expect(step.getByTestId("username-problem")).toHaveText("حداقل ۳ حرف");
  await step.getByTestId("username").fill("yebeyt");
  await expect(step.getByTestId("username-problem")).toHaveText("این اسم رزرو شده");
  await step.getByTestId("username").fill("Mahsa.K");
  await expect(step.getByTestId("username-available")).toHaveText("آزاده");
  await expect(step).toContainText("yebeyt.com/i/mahsa.k");

  // The server's suggestions, from the Latin letters of the name (a Persian name has none: «beyt»).
  await expect(step.getByRole("button", { name: "beyt42" })).toBeVisible();
  await step.getByRole("button", { name: "beyt42" }).click();
  await expect(step.getByTestId("username")).toHaveValue("beyt42");
  await expect(step.getByTestId("username-available")).toBeVisible();

  await step.getByTestId("username-done").click();
  await expect(step).toBeHidden();
  await expect(like(page)).toHaveAttribute("aria-pressed", "true");
  const me = await page.evaluate(async () => (await (await fetch("/auth/session")).json()) as { user: { username: string; displayName: string } });
  expect(me.user).toMatchObject({ username: "beyt42", displayName: "نیلوفر" });
});

test("signing out syncs first, then forgets the account's divan and likes here; signing in again brings them back", async ({ page }) => {
  const id = newId();
  await openAccountApp(page, "/");
  await page.getByRole("button", { name: "نگه دار" }).click();
  await like(page).click();
  await signInAs(page, { id, username: "niloofar" });
  await expect(like(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0); // the gate has gone down
  await openSettings(page);
  await expect(page.getByTestId("settings-username")).toContainText("@niloofar");

  await page.getByTestId("sign-out").click();
  const ask1 = page.getByRole("dialog", { name: "از حسابت بیرون بری؟" });
  await expect(ask1).toContainText("دیوانت به حسابت همگام می‌شه و از این گوشی پاک می‌شه؛ با ورود دوباره برمی‌گرده.");
  await ask1.getByRole("button", { name: "بیرون برو" }).click();
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
  expect(await kept(page, "reader.divan")).toBeNull();
  expect(await kept(page, "reader.marks")).toBeNull();
  expect(await sessionCookies(page)).toEqual([]);

  await page.getByTestId("settings-sign-in").click();
  await signInAs(page, { id, username: "niloofar" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("settings-username")).toContainText("@niloofar");
  await page.getByRole("navigation", { name: "تب‌ها" }).getByRole("link", { name: "خونه" }).click();
  await expect(page.getByRole("button", { name: "نگه دار" })).toHaveAttribute("aria-pressed", "true");
  await expect(like(page)).toHaveAttribute("aria-pressed", "true");
});

test("signing out with something that did not reach the account warns, and keeps it until the person insists", async ({ page }) => {
  await openAccountApp(page, "/");
  await page.getByRole("button", { name: "نگه دار" }).click();
  await page.getByRole("button", { name: "نگه دار" }).waitFor();
  await page.getByRole("button", { name: "پسند" }).click();
  await signInAs(page, { id: newId(), username: "niloofar", syncFails: true }); // the debug server refuses the divan
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openSettings(page);
  await page.getByTestId("sign-out").click();
  await page.getByRole("dialog", { name: "از حسابت بیرون بری؟" }).getByRole("button", { name: "بیرون برو" }).click();

  const warning = page.getByRole("dialog", { name: /همه‌ی بیت‌هات هنوز به حسابت نرسیده/ });
  await expect(warning).toContainText("اگه الان خارج بشی، از این گوشی پاک می‌شن.");
  await warning.getByTestId("unsynced-stay").click();
  await expect(warning).toBeHidden();
  await expect(page.getByTestId("settings-username")).toBeVisible(); // still signed in
  expect(await kept(page, "reader.divan")).not.toBeNull();

  await page.getByTestId("sign-out").click();
  await page.getByRole("dialog", { name: "از حسابت بیرون بری؟" }).getByRole("button", { name: "بیرون برو" }).click();
  await page.getByRole("dialog", { name: /همه‌ی بیت‌هات هنوز/ }).getByTestId("unsynced-leave").click();
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
  expect(await kept(page, "reader.divan")).toBeNull();
});

test("the gate keeps the buttons off and says «ورود روی وب به‌زودی» while the providers' ids are not set", async ({ page }) => {
  await openAccountApp(page, "/");
  await like(page).click();
  await expect(gate(page).getByRole("button", { name: "ادامه با اپل" })).toBeDisabled();
  await expect(gate(page).getByRole("button", { name: "ادامه با گوگل" })).toBeDisabled();
  await expect(gate(page)).toContainText("ورود روی وب به‌زودی");
});

test("a refused session signs the page out: the gate opens again", async ({ page }) => {
  await openAccountApp(page, "/");
  await like(page).click();
  await signInAs(page, { id: newId(), username: "niloofar" });
  await expect(like(page)).toHaveAttribute("aria-pressed", "true");
  await page.context().clearCookies();
  await page.reload();
  await expect(like(page)).toHaveAttribute("aria-pressed", "true"); // what it kept stays until it syncs…
  await openSettings(page);
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
});

test("the account sheets are right to left and the page never scrolls sideways", async ({ page }) => {
  await openAccountApp(page, "/");
  await like(page).click();
  await expect(gate(page)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await noSidewaysScroll(page)).toBe(true);
  await signInAs(page, { id: newId(), username: null });
  await expect(page.getByRole("dialog", { name: "یه نام کاربری انتخاب کن" })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});
