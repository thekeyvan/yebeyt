import { expect, test, type Page } from "@playwright/test";
import { closeReader, coupletInAddress, expectReader, openApp } from "./browse";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("explore has the search field, the fal, the moods, the poets and the shelf", async ({ page }) => {
  await openApp(page, "/explore");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کاوش");
  await expect(page.getByTestId("search-field")).toContainText("شاعر، شعر یا یه تیکه از بیت…");
  await expect(page.getByTestId("fal")).toContainText("فال حافظ");
  await expect(page.getByRole("link", { name: "عشق" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["شاعرها", "کتابخونه"]);
  await expect(page.getByRole("link", { name: "حافظ" }).first()).toBeVisible();
  await expect(page.getByTestId("book-9")).toContainText("دیوان حافظ");
  await expect(page.locator("[data-testid^=book-]")).toHaveCount(3);
});

test("a poet's page: the card, the books, the most read, and following survives a reload", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByRole("link", { name: "حافظ" }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/hafez");
  await expect(page.getByTestId("poet-name")).toHaveText("حافظ");
  await expect(page.getByText("شیراز · قرن هشتم")).toBeVisible();
  await expect(page.getByText("شاعرِ غزل")).toBeVisible();
  await expect(page.getByRole("link", { name: "غزلیات" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("پرخواننده‌ترین غزل‌ها");
  await expect(page.getByTestId("top-3")).toBeVisible();

  const follow = page.getByTestId("follow");
  await expect(follow).toHaveText("دنبال کن");
  await follow.click();
  await expect(follow).toHaveText("دنبال می‌کنی");
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByTestId("follow")).toHaveText("دنبال می‌کنی");
  expect(await page.evaluate(() => localStorage.getItem("library.follows"))).toBe('["poet:hafez"]');
  await page.getByTestId("follow").click();
  await expect(page.getByTestId("follow")).toHaveText("دنبال کن");
});

test("a poet's most read poem opens the reader, and the bio opens with «بیشتر بخون»", async ({ page }) => {
  await openApp(page, "/explore/poet/hafez");
  const more = page.getByRole("button", { name: "بیشتر بخون" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.getByTestId("top-1").click();
  await expect(page.getByTestId("reader")).toBeVisible();
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/hafez");
});

test("all the poets: every circle of the library, each a link to its page", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByRole("link", { name: "همه", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poets");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("شاعرها");
  await expect(page.locator("[data-testid^=poet-]:not([data-testid=poet-name])")).toHaveCount(48);
  await page.getByTestId("poet-saadi").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/saadi");
  await page.getByRole("button", { name: "برگشت" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poets");
});

test("a mood lists couplets, and one opens the reader at its couplet", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByRole("link", { name: "عشق" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/mood/love");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("عشق");
  const rows = page.locator("[data-testid^=couplet-]");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBe(60);
  const first = (await rows.first().getAttribute("data-testid"))!.replace("couplet-", "");
  const [path, index] = first.split("#") as [string, string];
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`${path}\\?c=${index}`));
  expect(coupletInAddress(page)).toBe(Number(index));
  await expect(page.getByTestId("reader")).toBeVisible();
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/explore/mood/love");
});

test("a mood that does not exist says so", async ({ page }) => {
  await openApp(page, "/explore/mood/nothing");
  await expect(page.getByText("اینجا چیزی پیدا نشد")).toBeVisible();
});

test("the fal opens a ghazal of Hafez in the whole-poem view, and closing goes back to explore", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByTestId("fal").click();
  await expect(page).toHaveURL(/\/poem\/hafez\/ghazal\/sh\d+\?c=0&mode=scroll/);
  await expect(page.getByTestId("reader-title")).toHaveText(/^غزل [۰-۹]+$/);
  await expect(page.getByTestId("couplet-0")).toBeVisible(); // whole-poem rows
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/explore");
});

test("search finds couplets for «ساقی», a result opens the reader at its couplet", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByTestId("search-field").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/search");
  const box = page.getByRole("searchbox", { name: "شاعر، شعر یا یه تیکه از بیت…" });
  await expect(box).toBeFocused();
  await box.fill("ساقی");
  await expect(page.getByRole("heading", { level: 2, name: "بیت‌ها" })).toBeVisible();
  await expect(page).toHaveURL(/\/explore\/search\?q=%D8%B3%D8%A7%D9%82%DB%8C/);
  const rows = page.locator("[data-testid^=couplet-]");
  expect(await rows.count()).toBeGreaterThan(5);
  const [path, index] = (await rows.first().getAttribute("data-testid"))!.replace("couplet-", "").split("#") as [string, string];
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`${path}\\?c=${index}`));
  await expect(page.getByTestId("reader")).toBeVisible();
  expect(coupletInAddress(page)).toBe(Number(index));
  await closeReader(page);
  await expect(page).toHaveURL(/\/explore\/search\?q=/);
  await expect(page.getByRole("searchbox")).toHaveValue("ساقی");
});

test("search by its address, with poets and books by name, and nothing found", async ({ page }) => {
  await openApp(page, "/explore/search?q=حافظ");
  await expect(page.getByRole("heading", { level: 2, name: "شاعرها" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "کتاب‌ها" })).toBeVisible();
  await expect(page.getByRole("link", { name: /دیوان حافظ/ })).toBeVisible();
  await page.getByRole("searchbox").fill("zzzzqq");
  await expect(page.getByTestId("nothing-found")).toHaveText("چیزی پیدا نشد");
  await page.getByRole("searchbox").fill("");
  await expect(page.getByTestId("nothing-found")).toHaveCount(0);
});

test("the library: the books, the type chips, a search, and a book's page", async ({ page }) => {
  await openApp(page, "/explore");
  await page.getByRole("link", { name: "همه‌ی کتاب‌ها" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کتابخونه");
  await expect(page.getByText("۹۹ کتاب از ۴۸ شاعر")).toBeVisible();
  await expect(page.locator("[data-testid^=book-]")).toHaveCount(99);
  await page.getByRole("button", { name: "رباعی" }).click();
  await expect(page.getByRole("button", { name: "رباعی" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("[data-testid^=book-]").count()).toBeLessThan(99);
  await page.getByRole("button", { name: "همه" }).click();
  await page.getByRole("searchbox", { name: "کتاب یا شاعر…" }).fill("گلستان");
  await expect(page.locator("[data-testid^=book-]")).toHaveCount(1);
  await page.getByRole("searchbox").fill("حافظ");
  await page.getByTestId("book-9").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/book/hafez");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("دیوان حافظ");
  await expect(page.getByText("قرن هشتم · ۶۹۵ شعر · با خوانش")).toBeVisible();
  await expect(page.getByTestId("primary")).toHaveText("شروع: غزل ۱");
  await expect(page.getByTestId("random")).toHaveText("یه غزل تصادفی");
  await expect(page.getByRole("link", { name: /غزلیات/ })).toContainText("۴۹۵ غزل");
  await page.getByTestId("poet-chip").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/hafez");
});

test("a book is kept with its bookmark, and a random poem opens the reader", async ({ page }) => {
  await openApp(page, "/explore/book/hafez");
  const keep = page.getByRole("button", { name: "نگه داشتن کتاب" });
  await keep.click();
  await expect(keep).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("library.follows"))).toBe('["book:9"]');
  await page.getByTestId("random").click();
  await expect(page).toHaveURL(/\/poem\/hafez\/ghazal\/sh\d+\?c=0/);
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/explore/book/hafez");
});

test("library, a book, a section, a poem, then close back to the same place in the list", async ({ page }) => {
  await openApp(page, "/explore/library");
  await page.getByTestId("book-9").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/book/hafez");
  await page.getByRole("link", { name: /^غزلیات/ }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/section/hafez/ghazal", { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("غزلیات");
  await expect(page.getByText("دیوان حافظ · ۴۹۵ غزل")).toBeVisible();
  await expect(page.getByTestId("poem-3")).toBeVisible();

  const row = page.getByTestId("poem-20");
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // the rows that came into view have their real height now
  await row.click();
  await expect(page).toHaveURL(/\/poem\/hafez\/ghazal\/sh20\?c=0/);
  await expectReader(page, "غزل ۲۰");
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(300);
  await closeReader(page);
  await expect(page).toHaveURL((url) => url.pathname === "/explore/section/hafez/ghazal");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(3);
  // It is now the poem in progress.
  await expect(page.getByTestId("poem-20")).toContainText("داری می‌خونی");
});

test("a section's sorts and search: by the last letter, by popularity, by number and by a word", async ({ page }) => {
  await openApp(page, "/explore/section/hafez/ghazal");
  const numbers = async () => (await page.locator("[data-testid^=poem-]").evaluateAll((rows) => rows.slice(0, 3).map((row) => row.getAttribute("data-testid"))));
  await expect(page.getByTestId("poem-1")).toBeVisible();
  expect(await numbers()).toEqual(["poem-1", "poem-2", "poem-3"]);
  await page.getByRole("radio", { name: "پرخواننده" }).click();
  await expect.poll(numbers).not.toEqual(["poem-1", "poem-2", "poem-3"]);
  await page.getByRole("radio", { name: "حرف آخر" }).click();
  await page.getByRole("radio", { name: "شماره" }).click();
  await expect.poll(numbers).toEqual(["poem-1", "poem-2", "poem-3"]);
  await page.getByRole("searchbox", { name: "یه کلمه یا شماره‌ی غزل…" }).fill("۱۲۱");
  await expect(page.locator("[data-testid^=poem-]")).toHaveCount(1);
  await expect(page.getByTestId("poem-121")).toBeVisible();
  await page.getByRole("searchbox").fill("الا یا ایها الساقی");
  await expect(page.getByTestId("poem-1")).toBeVisible();
});

test("the sorts slide in from their side and never fade, and under reduced motion do not slide", async ({ page }) => {
  await openApp(page, "/explore/section/hafez/ghazal");
  await expect(page.getByTestId("poem-1")).toBeVisible();
  const firstFrame = () =>
    page.evaluate(
      () =>
        new Promise<{ x: number; opacity: string }>((resolve) => {
          const watch = new MutationObserver(() => {
            const moving = document.querySelector<HTMLElement>("[data-testid=segment-page]");
            if (moving?.style.transform && moving.style.transform !== "none") {
              watch.disconnect();
              resolve({ x: new DOMMatrix(getComputedStyle(moving).transform).m41, opacity: getComputedStyle(moving).opacity });
            }
          });
          watch.observe(document.body, { subtree: true, childList: true, attributes: true });
        }),
    );
  const seen = firstFrame();
  await page.getByRole("radio", { name: "حرف آخر" }).click();
  const { x, opacity } = await seen;
  // «حرف آخر» is after «شماره», so at the left in right-to-left: its page comes from the left.
  expect(x).toBeLessThan(0);
  expect(opacity).toBe("1");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the sorts do not slide", async ({ page }) => {
    await openApp(page, "/explore/section/hafez/ghazal");
    await expect(page.getByTestId("poem-1")).toBeVisible();
    await page.getByRole("radio", { name: "حرف آخر" }).click();
    await page.waitForTimeout(50);
    const x = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector("[data-testid=segment-page]")!).transform).m41);
    expect(x).toBe(0);
  });
});

test("«ادامه بده» shows where the reading was left, in the library and on the book", async ({ page }) => {
  await openApp(page, "/explore/library");
  await expect(page.getByTestId("book-9")).toBeVisible();
  await expect(page.getByTestId("continue")).toHaveCount(0);

  await page.goto("/poem/hafez/ghazal/sh3?c=4");
  await expectReader(page, "غزل ۳");
  await page.getByRole("button", { name: "بستن" }).click(); // the link opened it as the whole page: it closes to the home
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await page.goto("/explore/library");
  const card = page.getByTestId("continue");
  await expect(card).toContainText("ادامه بده");
  await expect(card).toContainText("دیوان حافظ · غزل ۳");
  await card.click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/book/hafez");
  await expect(page.getByTestId("primary")).toHaveText("ادامه: غزل ۳");
  await page.getByTestId("primary").click();
  await expect(page).toHaveURL(/\/poem\/hafez\/ghazal\/sh3\?c=4/);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("reader.progress")))!)).toMatchObject({ last: { path: "/hafez/ghazal/sh3", couplet: 4, title: "غزل ۳" } });
});

