import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { newId, noSidewaysScroll, sessionCookies, signInAs } from "./account";
import { expectReader, tabBar } from "./browse";
import { clearOfTabBar, kept, openMe, openSettings, sessionUser, signInFromProfile, toasts, todayNumber } from "./me";
import { copied } from "./reader";

const hairOf = (page: Page, where: "tab" | "draft") => (where === "tab" ? tabBar(page) : page.getByTestId("avatar-draft")).locator("path[d^='M47 104']");
const gate = (page: Page, feature: string) => page.getByRole("dialog", { name: new RegExp(`برای ${feature} یه حساب لازمه`) });

test("a guest's profile: the standard face, «مهمان», «ورود», nothing earned, an empty divan, and the gate for the invite", async ({ page }) => {
  await openMe(page);
  await expect(page.getByTestId("profile-name")).toHaveText("مهمان");
  await expect(page.getByTestId("profile-sign-in")).toBeVisible();
  await expect(page.getByTestId("profile-username")).toHaveCount(0);
  await expect(page.getByTestId("stat-level")).toContainText("نوآموز");
  await expect(page.getByTestId("stat-points")).toContainText("۰");
  await expect(page.getByTestId("stat-streak")).toContainText("۰ روز");
  for (const id of ["streak7", "firstMosh", "hafez", "read100"]) await expect(page.getByTestId(`badge-${id}`)).toHaveAttribute("data-earned", "false");
  await expect(page.getByText("هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.")).toBeVisible();
  await expect(hairOf(page, "tab")).toHaveAttribute("fill", "#3B2A2A"); // the tab bar shows the standard face

  await page.getByTestId("invite-friends").click();
  await expect(gate(page, "دعوت دوستات")).toBeVisible();
  await page.getByRole("button", { name: "بعداً" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByTestId("profile-sign-in").click();
  await expect(gate(page, "همگام کردن دیوان و امتیازهات")).toBeVisible();
});

test("a signed-in profile: the account's name and username, the level, points and streak, the badges, and the first couplets of the divan", async ({ page }) => {
  await page.addInitScript((day) => {
    if (!localStorage.getItem("games.stats")) localStorage.setItem("games.stats", JSON.stringify({ points: 2480, solvedDays: Array.from({ length: 7 }, (_, back) => day - back), best: {}, daily: {} }));
  }, todayNumber);
  await openMe(page, "/me", { seed: true });
  await signInFromProfile(page, { displayName: "نیلوفر" });
  await expect(page.getByTestId("profile-name")).toHaveText("نیلوفر");
  await expect(page.getByTestId("profile-sign-in")).toHaveCount(0);
  await expect(page.getByTestId("stat-level")).toContainText("غزل‌باز");
  await expect(page.getByTestId("stat-points")).toContainText("۲٬۴۸۰");
  await expect(page.getByTestId("stat-streak")).toContainText("۷ روز");
  await expect(page.getByTestId("badge-streak7")).toHaveAttribute("data-earned", "true");
  await expect(page.getByTestId("badge-read100")).toHaveAttribute("data-earned", "false");
  await expect(page.getByTestId("favourite-poet")).toHaveText("شاعرِ محبوب: حافظ");
  await expect(page.getByTestId("open-divan")).toHaveText("همه‌ی ۲۰ بیت");
  await expect(page.getByTestId(/^profile-couplet-/)).toHaveCount(2);

  await page.getByTestId(/^profile-couplet-/).first().click(); // the newest kept couplet opens in the reader
  await expectReader(page, "غزل ۱");
  expect(new URL(page.url()).pathname).toBe("/poem/hafez/ghazal/sh1");
});

test("the divan, seeded: by poet, with the day on every card; taking a couplet out and bringing it back; opening one in the reader", async ({ page }) => {
  await openMe(page, "/me/divan", { seed: true });
  await expect(page.getByText("۲۰ بیت", { exact: true })).toBeVisible();
  await expect(page.getByTestId(/^divan-couplet-/)).toHaveCount(20);
  await expect(page.locator("main section[aria-label]")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "حافظ" }).getByTestId(/^divan-couplet-/)).toHaveCount(12);
  await expect(page.getByRole("region", { name: "خیام" }).getByTestId(/^divan-couplet-/)).toHaveCount(5);
  await expect(page.getByTestId("divan-visibility")).toHaveText("دوستا");
  // The day each was kept, as the card says it.
  await expect(page.getByTestId("divan-couplet-/hafez/ghazal/sh1#0")).toContainText("غزل ۱ · امروز");
  await expect(page.getByTestId("divan-couplet-/hafez/ghazal/sh2#0")).toContainText("غزل ۲ · هفته‌ی پیش");

  // A poet's chip keeps only that poet; «همه» brings the rest back.
  await page.getByTestId("poet-chip-khayyam").click();
  await expect(page.getByTestId(/^divan-couplet-/)).toHaveCount(5);
  await page.getByTestId("poet-chip-all").click();
  await expect(page.getByTestId(/^divan-couplet-/)).toHaveCount(20);

  // The search finds a word of a couplet, or a poet's name.
  await page.getByRole("searchbox").fill("خیام");
  await expect(page.getByTestId(/^divan-couplet-/)).toHaveCount(5);
  await page.getByRole("searchbox").fill("نیست چنین چیزی");
  await expect(page.getByTestId("nothing-found")).toBeVisible();
  await page.getByRole("searchbox").fill("");

  // «تازه‌ترین»: one list, newest first.
  await page.getByRole("radio", { name: "تازه‌ترین" }).click();
  await expect(page.locator("main section[aria-label]")).toHaveCount(0);
  await expect(page.getByTestId(/^divan-couplet-/).first()).toHaveAttribute("data-testid", "divan-couplet-/hafez/ghazal/sh1#0");

  // Taking one out asks nothing and offers the way back.
  await page.getByTestId("unkeep-/hafez/ghazal/sh1#0").click();
  await expect(page.getByTestId("divan-couplet-/hafez/ghazal/sh1#0")).toHaveCount(0);
  await expect(page.getByText("۱۹ بیت", { exact: true })).toBeVisible();
  await expect(toasts(page).getByText("از دیوانت برداشته شد")).toBeVisible();
  await page.getByRole("button", { name: "برگردون" }).click();
  await expect(page.getByTestId("divan-couplet-/hafez/ghazal/sh1#0")).toBeVisible();
  await expect(page.getByText("۲۰ بیت", { exact: true })).toBeVisible();

  await page.getByTestId("divan-couplet-/hafez/ghazal/sh1#0").getByRole("link").click();
  await expectReader(page, "غزل ۱");
  expect(new URL(page.url()).searchParams.get("c")).toBe("0");
});

