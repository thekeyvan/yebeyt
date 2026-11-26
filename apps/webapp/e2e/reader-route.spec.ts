import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openPoem, poem, stubNetwork } from "./reader";

const fixture = (name: string) => readFileSync(join(process.cwd(), "test/fixtures", name), "utf8");
const poets = JSON.parse(readFileSync(join(process.cwd(), "../ios/Yebeyt/Resources/Data/poets.json"), "utf8")) as { source: { sha: string } };
const raw = (path: string) => `https://raw.githubusercontent.com/ganjoor/ganjoor-data/${poets.source.sha}/poets${path}`;

const tabBar = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "تب‌ها" });

test.describe("opening and closing", () => {
  test("opened inside the app it rises over the page it came from, covers the tab bar, and the close button goes back to it", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/dev/stickers");
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await expect(page).toHaveURL(/\/poem\/hafez\/ghazal\/sh3\?c=1/);
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    await expect(page).toHaveTitle("حافظ · غزل ۳ · یه بیت");
    await page.waitForTimeout(700);

    // It covers the whole screen, the tab bar included, and nothing under it can be reached.
    const covering = await page.evaluate(() => {
      const bar = document.querySelector("nav")!.getBoundingClientRect();
      const top = document.elementFromPoint(bar.x + bar.width / 2, bar.y + bar.height / 2);
      return top?.closest("[data-testid=reader]") !== null;
    });
    expect(covering).toBe(true);
    expect(await page.locator("[inert]").count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page).toHaveURL(/\/dev\/stickers$/);
    await expect(page.getByRole("heading", { level: 2, name: "خوانش" })).toBeVisible();
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(tabBar(page)).toBeVisible();
    await expect(page.locator("[inert]")).toHaveCount(0);
  });

  test("going on to a game from the reader, «بازی با این بیت», leaves it and its menu behind, and closing the game comes back to the page", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/dev/stickers");
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "بازی با این بیت" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw" && url.searchParams.get("poem") === "/hafez/ghazal/sh3" && url.searchParams.get("c") === "1");
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL(/\/dev\/stickers$/);
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);
  });

  test("Escape closes it too", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/dev/stickers");
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/dev\/stickers$/);
  });

  test("opened by its link it is the whole page, and closing goes to the home", async ({ page }) => {
    await stubNetwork(page);
    await openPoem(page, "?c=4");
    await expect(page.getByTestId("reader")).toBeVisible();
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "بیتِ امروز" })).toBeVisible();
  });

  test("a pull down on the header closes it", async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "the pull is for a phone");
    await stubNetwork(page);
    await openPoem(page);
    const { width } = page.viewportSize()!;
    const grabber = (await page.getByTestId("reader-title").boundingBox())!;
    await page.mouse.move(width / 2, grabber.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(width / 2, grabber.y + i * 25);
    await page.mouse.up();
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });

  test("the address keeps the couplet and the mode: a reload and a link reopen the same one", async ({ page }) => {
    await stubNetwork(page);
    await openPoem(page, "?c=1");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/c=3$/);
    await page.reload();
    await expect(page.getByRole("img", { name: "بیت ۴ از ۹" })).toBeVisible();
    await page.getByRole("radio", { name: "کل شعر" }).click();
    await expect(page).toHaveURL(/c=3&mode=scroll$/);
    await page.reload();
    await expect(page.getByRole("radio", { name: "کل شعر" })).toBeChecked();
    // No history entry was made on the way: Back leaves the poem.
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(3);
  });

  test("the page has the poet and the poem as its title and its Open Graph text", async ({ page }) => {
    await page.goto(`${poem}?c=2`);
    await expect(page).toHaveTitle("حافظ · غزل ۳ · یه بیت");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "حافظ · غزل ۳");
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /لولیان/);
  });
});

