import { expect, test } from "@playwright/test";
import { answerCouplet, centreOf, clockSeconds, coupletOnCard, emptySlots, fillByTaps, fire, green, holdAndMove, openRound, playWithCouplet, savedStats } from "./games";
import { copied } from "./reader";

const persian = (number: number) => String(number).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]!);
const plain = (text: string) => text.replace(/[\u064b-\u065f\u0670\u0640]/g, "");

test.describe("جورچین", () => {
  test("a sticker dragged with a finger follows it and is placed where the finger lets go; one let go over nothing goes back; a tap places one too", async ({ page, browserName }) => {
    await openRound(page);
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    await page.waitForTimeout(700);
    const { words } = await coupletOnCard(page);
    const [first, second] = await emptySlots(page);
    const sticker = page.locator(`[data-testid^=sticker-][data-word="${words[second!]}"]`).first();
    const slot = page.getByTestId(`slot-${second}`);
    await sticker.scrollIntoViewIfNeeded();
    const from = await centreOf(sticker);
    const to = await centreOf(slot);

    // Mid-drag the sticker is under the finger (a finger is physical: it is the same in right-to-left), and red.
    const release = await holdAndMove(page, browserName, from, to);
    const held = await centreOf(sticker);
    expect(Math.abs(held.x - to.x)).toBeLessThan(24);
    expect(Math.abs(held.y - (to.y - 14))).toBeLessThan(24);
    await expect(sticker.locator("span")).toHaveCSS("background-color", fire);
    await release();
    await expect(slot).toHaveAttribute("data-filled", "true");
    await expect(slot).toHaveText(words[second!]!);
    await expect(page.getByTestId(`slot-${first}`)).toHaveAttribute("data-filled", "false"); // not the mirror slot
    await expect(sticker).toHaveCount(0);

    // Let go over the title: it goes back to the sheet.
    const other = page.locator(`[data-testid^=sticker-][data-word="${words[first!]}"]`).first();
    const title = await centreOf(page.getByRole("heading", { level: 1 }));
    const back = await holdAndMove(page, browserName, await centreOf(other), title);
    await back();
    await expect(page.getByTestId(`slot-${first}`)).toHaveAttribute("data-filled", "false");
    await expect(other).toBeVisible();
    await page.waitForTimeout(500);

    // A tap puts it in hand, a tap on the slot places it.
    await other.click();
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`slot-${first}`).click();
    await expect(page.getByTestId(`slot-${first}`)).toHaveText(words[first!]!);
    // A tap on a filled slot takes its sticker back.
    await page.getByTestId(`slot-${first}`).click();
    await expect(page.getByTestId(`slot-${first}`)).toHaveAttribute("data-filled", "false");
  });

  test("the keyboard works too: Enter on a sticker takes it, Enter on a slot places it", async ({ page }) => {
    await openRound(page);
    const { words } = await coupletOnCard(page);
    const [first] = await emptySlots(page);
    const sticker = page.locator(`[data-testid^=sticker-][data-word="${words[first!]}"]`).first();
    await sticker.focus();
    await page.keyboard.press("Enter");
    await expect(sticker).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`slot-${first}`).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId(`slot-${first}`)).toHaveText(words[first!]!);
  });

  test("«بچسبون!» waits for every slot; a right couplet turns green and gives 20 for each word", async ({ page }) => {
    await openRound(page);
    const check = page.getByTestId("check");
    await expect(check).toBeDisabled();
    const slots = await fillByTaps(page, "right");
    await expect(check).toBeEnabled();
    await check.click();
    await expect(page.getByTestId("answer-sheet")).toBeVisible();
    await expect(page.getByTestId("verdict")).toHaveText("درست چسبوندی!");
    await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", green);
    for (const position of slots) await expect(page.getByTestId(`slot-${position}`)).toHaveAttribute("data-mark", "right");
    for (const position of slots) await expect(page.getByTestId(`slot-${position}`).locator("span")).toHaveCSS("background-color", green);
    const points = 20 * slots.length;
    await expect(page.getByTestId("answer-sheet")).toContainText(`+${persian(points)} ·`);
    await expect(page.getByTestId("score")).toHaveText(`+${persian(points)}`);
    expect((await savedStats(page)).points).toBe(points);
    await expect(page.getByTestId("progress").locator("[data-dot=right]")).toHaveCount(1);
    await expect(page.getByTestId("answer-sheet")).toContainText("یعنی چی؟");
  });

  test("a wrong couplet turns red, the sheet shows the right answer, and it gives nothing", async ({ page }) => {
    await openRound(page);
    const { words } = await coupletOnCard(page);
    const slots = await fillByTaps(page, "wrong");
    await page.getByTestId("check").click();
    const sheet = page.getByTestId("answer-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("verdict")).toHaveText("نه، این بود");
    await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", fire);
    for (const position of slots) {
      await expect(page.getByTestId(`slot-${position}`)).toHaveAttribute("data-mark", "wrong");
      await expect(page.getByTestId(`slot-${position}`).locator("span")).toHaveCSS("background-color", fire);
      await expect(page.getByTestId(`right-word-${position}`)).toHaveText(words[position]!); // the right word under the red one
    }
    await expect(sheet.getByTestId("attempt-wrong")).toHaveCount(slots.length);
    await expect(sheet.getByTestId("correction")).toHaveText(plain(words.join(" ")));
    await expect(sheet).toContainText("+۰ ·");
    await expect(page.getByTestId("score")).toHaveText("+۰");
    expect((await savedStats(page)).points ?? 0).toBe(0);
    await expect(page.getByTestId("progress").locator("[data-dot=wrong]")).toHaveCount(1);

    // «بیت بعدی» goes on to the next couplet with a clean board.
    await page.getByTestId("next").click();
    await expect(page.getByTestId("answer-sheet")).toHaveCount(0);
    await expect(page.getByTestId("progress").locator("[data-dot=current]")).toHaveCount(1);
    expect((await emptySlots(page)).length).toBeGreaterThan(0);
  });

  test("the bulb places a right word for 20, and shuffling only reorders the sheet", async ({ page }) => {
    await openRound(page);
    const { words } = await coupletOnCard(page);
    const [first] = await emptySlots(page);
    const before = await page.locator("[data-testid^=sticker-]").evaluateAll((all) => all.map((element) => (element as HTMLElement).dataset.word).sort());
    await page.getByRole("button", { name: "بُر زدن برچسب‌ها" }).click();
    expect(await page.locator("[data-testid^=sticker-]").evaluateAll((all) => all.map((element) => (element as HTMLElement).dataset.word).sort())).toEqual(before);
    await page.getByRole("button", { name: "راهنما، ۲۰ امتیاز" }).click();
    await expect(page.getByTestId(`slot-${first}`)).toHaveText(words[first!]!);
    await expect(page.getByTestId("check")).toBeDisabled();
  });
});