test("an empty divan says so, and the visibility chip follows the privacy setting", async ({ page }) => {
  await openMe(page, "/me/divan");
  await expect(page.getByTestId("divan-empty")).toHaveText("هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.");
  await page.getByTestId("divan-visibility").click();
  await page.getByTestId("privacy-kept").getByRole("radio", { name: "فقط من" }).click();
  await page.getByRole("button", { name: "برگشت" }).click();
  await expect(page.getByTestId("divan-visibility")).toHaveText("فقط من");
});

test("the avatar editor: a guest changes the hair and the accessory, saves, and the face survives a reload and shows in the tab bar", async ({ page }) => {
  await openMe(page, "/me/avatar");
  await page.getByTestId("avatar-part-hair").click();
  await page.getByTestId("avatar-item-fire").click();
  await expect(page.getByTestId("avatar-item-fire")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("avatar-part-accessory").click();
  await page.getByTestId("avatar-item-rose").click();
  await expect(page.getByTestId("avatar-couplet")).toContainText("گل سرخِ حافظ · دیوان حافظ");
  await expect(hairOf(page, "draft")).toHaveAttribute("fill", "#FF4D24"); // the big face follows at once…
  await expect(hairOf(page, "tab")).toHaveAttribute("fill", "#3B2A2A"); // …the tab bar's is what was saved

  await page.getByTestId("avatar-save").click();
  await expect(page.getByTestId("profile-name")).toBeVisible();
  await expect(hairOf(page, "tab")).toHaveAttribute("fill", "#FF4D24");
  expect(JSON.parse((await kept(page, "me.avatar"))!)).toEqual({ face: "peach", eyes: "round", hair: "fire", mouth: "smile", accessory: "rose", background: "sun" });
  await page.reload();
  await expect(hairOf(page, "tab")).toHaveAttribute("fill", "#FF4D24");
  await page.getByTestId("edit-avatar").click();
  await expect(hairOf(page, "draft")).toHaveAttribute("fill", "#FF4D24");
  await page.getByTestId("avatar-part-accessory").click();
  await expect(page.getByTestId("avatar-item-rose")).toHaveAttribute("aria-pressed", "true");
});

test("a locked accessory cannot be chosen, and the dice never picks one", async ({ page }) => {
  await openMe(page, "/me/avatar");
  await expect(page.getByTestId("avatar-item-crown")).toContainText("۵ برد توی «از کدوم کتاب؟»");
  await expect(page.getByTestId("avatar-item-helmet")).toContainText("لیگ سخن‌دان");
  await expect(page.getByTestId("avatar-item-candle")).toContainText("۷ روز پشت‌سرهم");
  for (const locked of ["crown", "helmet", "candle"]) {
    await page.getByTestId(`avatar-item-${locked}`).click();
    await expect(page.getByTestId(`avatar-item-${locked}`)).toHaveAttribute("aria-pressed", "false");
  }
  for (let times = 0; times < 8; times++) {
    await page.getByTestId("avatar-shuffle").click();
    for (const locked of ["crown", "helmet", "candle"]) await expect(page.getByTestId(`avatar-item-${locked}`)).toHaveAttribute("aria-pressed", "false");
  }
});

test("leaving a face that was not saved asks first", async ({ page }) => {
  await openMe(page, "/me");
  await page.getByTestId("edit-avatar").click();
  await page.getByTestId("avatar-part-eyes").click();
  await page.getByTestId("avatar-item-happy").click();
  await page.getByRole("button", { name: "برگشت" }).click();
  const ask = page.getByRole("dialog", { name: "چهره‌ات ذخیره نشده. ولش کنی؟" });
  await ask.getByRole("button", { name: "بمون" }).click();
  await expect(ask).toBeHidden();
  await expect(page.getByTestId("avatar-draft")).toBeVisible();
  await page.getByRole("button", { name: "برگشت" }).click();
  await ask.getByRole("button", { name: "ول کن" }).click();
  await expect(page.getByTestId("profile-name")).toBeVisible();
  expect(await kept(page, "me.avatar")).toBeNull();
});

test("signed in, saving the face sends it to the account, which gives it back to a browser that has none", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page);
  await page.getByTestId("edit-avatar").click();
  await page.getByTestId("avatar-part-mouth").click();
  await page.getByTestId("avatar-item-grin").click();
  const put = page.waitForRequest((request) => request.method() === "PUT" && request.url().endsWith("/api/v1/me/avatar"));
  await page.getByTestId("avatar-save").click();
  expect((await put).postDataJSON()).toEqual({ face: "peach", eyes: "round", hair: "dark", mouth: "grin", accessory: "ney", background: "sun" });
  await expect.poll(async () => (await sessionUser(page))?.avatar).toMatchObject({ mouth: "grin" });
  await expect.poll(() => kept(page, "me.avatar.unsent")).toBeNull();

  await page.evaluate(() => {
    localStorage.removeItem("me.avatar");
    localStorage.removeItem("me.avatar.unsent");
  });
  await page.reload();
  await expect(tabBar(page).locator("path[d='M84 130 Q100 156 116 130Z']")).toHaveCount(1); // the grin
});