test.describe("a poem that is not bundled", () => {
  const poemFile = (couplets: { Right: string; Left: string; summary?: string }[]) =>
    JSON.stringify({
      Id: 2093,
      Title: "قطعه شمارهٔ ۱",
      FullUrl: "/hafez/ghete/sh1",
      Verses: couplets.flatMap(({ Right, Left, summary }, index) => [
        { VOrder: index * 2 + 1, Position: "Right", Text: Right, CoupletIndex: index, CoupletSummary: summary },
        { VOrder: index * 2 + 2, Position: "Left", Text: Left, CoupletIndex: index },
      ]),
    });

  test("comes from ganjoor-data at the pinned commit, with the AI sparkle on an AI-written meaning", async ({ page }) => {
    await stubNetwork(page);
    const asked: string[] = [];
    await page.route(raw("/hafez/ghete/sh1.json"), (route) => {
      asked.push(route.request().url());
      return route.fulfill({ contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: fixture("raw-poem-ghete1.json") });
    });
    await page.goto("/poem/hafez/ghete/sh1?c=0&meaning=1");
    await expect(page.getByTestId("reader-title")).toHaveText("قطعه ۱");
    await expect(page.getByTestId("reader-subtitle")).toHaveText("حافظ · قطعات");
    expect(asked).toEqual([raw("/hafez/ghete/sh1.json")]);
    const card = page.getByRole("region", { name: "معنی" });
    await expect(card).not.toContainText("هوش مصنوعی:");
    await card.getByRole("button", { name: "با کمک هوش مصنوعی" }).click();
    await expect(page.getByRole("region", { name: "اعلان‌ها" })).toContainText("این معنی با کمک هوش مصنوعی نوشته شده");
  });

  test("works offline once it has been opened", async ({ page, browserName }) => {
    // Playwright's WebKit runs in a throw-away profile that keeps no Cache Storage across a reload (a persistent profile does).
    test.skip(browserName === "webkit", "WebKit's test profile keeps no Cache Storage");
    await stubNetwork(page);
    await page.route(raw("/hafez/ghete/sh1.json"), (route) => route.fulfill({ contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: fixture("raw-poem-ghete1.json") }));
    await page.goto("/poem/hafez/ghete/sh1");
    await expect(page.getByTestId("reader-title")).toHaveText("قطعه ۱");
    await page.waitForTimeout(300);
    await page.unroute(raw("/hafez/ghete/sh1.json"));
    await page.reload();
    await expect(page.getByTestId("reader-title")).toHaveText("قطعه ۱");
    await expect(page.getByTestId("reader-subtitle")).toHaveText("حافظ · قطعات");
  });

  test("says «شعر باز نشد» when it cannot load, and «دوباره» tries again", async ({ page }) => {
    await stubNetwork(page);
    let fail = true;
    await page.route(raw("/hafez/ghete/sh1.json"), (route) => (fail ? route.fulfill({ status: 503, body: "" }) : route.fulfill({ contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: poemFile([{ Right: "الف", Left: "ب" }, { Right: "پ", Left: "ت" }]) })));
    await page.goto("/poem/hafez/ghete/sh1");
    await expect(page.getByRole("alert").filter({ hasText: "شعر باز نشد" })).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "دوباره" }).click();
    await expect(page.getByTestId("reader-title")).toHaveText("قطعه ۱");
    await expect(page.getByTestId("reader-subtitle")).toHaveText("حافظ · قطعات");
    // No meaning for these couplets: no chip.
    await expect(page.getByRole("button", { name: "معنی این بیت" })).toHaveCount(0);
  });

  test("an address that tries to leave ganjoor-data is refused, and nothing is fetched for it", async ({ page }) => {
    const asked: string[] = [];
    await stubNetwork(page);
    await page.route((url) => url.hostname !== "localhost", (route) => {
      asked.push(route.request().url());
      return route.abort();
    });
    for (const path of ["/poem/hafez/%252e%252e/%252e%252e/attacker/repo/main/x", "/poem/hafez/..%5C..%5C..%5Cattacker%5Crepo%5Cmain%5Cx"]) {
      await page.goto(path);
      await expect(page.getByRole("alert").filter({ hasText: "شعر باز نشد" })).toBeVisible();
    }
    expect(asked.filter((url) => url.includes("raw.githubusercontent.com"))).toEqual([]);
  });

  test("a poem that does not exist says so too", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/poem/hafez/nothing/sh9");
    await expect(page.getByRole("alert").filter({ hasText: "شعر باز نشد" })).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the reader does not slide up, and a press makes no particles", async ({ page }) => {
    await stubNetwork(page);
    await page.goto("/dev/stickers");
    const samples = page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const seen: string[] = [];
          const stop = Date.now() + 1500;
          const tick = () => {
            const reader = document.querySelector<HTMLElement>("[data-testid=reader]");
            if (reader) seen.push(getComputedStyle(reader).transform);
            if (Date.now() < stop) requestAnimationFrame(tick);
            else resolve(seen);
          };
          tick();
        }),
    );
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    for (const transform of await samples) expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

    await page.getByRole("button", { name: "نگه دار" }).click();
    await page.waitForTimeout(150);
    await expect(page.getByRole("button", { name: "نگه دار" }).locator("span.absolute")).toHaveCount(0);
  });
});
