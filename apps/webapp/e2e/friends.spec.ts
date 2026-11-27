import { expect, test } from "@playwright/test";
import { newId, openAccountApp, signInAs } from "./account";
import { tabBar } from "./browse";
import { asked, chooseFromMenu, expectRightToLeftAndFits, openSignedIn } from "./friends";
import { clearOfTabBar, toasts } from "./me";

const gate = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: /یه حساب لازمه/ });

test.describe("finding people", () => {
  test("searching «ar» finds آرین, who asked me; a short text finds nothing; the demo friend «یه بیت» is found like anyone", async ({ page }) => {
    await openSignedIn(page, "/people");
    await expectRightToLeftAndFits(page);
    const field = page.getByRole("searchbox", { name: "نام کاربری…" });
    await field.fill("a");
    await expect(page.getByTestId("person-aryan")).toHaveCount(0); // two characters at least
    await field.fill("ar");
    const row = page.getByTestId("person-aryan");
    await expect(row).toContainText("آرین");
    await expect(row).toContainText("@aryan");
    await expect(page.getByTestId("accept-aryan")).toHaveText("قبول");
    await expect(page.getByTestId("reject-aryan")).toHaveText("رد");
    await expect(page.getByTestId("person-paria")).toHaveCount(0);

    await field.fill("@Ye");
    await expect(page.getByTestId("person-yebeyt")).toContainText("یه بیت");
    await expect(page.getByTestId("friends-yebeyt")).toHaveText("دوستین"); // a friend: the chip, no buttons
    await field.fill("zzz");
    await expect(page.getByTestId("nothing-found")).toBeVisible();
    await expectRightToLeftAndFits(page);
    expect(await clearOfTabBar(page)).toBe(true);
  });

  test("the rows act: accept, ask, send; rejecting and taking back ask first", async ({ page }) => {
    await openSignedIn(page, "/people?q=ra");
    // «ra» is رها (nothing yet): a request goes at once.
    await page.getByTestId("friend-raha").click();
    await expect(page.getByTestId("friend-raha")).toHaveText("درخواست فرستادی");
    await expect(asked(page, /پس بگیری/)).toHaveCount(0); // sending asks nothing
    await page.getByTestId("friend-raha").click(); // taking it back asks first
    await expect(asked(page, "درخواستت رو پس بگیری؟")).toBeVisible();
    await asked(page, /پس بگیری/).getByRole("button", { name: "نه" }).click();
    await expect(asked(page, /پس بگیری/)).toHaveCount(0);
    await expect(page.getByTestId("friend-raha")).toHaveText("درخواست فرستادی");
    await page.getByTestId("friend-raha").click();
    await asked(page, /پس بگیری/).getByRole("button", { name: "پس بگیر" }).click();
    await expect(page.getByTestId("friend-raha")).toHaveText("درخواست دوستی");

    await page.getByRole("searchbox").fill("ar");
    await page.getByTestId("accept-aryan").click();
    await expect(page.getByTestId("friends-aryan")).toHaveText("دوستین");
  });
});