test("a poem read to its last couplet, or the whole poem to its end, is «خوندی»", async ({ page }) => {
  await openApp(page, "/poem/hafez/ghazal/sh3?c=8");
  await expectReader(page, "غزل ۳");
  await page.goto("/poem/hafez/ghazal/sh2?mode=scroll");
  await expect(page.getByTestId("couplet-0")).toBeVisible();
  await page.getByTestId("couplet-7").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("reader.progress") ?? "{}") as { finished?: string[] }).finished?.includes("/hafez/ghazal/sh2"))).toBe(true);
  await page.goto("/explore/section/hafez/ghazal");
  await expect(page.getByTestId("poem-3")).toContainText("خوندی");
  await expect(page.getByTestId("poem-2")).toContainText("خوندی");
  await expect(page.getByText("۲ تا خوندی")).toBeVisible();
});

test("poet pictures come from the server through the web app's own route, and the letters show until they load", async ({ page }) => {
  let pictureAsked = 0;
  await openApp(page, "/explore");
  await page.route("**/api/v1/poets/pictures", (route) => route.fulfill({ json: [{ slug: "hafez", version: "ab12", url: "/v1/poets/hafez/picture?v=ab12" }] }));
  await page.route("**/api/v1/poets/hafez/picture?v=ab12", (route) => {
    pictureAsked++;
    return route.fulfill({ body: png, contentType: "image/png", headers: { etag: '"ab12"', "cache-control": "public, max-age=86400" } });
  });
  const circle = page.getByTestId("circle-hafez").first();
  await expect(circle).toContainText("ح"); // the default circle
  await page.reload();
  const image = page.getByTestId("circle-hafez").first().locator("img");
  await expect(image).toHaveAttribute("src", "/api/v1/poets/hafez/picture?v=ab12");
  await expect(image).toHaveCSS("opacity", "1");
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  expect(pictureAsked).toBeGreaterThan(0);
  // Another poet has no picture: its letter stays.
  await expect(page.getByTestId("circle-saadi").first().locator("img")).toHaveCount(0);
});

