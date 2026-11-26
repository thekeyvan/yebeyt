import { expect, test, type Page } from "@playwright/test";
import { fire, green, savedStats } from "./games";
import { openGame, persian } from "./quiz";
import { leaveAsks } from "./quiz";

const word = (page: Page, id: number) => page.getByTestId(`word-${id}`);
const meaning = (page: Page, id: number) => page.getByTestId(`meaning-${id}`);

/** How many words the couplet in play has. */
const wordCount = (page: Page) => page.locator("[data-testid^=word-]").count();

/** Matches the words of the couplet in play, each by its own meaning (the ids tell which is which). */
async function solve(page: Page, only = Infinity) {
  const count = Math.min(await wordCount(page), only);
  for (let id = 0; id < count; id++) {
    await word(page, id).click();
    await meaning(page, id).click();
  }
  return count;
}

test.describe("معنی‌یاب", () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page, "/games/match");
    await expect(page.getByTestId("match-couplet")).toBeVisible();
  });

  test("a word then its meaning is a pair: both turn green, a curve joins them and it scores 10", async ({ page }) => {
    await word(page, 0).click();
    await expect(word(page, 0)).toHaveAttribute("aria-pressed", "true");
    await meaning(page, 0).click();
    for (const card of [word(page, 0), meaning(page, 0)]) {
      await expect(card).toHaveAttribute("data-state", "matched");
      await expect(card).toHaveCSS("border-top-color", green);
      await expect(card).toBeDisabled();
    }
    await expect(page.getByTestId("curve-0")).toHaveCount(1);
    await expect(page.getByTestId("score")).toHaveText("+۱۰");
    expect((await savedStats(page)).points).toBe(10);
  });

  test("a wrong meaning turns red for a moment, scores nothing and keeps the word in hand", async ({ page }) => {
    await word(page, 0).click();
    await meaning(page, 1).click();
    await expect(meaning(page, 1)).toHaveAttribute("data-state", "wrong");
    await expect(meaning(page, 1)).toHaveCSS("border-top-color", fire);
    await expect(page.getByTestId("score")).toHaveText("+۰");
    await expect(word(page, 0)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-state=matched]")).toHaveCount(0);
    await expect(meaning(page, 1)).toHaveAttribute("data-state", "idle"); // red only for a moment
    await meaning(page, 0).click();
    await expect(meaning(page, 0)).toHaveAttribute("data-state", "matched");
    expect((await savedStats(page)).points ?? 0).toBe(10);
  });

  test("a word can be put down by tapping it again, and the keyboard works: Enter takes a word, Enter on its meaning joins them", async ({ page }) => {
    await word(page, 1).click();
    await word(page, 1).click();
    await expect(word(page, 1)).toHaveAttribute("aria-pressed", "false");
    await word(page, 1).focus();
    await page.keyboard.press("Enter");
    await expect(word(page, 1)).toHaveAttribute("aria-pressed", "true");
    await meaning(page, 1).focus();
    await page.keyboard.press("Enter");
    await expect(meaning(page, 1)).toHaveAttribute("data-state", "matched");
  });

  test("the sheet opens after the last pair of a couplet, and the round ends after five couplets", async ({ page }) => {
    test.setTimeout(90_000);
    let pairs = 0;
    for (let couplet = 0; couplet < 5; couplet++) {
      const solved = await solve(page);
      pairs += solved;
      await expect(page.getByTestId("answer-sheet")).toBeVisible();
      await expect(page.getByTestId("verdict")).toHaveText("آره، همینه!");
      await expect(page.getByTestId("answer-sheet")).toContainText(`+${persian(solved * 10)}`);
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("round-end")).toBeVisible();
    await expect(page.getByTestId("round-end-points")).toHaveAccessibleName(`+${persian(pairs * 10)} امتیاز`);
    const saved = await savedStats(page);
    expect(saved.points).toBe(pairs * 10);
    expect(saved.best?.match).toBe(pairs * 10);
  });

  test("leaving in the middle of a round asks first", async ({ page }) => {
    await expect(page.getByRole("button", { name: "بستن" })).toBeVisible();
    // Nothing is lost before the first pair.
    await page.getByRole("button", { name: "بستن" }).click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await page.goto("/games/match");
    await expect(page.getByTestId("match-couplet")).toBeVisible();
    await solve(page, 1);
    await leaveAsks(page);
  });
});

test.describe("معنی‌یاب with the keyboard", () => {
  test("a right pair and a wrong meaning are announced, focus stays on a matched card, and activating it does nothing", async ({ page }) => {
    await openGame(page, "/games/match");
    await expect(page.getByTestId("match-couplet")).toBeVisible();
    const said = page.getByTestId("match-said");

    await word(page, 0).focus();
    await page.keyboard.press("Enter");
    await meaning(page, 1).focus();
    await page.keyboard.press("Enter");
    await expect(said).toHaveText("نشد");
    await expect(meaning(page, 1)).toBeFocused();

    await meaning(page, 0).focus();
    await page.keyboard.press("Enter");
    await expect(said).toContainText("درست: ");
    await expect(said).toContainText("یعنی ");
    await expect(meaning(page, 0)).toHaveAttribute("aria-disabled", "true");
    await expect(meaning(page, 0)).toBeFocused(); // still there to read, not dropped
    await expect(page.getByTestId("score")).toHaveText("+۱۰");

    // Activating a matched card, or a meaning with no word in hand, changes nothing and says nothing new.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await word(page, 0).focus();
    await page.keyboard.press("Enter");
    await expect(word(page, 0)).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("score")).toHaveText("+۱۰");
    await expect(said).toContainText("درست: ");
  });
});