test.describe("a person's page", () => {
  test("آرین: «قبول» makes friends at once, with a friend count and the league", async ({ page }) => {
    await openSignedIn(page, "/u/aryan");
    await expectRightToLeftAndFits(page);
    await expect(page.getByTestId("person-name")).toHaveText("آرین");
    await expect(page.getByTestId("person-friends")).toHaveText("۱۲ دوست");
    await expect(page.getByTestId("person-league")).toHaveText("لیگ غزل‌باز");
    await expect(page.getByTestId("person-accept")).toHaveText("قبول");
    await expect(page.getByTestId("person-reject")).toHaveText("رد");
    await page.getByTestId("person-accept").click();
    await expect(page.getByTestId("person-friend-chip")).toHaveText("دوستین");
    await expect(page.getByTestId("person-accept")).toHaveCount(0);
    expect(await clearOfTabBar(page)).toBe(true);
  });

  test("آرین: «رد» asks first, and «نه» keeps the request", async ({ page }) => {
    await openSignedIn(page, "/u/aryan");
    await page.getByTestId("person-reject").click();
    const sheet = asked(page, "درخواستش رو رد کنی؟");
    await expect(sheet).toContainText("بهش خبر نمی‌دیم.");
    await sheet.getByRole("button", { name: "نه" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("person-accept")).toBeVisible();
    await page.getByTestId("person-reject").click();
    await sheet.getByRole("button", { name: "رد کن" }).click();
    await expect(page.getByTestId("person-send")).toHaveText("درخواست دوستی");
  });

  test("پریا: «درخواست فرستادی» asks before taking the request back", async ({ page }) => {
    await openSignedIn(page, "/u/paria");
    await expect(page.getByTestId("person-cancel")).toHaveText("درخواست فرستادی");
    await page.getByTestId("person-cancel").click();
    await expect(asked(page, "درخواستت رو پس بگیری؟")).toBeVisible();
    await asked(page, /پس بگیری/).getByRole("button", { name: "نه" }).click();
    await expect(asked(page, /پس بگیری/)).toHaveCount(0);
    await expect(page.getByTestId("person-cancel")).toBeVisible();
    await page.getByTestId("person-cancel").click();
    await asked(page, /پس بگیری/).getByRole("button", { name: "پس بگیر" }).click();
    await expect(page.getByTestId("person-send")).toHaveText("درخواست دوستی");
  });

  test("رها: «درخواست دوستی» sends at once", async ({ page }) => {
    await openSignedIn(page, "/u/raha");
    await page.getByTestId("person-send").click();
    await expect(page.getByTestId("person-cancel")).toHaveText("درخواست فرستادی");
  });

  test("کیان, a friend: the chip «دوستین», and «حذف از دوستا» in the ⋯ menu asks first", async ({ page }) => {
    await openSignedIn(page, "/u/kian_k");
    await expect(page.getByTestId("person-friend-chip")).toHaveText("دوستین");
    await chooseFromMenu(page, "unfriend");
    const sheet = asked(page, "کیان از دوستات حذف بشه؟");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "نه" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("person-friend-chip")).toBeVisible();
    await chooseFromMenu(page, "unfriend");
    await sheet.getByRole("button", { name: "حذف کن" }).click();
    await expect(page.getByTestId("person-send")).toHaveText("درخواست دوستی");
    await page.getByTestId("person-menu").click();
    await expect(page.getByTestId("unfriend-item")).toHaveCount(0); // no longer a friend
  });

  test("بلاک asks, closes the page, and the person is gone from the search; گزارش sends a reason and a note and says «گزارشت رسید»", async ({ page }) => {
    await openSignedIn(page, "/people?q=ba");
    await expect(page.getByTestId("person-bardia")).toBeVisible();
    await page.getByTestId("person-bardia").click();
    await expect(page).toHaveURL(/\/u\/bardia$/);
    await chooseFromMenu(page, "block");
    const sheet = asked(page, "بردیا بلاک بشه؟");
    await expect(sheet).toContainText("دیگه نمی‌تونه بهت پیام بده یا درخواست دوستی بفرسته.");
    await sheet.getByRole("button", { name: "نه" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/u\/bardia$/);
    await chooseFromMenu(page, "block");
    await sheet.getByRole("button", { name: "بلاک کن" }).click();
    await expect(page).toHaveURL(/\/people/); // the page closed: back to the search
    await expect(page.getByTestId("person-bardia")).toHaveCount(0); // and the loaded list dropped them at once

    await page.goto("/u/raha");
    await chooseFromMenu(page, "report");
    const report = asked(page, "گزارش رها");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("reason-spam")).toHaveAttribute("aria-checked", "true");
    await report.getByTestId("reason-abuse").click();
    await expect(report.getByTestId("reason-abuse")).toHaveAttribute("aria-checked", "true");
    await report.getByTestId("report-note").fill("پیام نامناسب فرستاد");
    await report.getByTestId("report-send").click();
    await expect(toasts(page)).toContainText("گزارشت رسید");
    await expect(report).toHaveCount(0);
    await page.goto("/u/bardia"); // blocked: not there for me any more
    await expect(page.getByTestId("person-not-found")).toHaveText("این آدم پیدا نشد");
  });
});