test.describe("starting from the reader", () => {
  const stickers = "/dev/stickers";

  test("«بازی با این بیت» starts a round with that couplet first, and «بازی با این غزل» one with the poem's couplets first", async ({ page }) => {
    await openRound(page, stickers);
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "بازی با این بیت" }).click();
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    expect(await coupletOnCard(page)).toMatchObject({ poem: "/hafez/ghazal/sh3", index: 1 });
    await expect(page.getByTestId("progress").locator("[data-dot=current]")).toHaveCount(1);
    await expect(page.getByTestId("answer-sheet")).toHaveCount(0);

    // The round has started, so leaving asks; back on the page, the poem's header button starts one with its couplets.
    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL(new RegExp(`${stickers}$`));
    await page.getByRole("link", { name: "باز کردن غزل ۳ حافظ" }).click();
    await page.getByRole("button", { name: "بازی با این غزل" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw" && url.searchParams.get("poem") === "/hafez/ghazal/sh3" && !url.searchParams.has("c"));
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    expect(await coupletOnCard(page)).toMatchObject({ poem: "/hafez/ghazal/sh3", index: 0 });
  });

  test("over a round that has started it asks «از بازی بری بیرون؟» first: «بمون» keeps the reader and the round under it, «برو بیرون» starts the new game, and closing that goes to the page the old one came from", async ({ page }) => {
    await openRound(page, "/games");
    await page.getByTestId("game-jigsaw").click();
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    const { poem, index } = await coupletOnCard(page);
    await answerCouplet(page, "right");
    await page.getByTestId("sheet-poem").click();
    await expect(page.getByTestId("reader")).toBeVisible();
    await playWithCouplet(page, index);
    const question = page.getByRole("dialog", { name: "از بازی بری بیرون؟" });
    await expect(question).toBeVisible();

    await question.getByRole("button", { name: "بمون" }).click();
    await expect(question).toHaveCount(0);
    await expect(page.getByTestId("reader")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/poem${poem}`));

    await playWithCouplet(page, index);
    await question.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw" && url.searchParams.get("poem") === poem && url.searchParams.get("c") === String(index));
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page.getByTestId("answer-sheet")).toHaveCount(0); // not the old round's sheet
    await expect(page.getByTestId("progress").locator("[data-dot=right]")).toHaveCount(0);
    expect(await coupletOnCard(page)).toMatchObject({ poem, index });

    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("dialog", { name: "از بازی بری بیرون؟" }).getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page.locator("[inert]")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "بازی" })).toBeVisible();
  });

  test("a game opened by its link takes the reader over it, and the round is still there when the reader closes", async ({ page }) => {
    await openRound(page);
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    const { poem, index } = await coupletOnCard(page);
    await answerCouplet(page, "right");
    await page.getByTestId("sheet-poem").click();
    await expect(page).toHaveURL(new RegExp(`/poem${poem}\\?c=${index}`));
    await expect(page.getByTestId("reader")).toBeVisible();
    await page.getByTestId("reader").getByRole("button", { name: "بستن" }).click();
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw");
    await expect(page.getByTestId("answer-sheet")).toBeVisible();
    await expect(page.getByTestId("progress").locator("[data-dot=right]")).toHaveCount(1);

    // «بازی با این بیت» over it asks too, and the new round takes its place: closing it goes to the games tab.
    await page.getByTestId("sheet-poem").click();
    await playWithCouplet(page, index);
    await page.getByRole("dialog", { name: "از بازی بری بیرون؟" }).getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw" && url.searchParams.get("poem") === poem);
    await expect(page.getByTestId("progress").locator("[data-dot=right]")).toHaveCount(0);
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    await expect(page.getByTestId("game")).toHaveCount(1);
    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("dialog", { name: "از بازی بری بیرون؟" }).getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("game")).toHaveCount(0);
  });
});

test.describe("the answer sheet", () => {
  test("«نگه دار» keeps the couplet in the divan and takes it out again with a toast, «بفرست» copies it where there is no share sheet, and the toast is seen over the game", async ({ page }) => {
    await openRound(page);
    const { poem, index } = await coupletOnCard(page);
    await answerCouplet(page, "right");
    const keep = page.getByRole("button", { name: "نگه دار" });
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "true");
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem("reader.divan") ?? "[]") as { key: string }[])).map((item) => item.key)).toEqual([`${poem}#${index}`]);
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "false");
    const toast = page.getByText("از دیوانت برداشته شد");
    await expect(toast).toBeVisible();
    const at = await centreOf(toast);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-slot=toast]") !== null, at)).toBe(true);

    await page.getByRole("button", { name: "بفرست" }).click();
    await expect.poll(() => copied(page)).toContain("yebeyt.com");
    expect(await copied(page)).toContain("حافظ");
  });
});