test("the invite: a guest gets the gate; with an account, the link, the tones, the text by hand, copying and the messengers", async ({ page }) => {
  await openMe(page, "/me/invite");
  await expect(gate(page, "دعوت دوستات")).toBeVisible();
  await expect(page.getByTestId("copy-link")).toBeDisabled();
  await signInAs(page, { id: newId(), username: "niloofar" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url) => (opened.push(String(url)), null);
  });

  await expect(page.getByTestId("invite-link")).toHaveText("yebeyt.com/i/niloofar");
  await expect(page.getByTestId("invite-body")).toContainText("یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه!");
  await page.getByTestId("copy-link").click();
  await expect.poll(() => copied(page)).toBe("https://yebeyt.com/i/niloofar");
  await expect(toasts(page).getByText("کپی شد")).toBeVisible();

  await page.getByRole("radio", { name: "کوتاه" }).click();
  await expect(page.getByTestId("invite-body")).toHaveText("بیا با هم مشاعره کنیم:");
  await page.getByTestId("more").click(); // no share sheet here: the text is copied
  await expect.poll(() => copied(page)).toBe("بیا با هم مشاعره کنیم:\n«الا یا ایها الساقی ادر کأسا و ناولها»\nyebeyt.com/i/niloofar");

  await page.getByTestId("invite-write").click();
  await page.getByTestId("invite-text").fill("سلام، بیا!");
  await page.getByTestId("more").click();
  await expect.poll(() => copied(page)).toBe("سلام، بیا!\n«الا یا ایها الساقی ادر کأسا و ناولها»\nyebeyt.com/i/niloofar");

  await page.getByTestId("channel-whatsapp").click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(1);
  expect(new URL(opened[0]!).searchParams.get("text")).toBe("سلام، بیا!\n«الا یا ایها الساقی ادر کأسا و ناولها»\nyebeyt.com/i/niloofar");
});