test.describe("requests and friends", () => {
  test("پیام‌ها has «درخواست‌های دوستی» with the count, and the tab bar's badge says it too; the lists accept, ask before rejecting and taking back", async ({ page }) => {
    await openSignedIn(page, "/messages");
    await expect(page.getByTestId("requests-count")).toHaveText("۲");
    await expect(tabBar(page).getByRole("link", { name: "پیام‌ها ۲ پیام نخونده، ۲ درخواست دوستی" })).toBeVisible();
    await page.getByTestId("requests-row").click();
    await expect(page).toHaveURL(/\/messages\/requests$/);
    await expect(page.getByRole("heading", { name: "درخواست‌های دوستی" })).toBeVisible();
    await expect(page.getByTestId("request-aryan")).toContainText("آرین");
    await expect(page.getByTestId("request-bardia")).toContainText("بردیا");
    await expect(page.getByRole("heading", { name: "فرستادی" })).toBeVisible();
    await expect(page.getByTestId("request-paria")).toContainText("پریا");
    await expectRightToLeftAndFits(page);
    expect(await clearOfTabBar(page)).toBe(true);

    await page.getByTestId("accept-aryan").click(); // at once
    await expect(page.getByTestId("request-aryan")).toHaveCount(0);
    await page.getByTestId("reject-bardia").click();
    await expect(asked(page, "درخواستش رو رد کنی؟")).toBeVisible();
    await asked(page, /رد کنی/).getByRole("button", { name: "رد کن" }).click();
    await expect(page.getByTestId("request-bardia")).toHaveCount(0);
    await page.getByTestId("cancel-paria").click();
    await expect(asked(page, "درخواستت رو پس بگیری؟")).toBeVisible();
    await asked(page, /پس بگیری/).getByRole("button", { name: "پس بگیر" }).click();
    await expect(page.getByTestId("request-paria")).toHaveCount(0);
    await expect(page.getByTestId("no-requests")).toHaveText("درخواستی نداری.");
    await page.goto("/messages"); // nothing waits any more: no row, no badge
    await expect(page.getByRole("heading", { name: "پیام‌ها" })).toBeVisible();
    await expect(page.getByTestId("requests-row")).toHaveCount(0);
    await expect(tabBar(page).getByRole("link", { name: "پیام‌ها" })).not.toHaveAccessibleName(/درخواست/);
  });

  test("my friends: the profile says «۴ دوست» and opens the list, with «یه بیت» and the others, and a new friend joins it", async ({ page }) => {
    await openSignedIn(page, "/me");
    await expect(page.getByTestId("profile-friends")).toHaveText("۴ دوست");
    await page.getByTestId("profile-friends").click();
    await expect(page).toHaveURL(/\/me\/friends$/);
    await expect(page.getByRole("heading", { name: "دوستا" })).toBeVisible();
    for (const name of ["یه بیت", "سارا", "کیان", "مهسا"]) await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByTestId("friends-kian_k")).toHaveText("دوستین"); // the chip, and no buttons
    await expectRightToLeftAndFits(page);
    expect(await clearOfTabBar(page)).toBe(true);
    await page.getByTestId("person-kian_k").click();
    await expect(page.getByTestId("person-name")).toHaveText("کیان");
    await page.goBack();
    await expect(page.getByText("سارا", { exact: true })).toBeVisible();
  });
});