test.describe("the answer sheet's drag", () => {
  test("follows the finger down: a short pull springs back, a long one does what «بیت بعدی» does, and a tap on the dimmed page does nothing", async ({ page, browserName }) => {
    test.skip(page.viewportSize()!.width >= 768, "from 768 px the sheet is a dialog in the middle");
    await openRound(page);
    await answerCouplet(page, "right");
    await page.waitForTimeout(700);
    const sheet = page.getByRole("dialog");
    const top = (await sheet.boundingBox())!;
    const grab = { x: top.x + top.width / 2, y: top.y + 30 };

    const released = await holdAndMove(page, browserName, grab, { x: grab.x, y: grab.y + 50 });
    expect((await sheet.boundingBox())!.y).toBeGreaterThan(top.y + 30); // it follows
    await page.waitForTimeout(400); // a pull that has stopped is no flick
    await released();
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(Math.round(top.y));
    await expect(page.getByTestId("answer-sheet")).toBeVisible();

    await page.mouse.click(200, 5); // the dimmed page
    await expect(page.getByTestId("answer-sheet")).toBeVisible();

    const away = await holdAndMove(page, browserName, grab, { x: grab.x, y: grab.y + top.height * 0.5 });
    await away();
    await expect(page.getByTestId("answer-sheet")).toHaveCount(0);
    await expect(page.getByTestId("progress").locator("[data-dot=current]")).toHaveCount(1);
  });
});