// Every screen of the slice: right to left, nothing sideways, and the last of the content clear of the tab bar.
const screens = ["/", "/explore", "/explore/library", "/explore/poets", "/explore/book/hafez", "/explore/section/hafez/ghazal", "/explore/poet/hafez", "/explore/mood/love", "/explore/search?q=ساقی"];

for (const path of screens) {
  test(`${path} is right to left, does not scroll sideways, and its end is not under the tab bar`, async ({ page }) => {
    await openApp(page, path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
    await page.waitForTimeout(400);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    const lowest = await lowestContent(page);
    const bar = (await tabBarBox(page))!;
    if (page.viewportSize()!.width < 1024) expect(lowest).toBeLessThanOrEqual(bar.y);
  });
}

const tabBarBox = (page: Page) => page.getByRole("navigation", { name: "تب‌ها" }).boundingBox();

/** The lowest edge of anything drawn in the page's content (the padding below the last element is not content). */
const lowestContent = (page: Page) =>
  page.evaluate(() => {
    let lowest = 0;
    for (const element of document.querySelectorAll("main *")) {
      const { bottom, height, width } = element.getBoundingClientRect();
      if (height > 0 && width > 0) lowest = Math.max(lowest, bottom);
    }
    return lowest;
  });

test("the web app's /api route refuses everything but the poet pictures, traversal included", async ({ request }) => {
  for (const path of ["/api/v1/me", "/api/v1/poets", "/api/v1/poets/hafez", "/api/v1/poets/..%2F..%2Fv1%2Fme/picture", "/api/v1/poets/%2e%2e/picture", "/api/v1/poets/Hafez/picture", "/api/v1/poets/pictures/x", "/api/v2/poets/pictures"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
  expect((await request.post("/api/v1/poets/pictures")).status()).toBe(405);
});

test("«برگشت» goes back inside the app, and from a screen opened by its link, or once back at it, goes to the screen above", async ({ page }) => {
  await openApp(page, "/explore/poet/saadi");
  await page.getByRole("link", { name: "گلستان" }).first().click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/explore/book/saadi"));
  await page.getByRole("button", { name: "برگشت" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/saadi");
  // The poet's page was opened by its link: there is no page of ours before it, and the app must not be left.
  await page.getByRole("button", { name: "برگشت" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/explore");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کاوش");
});

test("when the couplets do not load, a mood and the search say so and offer «دوباره»", async ({ page }) => {
  await page.route("**/data/book-24.json", (route) => route.abort());
  await openApp(page, "/explore/mood/love");
  await expect(page.getByRole("alert").filter({ hasText: "بیت‌ها باز نشد" })).toBeVisible();
  await page.goto("/explore/search?q=ساقی");
  await expect(page.getByRole("alert").filter({ hasText: "بیت‌ها باز نشد" })).toBeVisible();
  await page.unroute("**/data/book-24.json");
  await page.getByRole("button", { name: "دوباره" }).click();
  await expect(page.locator("[data-testid^=couplet-]").first()).toBeVisible();
});
