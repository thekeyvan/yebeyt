import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./browse";
import { fire, green, savedStats } from "./games";
import { openListen } from "./listen";
import { answer, answerRight, answerWrong, leaveAsks, openGame, options, rightIndex, shownScore, type QuizGame } from "./quiz";

const games: { kind: QuizGame; name: string; questions: number }[] = [
  { kind: "poet", name: "حدس شاعر", questions: 10 },
  { kind: "misra", name: "مصراع دوم", questions: 10 },
  { kind: "book", name: "از کدوم کتاب؟", questions: 10 },
];

/** What carries the colour of an answer: the border of a card or a row, the title under a book. */
const mark = (page: Page, kind: QuizGame, index: number) => (kind === "book" ? options(page).nth(index).locator("span").last() : options(page).nth(index));
const marked = (kind: QuizGame, colour: string): [string, string] => (kind === "book" ? ["color", colour === green ? "rgb(62, 154, 30)" : colour] : ["border-top-color", colour]);

for (const { kind, name, questions } of games) {
  test.describe(name, () => {
    test.beforeEach(async ({ page }) => {
      await openGame(page, `/games/${kind}`);
      await expect(options(page).first()).toBeVisible();
    });

    test("a right answer turns green, shows the sheet and scores at least 20", async ({ page }) => {
      const right = await rightIndex(page, kind);
      await answer(page, right);
      await expect(options(page).nth(right)).toHaveAttribute("data-state", "right");
      await expect(mark(page, kind, right)).toHaveCSS(...marked(kind, green));
      await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", green);
      await expect(page.getByTestId("verdict")).toContainText("آره");
      const score = await shownScore(page);
      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThanOrEqual(44);
      expect((await savedStats(page)).points).toBe(score);
    });

    test("a wrong answer turns red, shows the right one in green and scores nothing", async ({ page }) => {
      const wrong = (await rightIndex(page, kind)) === 0 ? 1 : 0;
      const right = await answerWrong(page, kind);
      await expect(options(page).nth(wrong)).toHaveAttribute("data-state", "wrong");
      await expect(mark(page, kind, wrong)).toHaveCSS(...marked(kind, fire));
      await expect(options(page).nth(right)).toHaveAttribute("data-state", "right");
      await expect(mark(page, kind, right)).toHaveCSS(...marked(kind, green));
      await expect(page.getByTestId("verdict-badge")).toHaveCSS("background-color", fire);
      await expect(page.getByTestId("verdict")).toContainText("نه");
      await expect(page.getByTestId("answer-sheet")).toContainText("این یکی رو حساب نکردیم");
      if (kind === "misra") await expect(page.getByTestId("correction")).toBeVisible();
      await expect(page.getByTestId("score")).toHaveText("+۰");
      expect((await savedStats(page)).points ?? 0).toBe(0);
    });

    test("the round ends after the last question, with the points and the best kept", async ({ page }) => {
      test.setTimeout(120_000);
      let rights = 0;
      for (let index = 0; index < questions; index++) {
        if (index % 3 === 2) await answerWrong(page, kind);
        else {
          await answerRight(page, kind);
          rights++;
        }
        await page.getByTestId("next").click();
      }
      await expect(page.getByTestId("round-end")).toBeVisible();
      await expect(page.getByTestId("round-end-score")).toHaveAccessibleName(`${rights.toLocaleString("fa-IR")} از ${questions.toLocaleString("fa-IR")}`);
      const saved = await savedStats(page);
      expect(saved.best?.[kind]).toBe(saved.points);
      expect(saved.points).toBeGreaterThanOrEqual(20 * rights);
    });

    test("leaving in the middle of a round asks first", async ({ page }) => {
      await answerRight(page, kind);
      await page.getByTestId("next").click();
      await leaveAsks(page);
    });
  });
}

test.describe("every quiz screen", () => {
  for (const kind of ["poet", "misra", "book", "match", "listen"] as const) {
    test(`/games/${kind} is right to left, does not scroll sideways, and keeps its bar on the screen`, async ({ page }) => {
      if (kind === "listen") await openListen(page, "measured");
      else await openGame(page, `/games/${kind}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator(kind === "match" ? "[data-testid=match-couplet]" : "[data-testid^=option-]").first()).toBeVisible();
      await page.waitForTimeout(600);
      const wide = () =>
        page.evaluate(() => [document.documentElement, document.querySelector("[data-testid=game] main")!].map((element) => ({ scroll: element.scrollWidth, client: element.clientWidth })));
      for (const { scroll, client } of await wide()) expect(scroll).toBeLessThanOrEqual(client);
      if (kind !== "match") {
        const bar = (await page.getByTestId("confirm").boundingBox())!;
        expect(bar.y + bar.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        await answer(page, await rightIndex(page, kind));
        await page.waitForTimeout(600);
        for (const { scroll, client } of await wide()) expect(scroll).toBeLessThanOrEqual(client);
      }
    });
  }
});

test.describe("the poet's page", () => {
  test("«بازی با بیت‌های حافظ» opens مصراع دوم with that poet's couplets only, and closing goes back to the page", async ({ page }) => {
    await openApp(page, "/explore/poet/hafez");
    const card = page.getByTestId("poet-game");
    await expect(card).toContainText("بازی با بیت‌های حافظ");
    await expect(card).toContainText("یه دورِ ۱۰ سؤالی، فقط از حافظ");
    await card.click();
    await expect(page).toHaveURL((url) => url.pathname === "/games/misra" && url.searchParams.get("poet") === "hafez");
    await expect(page.getByTestId("game")).toBeVisible();
    await expect(options(page).first()).toBeVisible();
    for (let index = 0; index < 3; index++) {
      await expect(page.getByTestId("quiz-couplet")).toContainText("حافظ"); // the tag of the card
      await page.getByTestId("skip").click();
    }
    await page.getByTestId("skip").click();
    await page.getByRole("button", { name: "بستن" }).click();
    await page.getByRole("button", { name: "برو بیرون" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/explore/poet/hafez");
  });

  test("a poet the deck has too few couplets of has no card", async ({ page }) => {
    await openApp(page, "/explore/poet/abusaeed");
    await expect(page.getByTestId("poet-name")).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("poet-game")).toHaveCount(0);
  });

  test("opened by its link, the poet's round is the poet's all the same", async ({ page }) => {
    await openGame(page, "/games/misra?poet=saadi");
    await expect(page.getByTestId("quiz-couplet")).toContainText("سعدی");
  });
});