test("«استوری» makes a 1080×1920 picture of the card", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page);
  await page.goto("/me/invite");
  const download = page.waitForEvent("download");
  await page.getByTestId("story").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("yebeyt-invite.png");
  const bytes = readFileSync((await file.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // a PNG
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1920]);
});

test("the settings: a guest's sign-in row; the text, privacy, feedback, terms and licences rows", async ({ page }) => {
  await openMe(page, "/");
  await openSettings(page);
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
  await expect(page.getByTestId("sign-out")).toHaveCount(0);
  await expect(page.getByTestId("delete-account")).toHaveCount(0);
  await page.getByTestId("settings-feedback").click();
  await expect(page.getByRole("dialog", { name: "می‌خوای چیزی بگی؟" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("terms")).toHaveAttribute("href", "https://yebeyt.com/terms");
  await expect(page.getByTestId("privacy-policy")).toHaveAttribute("href", "https://yebeyt.com/privacy");
  await page.getByTestId("settings-text").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByTestId("settings-privacy").click();
  await expect(page.getByRole("heading", { name: "حریم خصوصی" })).toBeVisible();
  await page.getByRole("button", { name: "برگشت" }).click();
  await page.getByTestId("licenses").click();
  await expect(page.getByRole("heading", { name: "مجوزها" })).toBeVisible();
});

test("the settings show the account's email and the news switch, which is off at first and stays on after a reload", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page);
  await openSettings(page);
  const email = page.getByTestId("settings-email");
  await expect(email).toContainText("ایمیل");
  await expect(email).toContainText("niloofar@example.com");
  await expect(email.locator("[dir=ltr]")).toHaveText("niloofar@example.com");
  await expect(email.getByRole("button")).toHaveCount(0); // not a button, not editable
  await expect(email.locator("svg")).toHaveCount(0); // no chevron
  const news = page.getByRole("switch", { name: /خبرهای یه بیت رو برام ایمیل کن/ });
  await expect(page.getByTestId("settings-news")).toContainText("هر وقت بخوای خاموشش کن");
  await expect(news).toHaveAttribute("aria-checked", "false");
  expect(await noSidewaysScroll(page)).toBe(true);

  await news.click();
  await expect(news).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await sessionUser(page))?.newsOptIn).toBe(true);
  await page.reload();
  await expect(page.getByRole("switch", { name: /خبرهای یه بیت رو برام ایمیل کن/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("switch", { name: /خبرهای یه بیت/ }).click();
  await expect(page.getByRole("switch", { name: /خبرهای یه بیت/ })).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await sessionUser(page))?.newsOptIn).toBe(false);
});

test("Apple's relay address shows as «مخفی (اپل)»", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page, { email: "x7k2@privaterelay.appleid.com" });
  await openSettings(page);
  await expect(page.getByTestId("settings-email")).toContainText("مخفی (اپل)");
  await expect(page.getByTestId("settings-email")).not.toContainText("privaterelay");
  await expect(page.getByTestId("settings-news")).toBeVisible();
});

