import { expect, test } from "@playwright/test";
import { openApp, tabBar } from "./browse";
import { daily, fire, green, savedStats, tapKeys, typeKey } from "./games";
import { afterPaint } from "./reader";

const allGames = ["معمای امروز", "جورچین بیت", "حدس شاعر", "مصراع دوم", "از کدوم کتاب؟", "معنی‌یاب", "گوش کن", "مشاعره", "بازی رودررو"];

test.describe("the tab and the catalog", () => {
  test("the tab shows the streak, the points, today's puzzle and four games", async ({ page }) => {
    await openApp(page, "/games");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازی");
    await expect(page.getByTestId("streak")).toHaveAccessibleName("رشته‌ی ۰ روزه");
    await expect(page.getByTestId("points")).toHaveAccessibleName("امتیاز ۰ و رده‌بندی");
    const card = page.getByTestId("daily-card");
    await expect(card).toContainText("معمای امروز · ۳ فرصت");
    await expect(card).toContainText("کلمه‌ی گم‌شده");
    await expect(card.getByRole("img", { name: "کلمه‌ی گم‌شده، ۴ حرفی" })).toBeVisible();
    await expect(card).toContainText("سرمایهٔ");
    await expect(card).toContainText("ستمیم");
    await expect(card.getByTestId("daily-open")).toHaveText("بزن بریم");
    for (const name of ["جورچین بیت", "حدس شاعر", "مصراع دوم", "از کدوم کتاب؟"]) await expect(page.getByRole("link", { name }).or(page.getByRole("button", { name }))).toBeVisible();
  });

  test("the catalog shows every game", async ({ page }) => {
    await openApp(page, "/games");
    await page.getByTestId("all-games").click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/catalog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازی‌ها");
    for (const kind of ["daily", "jigsaw", "poet", "misra", "book", "match", "listen", "mosh", "duel"]) await expect(page.getByTestId(`catalog-${kind}`)).toBeVisible();
    const names = await page.locator("[data-testid^=catalog-]").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label")!.split("،")[0]));
    expect(names).toEqual(allGames);
    await expect(page.getByTestId("catalog-daily")).toHaveAccessibleName("معمای امروز، روزانه · ۱ دقیقه · رشته‌ی روزها");
  });

  test("the games with a friend and the leaderboard ask for an account, as they do for a guest on the phone", async ({ page }) => {
    await openApp(page, "/games/catalog");
    await page.getByTestId("catalog-mosh").click();
    await expect(page.getByRole("dialog")).toContainText("برای مشاعره با دوستات");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("catalog-duel").click();
    await expect(page.getByRole("dialog")).toContainText("یه حساب لازمه");
    await page.keyboard.press("Escape");
    await page.goto("/games");
    await page.getByTestId("points").click();
    await expect(page.getByRole("dialog")).toContainText("برای دیدن رده‌بندی");
  });

  test("the catalog's cards open every solo game at its page", async ({ page }) => {
    for (const kind of ["daily", "poet", "misra", "book", "match", "listen"]) {
      await openApp(page, "/games/catalog");
      await page.getByTestId(`catalog-${kind}`).click();
      await expect(page).toHaveURL((url) => url.pathname === `/games/${kind}`);
      await expect(page.getByTestId("game")).toBeVisible();
    }
  });
});

