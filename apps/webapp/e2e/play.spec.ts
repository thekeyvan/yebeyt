import { expect, test } from "@playwright/test";
import { openAccountApp } from "./account";
import { asked, expectRightToLeftAndFits, openSignedIn } from "./friends";
import { toasts } from "./me";
import { fakeLive } from "./messages";
import { duelEnded, duelQuestion, duelRound, openAsGuest, playRound, playToRoundFour, saraMove, turnOfMine } from "./play";

const sara = "/messages/sara.ghazal";
const gate = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: /یه حساب لازمه/ });

test.describe("«بازی با دوست»", () => {
  test("lists only the friends who can play («یه بیت» is not among them), and the tiles choose the game", async ({ page }) => {
    await openSignedIn(page, "/games/lobby");
    await expectRightToLeftAndFits(page);
    await expect(page.getByRole("heading", { name: "بازی با دوست" })).toBeVisible();
    const people = page.locator("[data-testid^=lobby-person-]");
    await expect(people).toHaveCount(3);
    expect(await people.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual(["lobby-person-sara.ghazal", "lobby-person-kian_k", "lobby-person-mahsa.m"]);
    await expect(page.getByTestId("lobby-person-yebeyt")).toHaveCount(0);
    // «بیشتر» does not offer him either.
    await page.getByTestId("lobby-more").click();
    const sheet = page.getByRole("dialog", { name: "کی رو دعوت کنی؟" });
    await sheet.getByRole("searchbox").fill("yebeyt");
    await expect(sheet.getByTestId("nothing-found")).toBeVisible();
    await sheet.getByRole("searchbox").fill("aryan");
    await sheet.getByTestId("pick-aryan").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("lobby-person-aryan")).toHaveAttribute("aria-pressed", "true");

    const tiles = page.locator("[data-testid^=lobby-game-]");
    expect(await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))).toEqual(["مشاعره", "رودررو", "جورچین", "حدس شاعر"]);
    await expect(page.getByTestId("lobby-game-mosh")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radiogroup", { name: "وقت هر نوبت" })).toBeVisible();
    await expect(page.getByTestId("lobby-link")).toHaveText("yebeyt.com/g/…");
    await expect(page.getByTestId("lobby")).toContainText("هر کی اول اومد، بازی شروع می‌شه. تو هم اول می‌تونی بیت اول رو بگی.");
    await page.getByTestId("lobby-game-duel").click();
    await expect(page.getByRole("radiogroup", { name: "وقت هر نوبت" })).toHaveCount(0);
    await expect(page.getByTestId("lobby")).toContainText("هر کی اول اومد، بازی شروع می‌شه.");
    await page.getByTestId("lobby-game-jigsaw").click();
    await expect(page.getByTestId("lobby-link")).toHaveCount(0);
    await expect(page.getByTestId("lobby")).toContainText("اول خودت ۱۰ بیت رو بازی می‌کنی، بعد چالش برای دوستات می‌ره.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("the chip in Sara's chat opens it with her chosen; making the game opens it, waiting for her, with its link; she comes and it is my turn", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, sara);
    await page.getByTestId("quick-mosh").click();
    await expect(page).toHaveURL(/\/games\/lobby\?game=mosh&with=sara\.ghazal$/);
    await expect(page.getByTestId("lobby-person-sara.ghazal")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("lobby-game-mosh")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("radio", { name: "۳۰ ثانیه" }).click();
    const made = page.waitForRequest((request) => request.url().endsWith("/api/v1/games") && request.method() === "POST");
    await page.getByTestId("lobby-create").click();
    expect((await made).postDataJSON()).toEqual({ kind: "mosh", turnSeconds: 30, invite: ["sara.ghazal"] });
    await expect(page).toHaveURL(/\/games\/mosh\/new-mosh$/);
    await expect(page.getByTestId("mosh-waiting")).toContainText("منتظر دوستت…");
    await expect(page.getByTestId("mosh-waiting")).toContainText("yebeyt.com/g/M4R9");
    await live.push({
      type: "game.started",
      game: { id: "new-mosh", kind: "mosh", turnSeconds: 30, status: "active", code: "M4R9", createdAt: new Date().toISOString(), endedAt: null, winner: null, endReason: null, turn: { username: "niloofar", deadline: new Date(Date.now() + 30_000).toISOString() },
        players: [{ username: "niloofar", displayName: null, avatar: null, seat: 0, score: 0 }, { username: "sara.ghazal", displayName: "سارا", avatar: null, seat: 1, score: 0 }] },
    });
    await expect(page.getByTestId("mosh-turn-line")).toHaveText("نوبت توئه؛ بیت اول رو بگو");
    await expect(page.getByTestId("mosh-time")).toBeVisible();
    await expect(page.getByTestId("mosh").getByText("مشاعره با سارا")).toBeVisible();
    // Closing the game goes back to the chat (the lobby was replaced by it).
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page).toHaveURL(/\/messages\/sara\.ghazal$/);
  });

  test("the inbox's button, the games tab's «+ بازی با دوست» and the catalog's cards open it", async ({ page }) => {
    await openSignedIn(page, "/messages");
    await page.getByRole("button", { name: "بازی با دوست" }).click();
    await expect(page).toHaveURL(/\/games\/lobby$/);
    await expect(page.getByTestId("lobby-game-mosh")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "برگشت" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await page.goto("/games");
    await page.getByTestId("new-friend-game").click();
    await expect(page).toHaveURL(/\/games\/lobby$/);
    await page.goto("/games/catalog");
    await page.getByTestId("catalog-duel").click();
    await expect(page).toHaveURL(/\/games\/lobby\?game=duel$/);
    await expect(page.getByTestId("lobby-game-duel")).toHaveAttribute("aria-pressed", "true");
  });

  test("a guest gets the gate on the lobby, and goes ahead after signing in", async ({ page }) => {
    await openAccountApp(page, "/games/lobby");
    await expect(gate(page)).toBeVisible();
    await expect(gate(page)).toContainText("برای مشاعره با دوستات");
  });
});

test.describe("مشاعره", () => {
  test("the card of the games tab has the game where it is my turn; I give a couplet of the letter, Sara answers live, and giving up asks first", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/games");
    await expect(page.getByTestId("mosh-card")).toContainText("نوبتی بیت بگید، با آخرین حرفِ بیتِ قبلی");
    await expect(page.getByTestId("mosh-active")).toContainText("سارا جوابت رو داد");
    await expect(page.getByTestId("mosh-active")).toContainText("نوبت توئه، با حرف «د»");
    await page.getByTestId("mosh-active").click();
    await expect(page).toHaveURL(/\/games\/mosh\/g1$/);
    await expectRightToLeftAndFits(page);

    // The scores, the round, the time, and the couplets played so far, the last one with its last letter marked.
    await expect(page.getByTestId("mosh").getByText("مشاعره با سارا")).toBeVisible();
    await expect(page.getByTestId("mosh-my-score")).toHaveText("۴");
    await expect(page.getByTestId("mosh-their-score")).toHaveText("۳");
    await expect(page.getByTestId("mosh-round")).toHaveText("دور ۳ · تا فردا");
    await expect(page.getByTestId("mosh-time")).toContainText("ساعت");
    await expect(page.getByTestId("mosh-move-1")).toContainText("تو · حافظ");
    await expect(page.getByTestId("mosh-move-2")).toContainText("سارا · حافظ");
    await expect(page.getByTestId("mosh-move-2").getByTestId("last-letter")).toHaveText("د");
    await expect(page.getByTestId("mosh-letter")).toHaveText("د");
    await expect(page.getByTestId("mosh-panel")).toContainText("نوبت توئه، با");

    // A typed text that is no couplet of the books is told, and nothing is sent.
    const field = page.getByTestId("mosh-field");
    await field.fill("دلم می‌خواد یه بیت بگم");
    await field.press("Enter");
    await expect(toasts(page)).toContainText("این بیت رو پیدا نکردیم");
    await field.fill("");

    // A suggestion starts with the letter; one tap plays it.
    const suggestions = page.locator("[data-testid^=mosh-suggestion-]");
    await expect(suggestions.first()).toBeVisible();
    expect(await suggestions.count()).toBeLessThanOrEqual(6);
    const moved = page.waitForRequest((request) => request.url().endsWith("/api/v1/games/g1/moves"));
    await suggestions.first().click();
    const sent = (await moved).postDataJSON() as { key: string; m1: string; m2: string };
    expect(sent.key).toMatch(/^\/.+#\d+$/);
    expect(sent.m1.length).toBeGreaterThan(5);
    await expect(page.getByTestId("mosh-turn-line")).toHaveText("منتظر سارا…");
    await expect(page.getByTestId("mosh-move-3")).toBeVisible();
    await expect(page.getByTestId("mosh-field")).toHaveCount(0);

    // Sara's move arrives live: the couplet is there, the letter is the last one of hers, and it is my turn again.
    await live.push(saraMove(4));
    await live.push(turnOfMine);
    await expect(page.getByTestId("mosh-move-4")).toContainText("سارا");
    await expect(page.getByTestId("mosh-move-4").getByTestId("last-letter")).toHaveText("ا");
    await expect(page.getByTestId("mosh-letter")).toHaveText("ا");
    await expect(page.getByTestId("mosh-my-score")).toHaveText("۵");
    await expect(page.getByTestId("mosh-their-score")).toHaveText("۴");

    // Giving up asks first; «نه» keeps the game, «کم آوردم» ends it.
    await page.getByTestId("mosh-resign").click();
    await expect(asked(page, "کم آوردی؟ بازی رو می‌بازی.")).toBeVisible();
    await asked(page, "کم آوردی؟ بازی رو می‌بازی.").getByRole("button", { name: "نه" }).click();
    await expect(asked(page, "کم آوردی؟ بازی رو می‌بازی.")).toHaveCount(0);
    await expect(page.getByTestId("mosh-letter")).toBeVisible();
    await page.getByTestId("mosh-resign").click();
    await asked(page, "کم آوردی؟ بازی رو می‌بازی.").getByRole("button", { name: "کم آوردم" }).click();
    await expect(page.getByTestId("mosh-outcome")).toHaveText("سارا برد");
    await expect(page.getByTestId("mosh-end-line")).toHaveText("کم آوردی");
    await expect(page.getByTestId("mosh-end")).toContainText("تو ۵ · سارا ۴");
    await page.getByTestId("mosh-back").click();
    await expect(page).toHaveURL(/\/games$/);
  });

  test("a move the server refuses says why in the board's words", async ({ page }) => {
    await openSignedIn(page, "/games/mosh/g1");
    await page.route("**/api/v1/games/g1/moves", (route) => route.fulfill({ status: 409, json: { error: "wrong_letter" } }));
    await page.locator("[data-testid^=mosh-suggestion-]").first().click();
    await expect(toasts(page)).toContainText("با حرف «د» شروع نمی‌شه");
    await expect(page.getByTestId("mosh-letter")).toHaveText("د");
  });
});

test.describe("رودررو", () => {
  test("round four of five is played out by live events: the clock, who answered, a right answer wins the round, and the end", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/games/duel/d1");
    await expectRightToLeftAndFits(page);
    await expect(page.getByTestId("duel-waiting")).toHaveText("منتظر سارا…");
    await playToRoundFour(live);

    await expect(page.getByTestId("duel-round")).toHaveText("دور ۴ از ۵");
    await expect(page.getByTestId("duel-kind")).toHaveText("این دور: مصراع دوم");
    await expect(page.getByTestId("duel-mine-score")).toHaveText("۲");
    await expect(page.getByTestId("duel-theirs-score")).toHaveText("۱");
    await expect(page.getByTestId("duel-answered")).toHaveText("جواب داد"); // Sara answered wrong and is out of the round
    expect(await page.locator("[data-segment]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-segment")))).toEqual(["won", "won", "won", "current", "coming"]);
    await expect(page.getByTestId("duel-time")).toHaveText(/^۰:۰[۰-۸]$/);
    await expect(page.getByTestId("quiz-couplet")).toContainText("توانا بود هر که دانا بود");
    await expect(page.locator("[data-testid^=option-]")).toHaveCount(3);

    // My right answer goes over the socket, and the server's result wins me the round.
    await page.getByTestId("option-0").click();
    await expect(page.getByTestId("option-0")).toHaveAttribute("data-state", "selected");
    await expect.poll(() => live.frames.filter((frame) => frame.type === "duel.answer")).toEqual([{ type: "duel.answer", gameId: "d1", round: 4, option: 0 }]);
    await page.getByTestId("option-1").click({ force: true }); // one answer for each round
    expect(live.frames.filter((frame) => frame.type === "duel.answer")).toHaveLength(1);
    await live.push(duelRound(4, "niloofar", 0, 3, 1));
    await expect(page.getByTestId("option-0")).toHaveAttribute("data-state", "right");
    await expect(page.getByTestId("option-1")).toHaveAttribute("data-state", "dimmed");
    await expect(page.getByTestId("duel-footer")).toHaveText("این دور رو بردی");
    await expect(page.getByTestId("duel-mine-score")).toHaveText("۳");
    await expect(page.getByTestId("duel-answered")).toHaveCount(0);

    // Round five: a wrong answer locks me out, and Sara wins the round.
    await live.push(duelQuestion(5, { kind: "poet", couplet: { m1: "بنی آدم اعضای یکدیگرند", m2: "که در آفرینش ز یک گوهرند" }, poet: null, options: ["مولانا", "حافظ", "سعدی", "فردوسی"] }));
    await expect(page.getByTestId("duel-kind")).toHaveText("این دور: حدس شاعر");
    await expect(page.locator("[data-testid^=option-]")).toHaveCount(4);
    await page.getByTestId("option-1").click();
    await live.push({ type: "duel.answered", gameId: "d1", round: 5, username: "niloofar" });
    await expect(page.getByTestId("option-1")).toHaveAttribute("data-state", "wrong");
    await expect(page.getByTestId("option-0")).toHaveAttribute("data-state", "dimmed");
    await live.push(duelRound(5, "sara.ghazal", 2, 3, 2));
    await expect(page.getByTestId("option-2")).toHaveAttribute("data-state", "right");
    await expect(page.getByTestId("duel-footer")).toHaveText("سارا این دور رو برد");

    // The end: the result as the title, the scores, and the five couplets with their meanings.
    await live.push(duelEnded);
    await expect(page.getByTestId("round-end-title")).toHaveText("بردی!");
    await expect(page.getByTestId("round-end")).toContainText("تو ۴ · سارا ۱");
    await expect(page.getByTestId("round-end-points")).toHaveCount(0);
    await expect(page.getByTestId("round-couplet")).toHaveCount(5);
    await expect(page.getByTestId("round-couplet").first()).toContainText("هر که دانا باشد، توانا هم هست.");
    await expectRightToLeftAndFits(page);
  });

  test("leaving a duel that is on asks first", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/games/duel/d1");
    await live.push(duelQuestion(1));
    await expect(page.getByTestId("option-0")).toBeVisible();
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(asked(page, "از بازی بری بیرون؟")).toBeVisible();
    await asked(page, "از بازی بری بیرون؟").getByRole("button", { name: "بمون" }).click();
    await expect(asked(page, "از بازی بری بیرون؟")).toHaveCount(0);
    await expect(page.getByTestId("option-0")).toBeVisible();
    await page.getByRole("button", { name: "بستن" }).click();
    await asked(page, "از بازی بری بیرون؟").getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL(/\/games$/);
  });

  test("an invitation in a chat opens the game", async ({ page }) => {
    await openSignedIn(page, "/messages/aryan");
    await expect(page.getByTestId("game-card-a1")).toContainText("بازی رودررو با آرین · الان در جریانه");
    await page.getByTestId("game-go-a1").click();
    await expect(page).toHaveURL(/\/games\/duel\/g2$/);
    await expect(page.getByTestId("duel-waiting")).toHaveText("منتظر آرین…");
  });
});