test.describe("the end of a round", () => {
  test("ten couplets end it with the score counting up, confetti, and the couplets that open the reader", async ({ page }) => {
    test.setTimeout(150_000);
    await openRound(page);
    await page.evaluate(() => {
      (window as unknown as { __burst: boolean }).__burst = false;
      new MutationObserver(() => {
        if (document.querySelector("[data-testid=round-end] [data-testid=burst]")) (window as unknown as { __burst: boolean }).__burst = true;
      }).observe(document.body, { subtree: true, childList: true });
    });
    for (let index = 0; index < 10; index++) {
      await answerCouplet(page, index < 7 ? "right" : "wrong");
      await page.getByTestId("next").click();
    }
    const end = page.getByTestId("round-end");
    await expect(end).toBeVisible();
    await expect(page.getByTestId("round-end-title")).toHaveText("تموم شد!");
    await expect(end).toContainText("جورچین بیت · ۱۰ بیت");
    await expect(page.getByTestId("round-end-score")).toHaveAccessibleName("۷ از ۱۰");
    await expect(page.getByTestId("round-end-score")).toContainText("۷");

    // The points count up to what the browser kept: the couplets' and the seconds left.
    const saved = (await savedStats(page)).points!;
    expect(saved).toBeGreaterThan(0);
    await expect(page.getByTestId("round-end-points")).toHaveText(`+${persian(saved)} امتیاز`);
    expect((await savedStats(page)).best?.jigsaw).toBe(saved);
    // 7 of 10 is at least half: the confetti flew.
    expect(await page.evaluate(() => (window as unknown as { __burst: boolean }).__burst)).toBe(true);

    await expect(page.getByTestId("round-couplet")).toHaveCount(10);
    await expect(end.getByRole("img", { name: "درست" })).toHaveCount(7);
    await expect(end.getByRole("img", { name: "نشد" })).toHaveCount(3);

    // Nothing is asked when a round is over: the way back goes to the tab, which shows the points.
    await page.getByRole("button", { name: "برگشت" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    await expect(page.getByTestId("points")).toHaveAccessibleName(`امتیاز ${persian(saved)} و رده‌بندی`);
  });
});

test.describe("leaving", () => {
  test("a started round asks first: «بمون» keeps the game and the clock waits for the answer, «برو بیرون» leaves and the points earned stay", async ({ page }) => {
    await openRound(page, "/games");
    await page.getByTestId("game-jigsaw").click();
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    await answerCouplet(page, "right");
    const earned = (await savedStats(page)).points!;
    await page.getByTestId("next").click();

    await page.getByRole("button", { name: "بستن" }).click();
    const question = page.getByRole("dialog", { name: "از بازی بری بیرون؟" });
    await expect(question).toBeVisible();
    await expect(question).toContainText("نتیجه‌ی این دور ثبت نمی‌شه.");
    const waiting = await clockSeconds(page);
    await page.waitForTimeout(2300);
    expect(await clockSeconds(page)).toBe(waiting);

    await question.getByRole("button", { name: "بمون" }).click();
    await expect(question).toHaveCount(0);
    await expect(page.getByTestId("game")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/games/jigsaw");
    await expect.poll(() => clockSeconds(page)).toBeLessThan(waiting);

    // Escape asks too, and «برو بیرون» goes.
    await page.keyboard.press("Escape");
    await expect(question).toBeVisible();
    await question.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === "/games");
    const saved = await savedStats(page);
    expect(saved.points).toBe(earned);
    expect(saved.best?.jigsaw).toBeUndefined(); // the round is not recorded
  });
});

test.describe("«کل شعر»", () => {
  test("opens the reader at the couplet over the game, and closing it goes back to the same round", async ({ page }) => {
    await openRound(page, "/games");
    await page.getByTestId("game-jigsaw").click();
    await expect(page.getByTestId("jigsaw-card")).toBeVisible();
    const { poem, index } = await coupletOnCard(page);
    await answerCouplet(page, "right");
    await page.getByTestId("sheet-poem").click();
    await expect(page).toHaveURL(new RegExp(`/poem${poem}\\?c=${index}`));
    await expect(page.getByTestId("reader")).toBeVisible();
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۱۴۱");
    await page.getByTestId("reader").getByRole("button", { name: "بستن" }).click();
    await expect(page.getByTestId("reader")).toHaveCount(0);
    await expect(page).toHaveURL(/\/games\/jigsaw/);
    await expect(page.getByTestId("answer-sheet")).toBeVisible();
    await expect(page.getByTestId("progress").locator("[data-dot=right]")).toHaveCount(1);
  });
});