test("an account with no email has neither the email row nor the news switch", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page, { email: null });
  await openSettings(page);
  await expect(page.getByTestId("settings-username")).toBeVisible();
  await expect(page.getByTestId("settings-email")).toHaveCount(0);
  await expect(page.getByTestId("settings-news")).toHaveCount(0);
});

test("a news choice the server refuses flips back and says so", async ({ page }) => {
  await openMe(page, "/me");
  await signInFromProfile(page);
  await openSettings(page);
  await page.route("**/api/v1/me/news", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal_error"}' }));
  const news = page.getByRole("switch", { name: /خبرهای یه بیت/ });
  await news.click();
  await expect(toasts(page)).toContainText("یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن.");
  await expect(news).toHaveAttribute("aria-checked", "false");
  expect((await sessionUser(page))?.newsOptIn).toBe(false);
  await page.unroute("**/api/v1/me/news");
  await news.click(); // and a later try goes through
  await expect(news).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await sessionUser(page))?.newsOptIn).toBe(true);
});

test("a guest sees neither the email nor the news switch in the settings", async ({ page }) => {
  await openMe(page, "/");
  await openSettings(page);
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
  await expect(page.getByTestId("settings-email")).toHaveCount(0);
  await expect(page.getByTestId("settings-news")).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});