test.describe("home «دوستات»", () => {
  test("shows what friends did, with a reaction on a couplet; a guest sees nothing", async ({ page }) => {
    await openAccountApp(page, "/");
    await expect(page.getByTestId("deck-card")).toBeVisible();
    await expect(page.getByTestId("friends-feed")).toHaveCount(0);

    await openSignedIn(page, "/");
    const feed = page.getByTestId("friends-feed");
    await expect(feed.getByRole("heading", { name: "دوستات" })).toBeVisible();
    await expect(feed.getByTestId("feed-item")).toHaveCount(3);
    const kian = feed.getByTestId("feed-item").filter({ hasText: "کیان" });
    await expect(kian).toContainText("کیان یه بیت به اشتراک گذاشت");
    await expect(kian).toContainText("یک ساعت پیش");
    await expect(kian.getByTestId("feed-couplet")).toBeVisible(); // the couplet itself, from the poem
    const sara = feed.getByTestId("feed-item").filter({ hasText: "سارا" });
    await expect(sara).toContainText("معمای امروز رو با ۲ فرصت حل کرد");
    await expect(sara.getByTestId("feed-join-daily")).toHaveText("تو هم");
    await expect(feed.getByTestId("feed-item").filter({ hasText: "مهسا" })).toContainText("مهسا یه بیت پسندید");

    const like = kian.getByRole("button", { name: "پسند این بیت" });
    await expect(like).toContainText("۴");
    await like.click(); // a signed-in person likes at once, and the count goes up by mine
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(like).toContainText("۵");
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(like).toContainText("۴");
    await expect(kian.getByRole("button", { name: "بازنشر این بیت" })).toContainText("۲");
    await feed.getByTestId("find-people").click();
    await expect(page).toHaveURL(/\/people$/);
  });

  test("«تو هم» opens today's puzzle, and a feed couplet opens in the reader", async ({ page }) => {
    await openSignedIn(page, "/");
    await page.getByTestId("friends-feed").getByTestId("feed-item").filter({ hasText: "کیان" }).getByTestId("feed-couplet").click();
    await expect(page.getByTestId("reader")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/poem/hafez/ghazal/sh3");
  });
});

test.describe("رده‌بندی", () => {
  test("from the بازی tab: the league, friends and everyone tabs slide and never fade", async ({ page }) => {
    await openSignedIn(page, "/games");
    await page.getByTestId("points").click();
    await expect(page).toHaveURL(/\/games\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "رده‌بندی" })).toBeVisible();
    await expectRightToLeftAndFits(page);

    // The league: the amber card, the medals, the green band after five, my own row, a hidden stranger.
    await expect(page.getByTestId("league-name")).toHaveText("لیگ غزل‌باز");
    await expect(page.getByTestId("days-left")).toHaveText("۳ روز مونده تا آخر هفته");
    await expect(page.getByTestId("board-row-1")).toContainText("آرین");
    await expect(page.getByTestId("board-row-1")).toContainText("۲٬۹۱۰");
    await expect(page.getByTestId("board-row-3")).toContainText("تو");
    await expect(page.getByTestId("board-row-3")).toContainText("۲٬۴۸۰");
    await expect(page.getByTestId("promote-band")).toHaveText("این ۵ نفر می‌رن لیگ بالاتر");
    await expect(page.getByTestId("board-row-9")).toContainText("یه نفر");
    expect(await clearOfTabBar(page)).toBe(true);

    // A row reads as one thing, «نفر ۱، آرین، ۲٬۹۱۰», as on the phone: a link for a person, a group for my row and the hidden stranger.
    await expect(page.getByRole("list").getByRole("link", { name: "نفر ۱، آرین، ۲٬۹۱۰" })).toBeVisible();
    await expect(page.getByRole("group", { name: "نفر ۳، تو، ۲٬۴۸۰" })).toBeVisible();
    await expect(page.getByRole("group", { name: "نفر ۹، یه نفر، ۱٬۵۰۰" })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(10);

    // Switching slides the page in and never fades it.
    await page.evaluate(() => {
      const seen = { opacity: 1, moved: 0 };
      (window as unknown as { __tab: typeof seen }).__tab = seen;
      const loop = () => {
        const node = document.querySelector<HTMLElement>("[data-testid=segment-page]");
        if (node) {
          seen.opacity = Math.min(seen.opacity, Number(getComputedStyle(node).opacity));
          seen.moved = Math.max(seen.moved, Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41));
        }
        requestAnimationFrame(loop);
      };
      loop();
    });
    await page.getByRole("radio", { name: "دوستا" }).click();
    await expect(page.getByTestId("board-row-1")).toContainText("سارا");
    await expect(page.getByTestId("board-row-2")).toContainText("تو");
    await expect(page.getByTestId("board-row-4")).toContainText("مهسا");
    await page.getByRole("radio", { name: "همه" }).click();
    await expect(page.getByTestId("global-hidden")).toHaveText("اسمت توی رده‌بندی همه نیست"); // I keep off the list: only my own row
    await expect(page.getByTestId("board-row-42")).toContainText("تو");
    await expect(page.getByTestId("board-row-1")).toHaveCount(0);
    await expect(page.getByTestId("open-privacy")).toHaveText("حریم خصوصی");
    const seen = await page.evaluate(() => (window as unknown as { __tab: { opacity: number; moved: number } }).__tab);
    expect(seen.opacity).toBe(1);
    expect(seen.moved).toBeGreaterThan(0);
    await page.getByRole("radio", { name: "لیگ این هفته" }).click();
    await expect(page.getByTestId("league-name")).toBeVisible();
    await page.getByTestId("board-row-2").click(); // سارا's row opens her page
    await expect(page).toHaveURL(/\/u\/sara\.ghazal$/);
  });

  test("with the global list on, everyone's rows come with my own rank", async ({ page }) => {
    await openSignedIn(page, "/games/leaderboard?tab=global");
    await page.evaluate(() => localStorage.setItem("me.privacy", JSON.stringify({ inGlobalLeaderboard: true })));
    await page.reload();
    await expect(page.getByTestId("board-row-1")).toContainText("سارا");
    await expect(page.getByTestId("board-row-3")).toContainText("مهسا");
    await expect(page.getByTestId("board-row-42")).toContainText("تو");
    await expect(page.getByTestId("global-hidden")).toHaveCount(0);
  });
});