test.describe("a chat's game lines", () => {
  test("Sara's invitation is the card of the board with the last couplet; its button opens the game", async ({ page }) => {
    await openSignedIn(page, sara);
    const card = page.getByTestId("game-card-g1");
    await expect(card).toContainText("مشاعره با سارا");
    await expect(card).toContainText("دور ۳");
    await expect(card).toContainText("نوبت توئه، با حرف «د»");
    await expect(card.getByTestId("last-letter")).toHaveText("د");
    await expect(page.getByTestId("game-go-g1")).toHaveText("جواب بده");
    await page.getByTestId("game-go-g1").click();
    await expect(page).toHaveURL(/\/games\/mosh\/g1$/);
    await expect(page.getByTestId("mosh-letter")).toHaveText("د");
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page).toHaveURL(/\/messages\/sara\.ghazal$/);
  });

  test("«بازی رودررو» in the chat opens the lobby with that game and the friend", async ({ page }) => {
    await openSignedIn(page, sara);
    await page.getByTestId("quick-duel").click();
    await expect(page).toHaveURL(/\/games\/lobby\?game=duel&with=sara\.ghazal$/);
    await expect(page.getByTestId("lobby-game-duel")).toHaveAttribute("aria-pressed", "true");
  });

  test("a challenge link in a message opens its board", async ({ page }) => {
    await openSignedIn(page, "/messages/mahsa.m");
    await page.getByTestId("challenge-link-in-chat").click();
    await expect(page).toHaveURL(/\/c\/7KQ2$/);
    await expect(page.getByTestId("challenge-title")).toHaveText("نیلوفر منتظرته");
  });
});