test("signing out from the settings warns when the divan did not reach the account, and goes when the person insists", async ({ page }) => {
  await openMe(page, "/me", { seed: true });
  await signInFromProfile(page, { syncFails: true }); // the debug server refuses the divan
  await openSettings(page);
  await expect(page.getByTestId("settings-username")).toContainText("@niloofar");
  await page.getByTestId("sign-out").click();
  await page.getByRole("dialog", { name: "از حسابت بیرون بری؟" }).getByRole("button", { name: "بیرون برو" }).click();
  const warning = page.getByRole("dialog", { name: /همه‌ی بیت‌هات هنوز به حسابت نرسیده/ });
  await expect(warning).toBeVisible();
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

test("deleting the account: «نه» changes nothing; «پاک کن» deletes it, signs out and forgets the account's data here", async ({ page }) => {
  const id = newId();
  await openMe(page, "/me", { seed: true });
  await signInFromProfile(page, { id });
  // What the account has made here: a face, a privacy setting, a like.
  await page.getByTestId("edit-avatar").click();
  await page.getByTestId("avatar-part-hair").click();
  await page.getByTestId("avatar-item-fire").click();
  await page.getByTestId("avatar-save").click();
  await page.goto("/me/privacy");
  await page.getByTestId("privacy-kept").getByRole("radio", { name: "فقط من" }).click();
  await expect.poll(async () => (await page.evaluate(async () => (await (await fetch("/api/v1/me/privacy")).json()) as { keptVisibility: string })).keptVisibility).toBe("me");
  await page.evaluate(() => localStorage.setItem("reader.marks", JSON.stringify({ liked: ["/a/b/c#1"], reposted: [] })));
  await openSettings(page);

  await page.getByTestId("delete-account").click();
  const sheet = page.getByRole("dialog", { name: "حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟" });
  await expect(sheet).toBeVisible();
  await sheet.getByTestId("delete-cancel").click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("settings-username")).toBeVisible();

  await page.getByTestId("delete-account").click();
  await sheet.getByTestId("delete-confirm").click();
  await expect(page.getByTestId("settings-sign-in")).toBeVisible();
  for (const key of ["reader.divan", "reader.marks", "me.avatar", "me.avatar.unsent", "me.privacy", "me.privacy.unsent"]) expect(await kept(page, key), key).toBeNull();
  expect(await sessionCookies(page)).toEqual([]);
  // The server knows the account no more: its session is refused.
  expect(await page.evaluate(async () => (await fetch("/api/v1/me/divan")).status)).toBe(401);
  // The face in the tab bar is the standard one again.
  await expect(hairOf(page, "tab")).toHaveAttribute("fill", "#3B2A2A");
});

test("deleting an account that the server cannot delete says so and keeps everything", async ({ page }) => {
  await openMe(page, "/me", { seed: true });
  await signInFromProfile(page);
  await openSettings(page);
  let answer: { status: number; json?: unknown } = { status: 502 };
  await page.route((url) => url.pathname === "/api/v1/me", (route) => (route.request().method() === "DELETE" ? route.fulfill(answer) : route.fallback()));
  await page.getByTestId("delete-account").click();
  await page.getByTestId("delete-confirm").click();
  await expect(page.getByTestId("delete-error")).toHaveText("اینترنت نیست؛ یه بار دیگه امتحان کن.");
  // Apple could not be reached to revoke its token: the door passes the server's code on, and the line says so.
  answer = { status: 502, json: { error: "apple_revoke_failed" } };
  await page.getByTestId("delete-confirm").click();
  await expect(page.getByTestId("delete-error")).toHaveText("الان نشد، یه کم دیگه دوباره امتحان کن");
  await page.getByTestId("delete-cancel").click();
  await expect(page.getByTestId("settings-username")).toBeVisible();
  expect(await kept(page, "reader.divan")).not.toBeNull();
  expect((await sessionCookies(page)).length).toBe(2);
});

test("the privacy settings are kept here and, with an account, sent to it as a partial update", async ({ page }) => {
  await openMe(page, "/me/privacy");
  const kept1 = page.getByTestId("privacy-kept");
  await expect(kept1.getByRole("radio", { name: "دوستا" })).toBeChecked();
  await expect(page.getByTestId("privacy-online")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("privacy-leaderboard")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("بیت‌هایی که نگه می‌داری رو فقط دوستات می‌بینن، اگه بخوای.")).toBeVisible();
  await page.getByTestId("privacy-online").click();
  await page.getByTestId("privacy-messages").getByRole("radio", { name: "همه" }).click();
  await page.reload();
  await expect(page.getByTestId("privacy-online")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("privacy-messages").getByRole("radio", { name: "همه" })).toBeChecked();
  expect(JSON.parse((await kept(page, "me.privacy"))!)).toMatchObject({ showOnline: false, messagesFrom: "all", keptVisibility: "friends" });

  await page.goto("/me");
  await signInFromProfile(page);
  const puts: unknown[] = [];
  page.on("request", (request) => request.method() === "PUT" && request.url().endsWith("/api/v1/me/privacy") && puts.push(request.postDataJSON()));
  await page.goto("/me/privacy");
  // What was changed here before the account existed goes up when the screen opens; then a change goes alone.
  await expect.poll(() => puts).toEqual([{ showOnline: false, messagesFrom: "all" }]);
  await page.getByTestId("privacy-reposts").click();
  await expect.poll(() => puts.at(-1)).toEqual({ allowReposts: false });
  await expect.poll(async () => page.evaluate(async () => (await (await fetch("/api/v1/me/privacy")).json()) as unknown)).toMatchObject({ allowReposts: false, showOnline: false, messagesFrom: "all", keptVisibility: "friends" });
});

test("the licences and the badges render, with their rules", async ({ page }) => {
  await openMe(page, "/me/licenses");
  for (const text of ["قلم‌ها", "Vazirmatn", "Saber Rastikerdar", "SIL Open Font License 1.1", "شعر، معنی‌ها و خوانش‌ها", "Ganjoor (ganjoor.net)", "کتابخونه‌ها", "UI SDK"]) await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  await page.goto("/me/badges");
  for (const text of ["۷ روز پشت‌سرهم معمای روز رو حل کن", "اولین مشاعره‌ت رو بازی کن", "به ۵۰ بیت حافظ درست جواب بده", "۱۰۰ بیت بخون"]) await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByTestId("badge-streak7")).toHaveAttribute("data-earned", "false");
});

for (const path of ["/me", "/me/divan", "/me/avatar", "/me/invite", "/me/settings", "/me/privacy", "/me/badges", "/me/licenses"]) {
  test(`${path} is right to left, never scrolls sideways and keeps clear of the tab bar`, async ({ page }) => {
    await openMe(page, path, { seed: true });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading").first()).toBeVisible();
    if (path === "/me/divan") await expect(page.getByTestId(/^divan-couplet-/)).toHaveCount(20);
    if (path === "/me") await expect(page.getByTestId(/^profile-couplet-/)).toHaveCount(2);
    expect(await noSidewaysScroll(page)).toBe(true);
    expect(await clearOfTabBar(page)).toBe(true);
    expect(await noSidewaysScroll(page)).toBe(true);
  });
}