test.describe("معمای امروز", () => {
  test("a wrong try greys its letters and the keys and spends a try; solving it gives the sheet, +70 and the streak, and a reload finds it solved", async ({ page }) => {
    await openApp(page, "/games");
    await page.getByTestId("daily-open").click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/daily");
    await expect(page.getByTestId("game")).toBeVisible();
    await expect(page.getByTestId("daily-couplet")).toContainText(daily.first);
    await expect(page.getByTestId("blank")).toBeVisible();
    await expect(page.getByTestId("submit")).toBeDisabled();

    await tapKeys(page, daily.misses[0]!);
    await page.getByTestId("submit").click();
    const spent = page.getByTestId("try-1").locator("[data-mark]");
    await expect(spent).toHaveCount(4);
    for (const mark of await spent.all()) await expect(mark).toHaveAttribute("data-mark", "grey");
    await expect(page.locator('[data-key="ر"]')).toHaveAttribute("data-mark", "grey");
    await expect(page.getByTestId("answer-sheet")).toHaveCount(0);

    await tapKeys(page, daily.word);
    await page.getByTestId("submit").click();
    for (const mark of await page.getByTestId("try-2").locator("[data-mark]").all()) await expect(mark).toHaveAttribute("data-mark", "green");
    const sheet = page.getByTestId("answer-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("verdict")).toHaveText("درست چسبوندی!");
    await expect(sheet).toContainText("+۷۰");
    await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", green);
    await expect(sheet).toContainText("یعنی چی؟");
    await expect(page.getByTestId("daily-couplet")).toContainText("نهادِ");
    await expect(page.getByTestId("blank")).toHaveCount(0);
    await expect(page.getByTestId("game").getByLabel("رشته‌ی ۱ روزه")).toBeVisible();

    const saved = await savedStats(page);
    expect(saved.points).toBe(70);
    expect(saved.solvedDays).toEqual([daily.day]);
    expect(saved.daily?.[daily.day]).toMatchObject({ tries: ["رلمگ", "نهاد"], outcome: "solved", points: 70 });

    await page.reload();
    await expect(page.getByTestId("answer-sheet")).toBeVisible();
    await expect(page.getByTestId("verdict")).toHaveText("درست چسبوندی!");

    await page.getByTestId("next").click();
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("daily-solved")).toContainText(daily.first);
    await expect(page.getByTestId("daily-open")).toHaveText("ببین");
    await expect(page.getByTestId("streak")).toHaveAccessibleName("رشته‌ی ۱ روزه");
    await expect(page.getByTestId("points")).toHaveAccessibleName("امتیاز ۷۰ و رده‌بندی");
  });

  test("three wrong tries end it: the sheet shows the right word and nothing is earned", async ({ page }) => {
    await openApp(page, "/games/daily");
    for (const miss of daily.misses) {
      await tapKeys(page, miss);
      await page.getByTestId("submit").click();
    }
    await expect(page.getByTestId("answer-sheet")).toBeVisible();
    await expect(page.getByTestId("verdict")).toHaveText("نه، این بود");
    await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", fire);
    await expect(page.getByTestId("correction")).toHaveText("نهاد");
    await expect(page.getByTestId("daily-couplet")).toContainText("نهادِ");
    expect((await savedStats(page)).points ?? 0).toBe(0);
    await page.getByTestId("next").click();
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("daily-open")).toHaveText("ببین");
    await expect(page.getByTestId("streak")).toHaveAccessibleName("رشته‌ی ۰ روزه");
  });

  test("the spent tries show as red dots, and the bulb gives a letter for 30", async ({ page }) => {
    await openApp(page, "/games/daily");
    await page.getByRole("button", { name: "یه حرف، ۳۰ امتیاز" }).click();
    await expect(page.getByTestId("try-1").locator("span").first()).toContainText("ن");
    await tapKeys(page, daily.word.slice(1));
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("answer-sheet")).toContainText("+۷۰");
    expect((await savedStats(page)).daily?.[daily.day]?.hinted).toEqual([0]);
  });

  test("a physical keyboard types Persian letters, Backspace takes one back and Enter checks", async ({ page }) => {
    await openApp(page, "/games/daily");
    await expect(page.getByTestId("daily-couplet")).toBeVisible();
    await afterPaint(page);
    for (const letter of "رلمگ") await typeKey(page, letter);
    await page.keyboard.press("Backspace");
    await typeKey(page, "گ");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("try-1").locator("[data-mark=grey]")).toHaveCount(4);
    await page.keyboard.press("q");
    await expect(page.getByTestId("try-2").locator("span", { hasText: /\S/ })).toHaveCount(0);
  });

  test("closing it needs no question, and the page it came from is under it all the while", async ({ page }) => {
    await openApp(page, "/games");
    await page.getByTestId("daily-open").click();
    await expect(page.getByTestId("game")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "بازی" })).toHaveCount(1);
    await tapKeys(page, daily.misses[0]!);
    await page.getByTestId("submit").click();
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("daily-open")).toHaveText("بزن بریم"); // a try is kept, the puzzle is not over
    await page.getByTestId("daily-open").click();
    await expect(page.getByTestId("try-1").locator("[data-mark=grey]")).toHaveCount(4);
  });
});

test.describe("every screen", () => {
  for (const path of ["/games", "/games/catalog", "/games/daily", "/games/jigsaw"]) {
    test(`${path} is right to left, does not scroll sideways, and keeps clear of the tab bar`, async ({ page }) => {
      await openApp(page, path);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
      await page.waitForTimeout(600);
      const sideways = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sideways.scroll).toBeLessThanOrEqual(sideways.client);
      if (path.startsWith("/games/daily") || path.startsWith("/games/jigsaw")) {
        // A game is the whole screen: its bottom bar is the last thing, and it is not under anything.
        const { height } = page.viewportSize()!;
        const bar = (await page.getByTestId(path.endsWith("daily") ? "submit" : "check").boundingBox())!;
        expect(bar.y + bar.height).toBeLessThanOrEqual(height);
        return;
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);
      const lowest = await page.evaluate(() => Math.max(...[...document.querySelectorAll("main *")].map((element) => element.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0).map((box) => box.bottom)));
      const bar = (await tabBar(page).boundingBox())!;
      if (page.viewportSize()!.width < 1024) expect(lowest).toBeLessThanOrEqual(bar.y);
    });
  }

  test("a game covers the tab bar and nothing under it can be reached, and the page under it comes back", async ({ page }) => {
    await openApp(page, "/games");
    await page.getByTestId("game-jigsaw").click();
    await expect(page.getByTestId("game")).toBeVisible();
    await page.waitForTimeout(700);
    const covering = await page.evaluate(() => {
      const bar = document.querySelector("nav")!.getBoundingClientRect();
      return document.elementFromPoint(bar.x + bar.width / 2, bar.y + bar.height / 2)?.closest("[data-testid=game]") !== null;
    });
    expect(covering).toBe(true);
    expect(await page.locator("[inert]").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.locator("[inert]")).toHaveCount(0);
    await expect(tabBar(page)).toBeVisible();
  });
});