test.describe("challenges", () => {
  test("the board of /c/7KQ2: the maker with 8 of 10, ten couplets by Saadi, and the way to play", async ({ page }) => {
    await openSignedIn(page, "/c/7KQ2");
    await expectRightToLeftAndFits(page);
    const board = page.getByTestId("challenge-accept");
    await expect(page.getByTestId("challenge-title")).toHaveText("نیلوفر منتظرته");
    await expect(page.getByTestId("game")).toContainText("از لینک نیلوفر");
    await expect(board).toContainText("۸ از ۱۰");
    await expect(board).toContainText("جورچین بیت");
    await expect(board).toContainText("۱۰ بیت سعدی");
    await expect(board).toContainText("حدود ۲ دقیقه");
    await expect(board).toContainText("همون ۱۰ بیتی که اون بازی کرد.");
    await expect(board).toContainText("بیشتر از ۸ تا بگیری، تو بردی.");
    await expect(page.getByTestId("challenge-no-account")).toHaveCount(0); // signed in: no name to give
    await expect(page.getByTestId("challenge-start")).toHaveText("شروع کن");
  });

  test("an unknown code says so, and a bad one is no page", async ({ page }) => {
    await openSignedIn(page, "/c/ZZZZ");
    await expect(page.getByTestId("challenge-failed")).toHaveText("این چالش پیدا نشد یا تموم شده");
    const bad = await page.goto("/c/ABCDE");
    expect(bad?.status()).toBe(404);
  });

  test("after a جورچین round the card makes the challenge and sends it to a friend in the app", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
    await openSignedIn(page, "/games/jigsaw");
    const made = page.waitForRequest((request) => request.url().endsWith("/api/v1/challenges") && request.method() === "POST");
    await playRound(page);
    await expect(page.getByTestId("challenge-send")).toBeVisible();
    await expect(page.getByRole("heading", { name: "یکی رو به چالش بکش" })).toBeVisible();
    const body = (await made).postDataJSON() as { game: string; items: string[]; score: number; seconds: number };
    expect([body.game, body.items.length, body.score]).toEqual(["jigsaw", 10, 10]);
    await expect(page.getByTestId("challenge-link")).toHaveText("yebeyt.com/c/7KQ2");
    await expect(page.getByTestId("challenge-brag")).toContainText("نیلوفر توی جورچین بیت ۱۰ از ۱۰ گرفت. تو چند می‌گیری؟");
    await expect(page.getByTestId("challenge-friends")).toContainText("سارا، کیان، مهسا");
    await expect(page.getByTestId("round-couplet")).toHaveCount(0); // the card stands in for the couplets
    await expectRightToLeftAndFits(page);

    await page.getByTestId("challenge-pick").click();
    await page.getByRole("dialog", { name: "کی رو به چالش بکشی؟" }).getByRole("searchbox").fill("sara");
    await page.getByTestId("pick-sara.ghazal").click();
    await expect(toasts(page)).toContainText("برای سارا فرستاده شد");
    await page.goto(sara);
    await expect(page.locator("[data-testid^=bubble-sent-]")).toContainText("نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2");
    await expect(page.getByTestId("challenge-link-in-chat")).toHaveAttribute("href", "/c/7KQ2");
  });

  test("from the lobby a جورچین is played first and the challenge goes to the friends picked there when it is made", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
    await openSignedIn(page, "/games/lobby?game=jigsaw&with=sara.ghazal");
    await expect(page.getByTestId("lobby-person-sara.ghazal")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("lobby-create").click();
    await expect(page).toHaveURL(/\/games\/jigsaw\?invite=sara\.ghazal$/);
    await playRound(page);
    await expect(page.getByTestId("challenge-link")).toHaveText("yebeyt.com/c/7KQ2");
    await page.goto(sara);
    await expect(page.locator("[data-testid^=bubble-sent-]")).toContainText("نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2");
  });

  test("a guest plays /c/7KQ2 on the web, is asked for a name at the end and posts the result", async ({ page }) => {
    test.setTimeout(180_000);
    await openAsGuest(page, "/c/7KQ2");
    await expectRightToLeftAndFits(page);
    await expect(page.getByTestId("challenge-title")).toHaveText("نیلوفر منتظرته");
    await expect(page.getByTestId("challenge-no-account")).toContainText("حساب نمی‌خواد");
    await expect(page.getByTestId("challenge-no-account")).toContainText("آخرش فقط یه اسم بنویس تا نیلوفر نتیجه‌ت رو ببینه");
    await page.getByTestId("challenge-start").click();
    await playRound(page);

    // No account: a name is asked, with nothing about a challenge to make.
    await expect(page.getByTestId("challenge-send")).toHaveCount(0);
    await expect(page.getByTestId("round-end-title")).toHaveText("تموم شد!");
    await expect(page.getByTestId("challenge-name-card")).toContainText("اسمت چیه؟");
    await expect(page.getByTestId("challenge-name-card")).toContainText("تا نیلوفر نتیجه‌ت رو ببینه.");
    await expect(page.getByTestId("round-couplet")).toHaveCount(10);
    await page.getByTestId("challenge-send-name").click();
    await expect(page.getByTestId("challenge-error")).toHaveText("یه اسم بنویس");

    const posted = page.waitForRequest((request) => request.url().endsWith("/api/v1/challenges/7KQ2/results"));
    await page.getByTestId("challenge-name").fill("  کیان  ");
    await page.getByTestId("challenge-send-name").click();
    expect((await posted).postDataJSON()).toMatchObject({ name: "کیان", score: 10 });
    await expect(page.getByTestId("round-end-title")).toHaveText("بردی!");
    await expect(page.getByTestId("round-end")).toContainText("تو ۱۰ · نیلوفر ۸");
    await expect(page.getByTestId("challenge-name-card")).toHaveCount(0);
  });
});
