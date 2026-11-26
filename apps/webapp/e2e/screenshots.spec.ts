import { test } from "@playwright/test";
import { openApp } from "./browse";
import { answerCouplet, centreOf, coupletOnCard, daily, emptySlots, holdAndMove, openRound, tapKeys } from "./games";
import { openPoem, stubNetwork } from "./reader";

// Screenshots of the screens that prove the shell (not committed: e2e/__screenshots__ is ignored).
const shot = (name: string) => ({ path: `e2e/__screenshots__/${name}.png` });

test("home and the sticker page", async ({ page }, info) => {
  const { width, height } = page.viewportSize()!;
  const size = `${width}x${height}`;
  test.skip(!info.project.name.startsWith("chromium") || width === 390, "one browser, the two sizes of the brief");
  await page.goto("/");
  await page.screenshot(shot(`home-${size}`));
  await page.goto("/dev/stickers");
  await page.screenshot(shot(`stickers-${size}`));
});

test("a sheet open on the phone", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("chromium") || page.viewportSize()!.width !== 375, "the phone size of the brief");
  await page.goto("/dev/stickers");
  await page.getByRole("button", { name: "باز کردن برگه" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot(shot("sheet-375x667"));
});

test.describe("the reader", () => {
  test.beforeEach(async ({ page }, info) => {
    const { width } = page.viewportSize()!;
    test.skip(!info.project.name.startsWith("chromium") || width === 390, "one browser, the two sizes of the brief");
    await stubNetwork(page);
  });

  test("couplet mode", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await openPoem(page, "?c=1");
    await page.waitForTimeout(500);
    await page.screenshot(shot(`reader-couplet-${width}x${height}`));
  });

  test("meaning, whole poem, hold menu, text sheet and player", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    test.skip(width > 375, "the boards are phone boards");
    const size = `${width}x${height}`;
    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "معنی این بیت" }).click();
    await page.waitForTimeout(1200);
    await page.screenshot(shot(`reader-meaning-${size}`));

    await openPoem(page, "?c=1&mode=scroll");
    await page.waitForTimeout(500);
    await page.screenshot(shot(`reader-whole-${size}`));
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot(shot(`reader-hold-${size}`));
    await page.keyboard.press("Escape");

    await openPoem(page, "?c=1");
    await page.getByRole("button", { name: "اندازه‌ی حروف" }).click();
    await page.getByRole("dialog", { name: "متن" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot(shot(`reader-text-${size}`));
    await page.getByRole("button", { name: "تمام" }).click();
    await page.getByRole("dialog", { name: "متن" }).waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "پخش خوانش" }).first().click();
    await page.getByRole("region", { name: "خوانش" }).waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot(shot(`reader-player-${size}`));
  });
});

// The screens of W2 (home, explore, the library and search), on the fixed day with nothing from the network.
test.describe("browsing", () => {
  const screens = [
    { name: "home", path: "/", also: true },
    { name: "explore", path: "/explore" },
    { name: "library", path: "/explore/library", also: true },
    { name: "book", path: "/explore/book/hafez" },
    { name: "section", path: "/explore/section/hafez/ghazal" },
    { name: "poet", path: "/explore/poet/hafez" },
    { name: "poets", path: "/explore/poets" },
    { name: "search", path: "/explore/search?q=ساقی" },
    { name: "mood", path: "/explore/mood/love" },
  ];

  for (const { name, path, also } of screens) {
    test(name, async ({ page }, info) => {
      const { width, height } = page.viewportSize()!;
      test.skip(!info.project.name.startsWith("chromium") || width === 390 || (width > 375 && !also), "one browser; the phone, and the wide screen for two");
      await openApp(page, path);
      await page.locator("main [aria-busy=true]").waitFor({ state: "detached" });
      await page.waitForTimeout(1200);
      await page.screenshot(shot(`web2-${name}-${width}x${height}`));
    });
  }

  test("fal", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("chromium") || page.viewportSize()!.width !== 375, "the phone size of the brief");
    await openApp(page, "/explore");
    await page.getByTestId("fal").click();
    await page.getByTestId("couplet-0").waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot(shot("web2-fal-375x667"));
  });
});

// The screens of W3a (the games), on the fixed day and the fixed جورچین round with nothing from the network.
test.describe("the games", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("chromium") || page.viewportSize()!.width === 390, "one browser, the two sizes of the brief");
  });

  test("the tab, the catalog and the daily puzzle", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    const size = `${width}x${height}`;
    await openRound(page, "/games");
    await page.getByTestId("daily-card").waitFor();
    await page.waitForTimeout(800);
    if (width === 375) await page.screenshot(shot(`web3a-tab-${size}`));
    await page.getByTestId("all-games").click();
    await page.getByTestId("catalog-daily").waitFor();
    await page.waitForTimeout(800);
    await page.screenshot(shot(`web3a-catalog-${size}`));
    test.skip(width > 375, "the phone size of the brief");

    await page.goto("/games/daily");
    await page.getByTestId("daily-couplet").waitFor();
    await tapKeys(page, daily.misses[0]!);
    await page.getByTestId("submit").click();
    await tapKeys(page, daily.word.slice(0, 2));
    await page.waitForTimeout(900);
    await page.screenshot(shot(`web3a-daily-mid-${size}`));
    await tapKeys(page, daily.word.slice(2));
    await page.getByTestId("submit").click();
    await page.getByTestId("answer-sheet").waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot(shot(`web3a-daily-solved-${size}`));
  });

  test("جورچین: mid-drag, wrong with the sheet, and the end of the round", async ({ page, browserName }) => {
    test.setTimeout(150_000);
    const { width, height } = page.viewportSize()!;
    const size = `${width}x${height}`;
    await openRound(page, "/games");
    await page.getByTestId("game-jigsaw").click();
    await page.getByTestId("jigsaw-card").waitFor();
    await page.waitForTimeout(900);
    const { words } = await coupletOnCard(page);
    const [first, second] = await emptySlots(page);
    const sticker = page.locator(`[data-testid^=sticker-][data-word="${words[first!]}"]`).first();
    await sticker.scrollIntoViewIfNeeded();
    const release = await holdAndMove(page, browserName, await centreOf(sticker), await centreOf(page.getByTestId(`slot-${second}`)));
    await page.screenshot(shot(`web3a-jigsaw-drag-${size}`));
    await release();
    await page.waitForTimeout(600);
    if (width > 375) await page.screenshot(shot(`web3a-jigsaw-${size}`));
    test.skip(width > 375, "the phone size of the brief");

    await page.reload();
    await page.getByTestId("jigsaw-card").waitFor();
    await answerCouplet(page, "wrong");
    await page.waitForTimeout(1000);
    await page.screenshot(shot(`web3a-jigsaw-wrong-${size}`));
    await page.getByTestId("next").click();
    for (let index = 1; index < 10; index++) {
      await answerCouplet(page, index < 7 ? "right" : "wrong");
      await page.getByTestId("next").click();
    }
    await page.getByTestId("round-end").waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot(shot(`web3a-round-end-${size}`));
  });
});