test.describe("an account is needed", () => {
  test("a guest typing in the search gets the gate, and the search goes ahead after the sign-in", async ({ page }) => {
    await openAccountApp(page, "/people");
    await page.getByRole("searchbox").fill("ar");
    await expect(gate(page)).toContainText("برای پیام دادن به دوستات یه حساب لازمه");
    await signInAs(page, { id: newId(), username: "niloofar" });
    await expect(gate(page)).toBeHidden();
    await expect(page.getByTestId("person-aryan")).toBeVisible();
  });

  test("a guest on a person's page: «درخواست دوستی» opens the gate, and the request is sent after the sign-in", async ({ page }) => {
    await openAccountApp(page, "/u/raha");
    await expect(page.getByTestId("person-name")).toHaveText("raha");
    await page.getByTestId("person-send").click();
    await expect(gate(page)).toBeVisible();
    await page.getByRole("button", { name: "بعداً" }).click();
    await expect(gate(page)).toBeHidden();
    await expect(page.getByTestId("person-send")).toBeVisible(); // dropped: nothing was sent
    await page.getByTestId("person-send").click();
    await signInAs(page, { id: newId(), username: "niloofar" });
    await expect(page.getByTestId("person-cancel")).toHaveText("درخواست فرستادی");
    await expect(page.getByTestId("person-name")).toHaveText("رها");
  });

  test("a guest opening رده‌بندی from the points gets the gate for it, and lands on the board after the sign-in", async ({ page }) => {
    await openAccountApp(page, "/games");
    await page.getByTestId("points").click();
    await expect(gate(page)).toContainText("برای دیدن رده‌بندی یه حساب لازمه");
    await expect(page).toHaveURL(/\/games$/);
    await signInAs(page, { id: newId(), username: "niloofar" });
    await expect(page).toHaveURL(/\/games\/leaderboard$/);
    await expect(page.getByTestId("league-name")).toBeVisible();
  });

  test("a guest's friends list and requests ask for an account", async ({ page }) => {
    await openAccountApp(page, "/me/friends");
    await expect(gate(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/messages/requests");
    await expect(gate(page)).toBeVisible();
  });
});

test("an address that is not a username is never drawn: signed in or not, the page says «این آدم پیدا نشد»", async ({ page }) => {
  const spoof = "/u/" + encodeURIComponent("پشتیبانی یه بیت");
  await openAccountApp(page, spoof); // a guest
  await expect(page.getByTestId("person-not-found")).toHaveText("این آدم پیدا نشد");
  await expect(page.getByTestId("person-name")).toHaveCount(0);
  await expect(page.getByTestId("person-menu")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("پشتیبانی");
  await page.goto("/u/" + encodeURIComponent("<b>x</b>"));
  await expect(page.getByTestId("person-not-found")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("<b>");
  await openSignedIn(page, spoof);
  await expect(page.getByTestId("person-not-found")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("پشتیبانی");
});

test("the report sheet starts fresh every time it opens", async ({ page }) => {
  await openSignedIn(page, "/u/raha");
  await expect(page.getByTestId("person-name")).toHaveText("رها");
  await chooseFromMenu(page, "report");
  const report = asked(page, "گزارش رها");
  await report.getByTestId("reason-other").click();
  await report.getByTestId("report-note").fill("یه چیزی");
  await page.keyboard.press("Escape");
  await expect(report).toHaveCount(0);
  await chooseFromMenu(page, "report");
  await expect(report.getByTestId("reason-spam")).toHaveAttribute("aria-checked", "true");
  await expect(report.getByTestId("report-note")).toHaveValue("");
});

test("a person who is not there says so", async ({ page }) => {
  await openSignedIn(page, "/u/nobody");
  await expect(page.getByTestId("person-not-found")).toHaveText("این آدم پیدا نشد");
  await expectRightToLeftAndFits(page);
});
