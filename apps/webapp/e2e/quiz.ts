import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { plain } from "../lib/library/normalize";
import { openApp } from "./browse";

const data = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "../ios/Yebeyt/Resources/Data", `${name}.json`), "utf8")) as unknown;

type Entry = { poem: string; index: number; m1: string; m2: string; poet: string; bookTitle: string; clip?: { recitation: number; start: number; end: number } | null };
export const deck = data("games") as Entry[];
const poetNames = new Map((data("library") as { poets: { slug: string; name: string }[] }).poets.map((poet) => [poet.slug, poet.name]));

export const green = "rgb(108, 203, 58)";
export const fire = "rgb(255, 77, 36)";

export type QuizGame = "poet" | "misra" | "book" | "listen";

/** Opens a game of the app on the fixed day with the round fixed too (`beytSeed`); the quiz screen is there once its first question is. */
export async function openGame(page: Page, path: string, stubbed = true) {
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  if (stubbed) await openApp(page, path);
  else await page.goto(path);
  await expect(page.getByTestId("game")).toBeVisible();
}

/** The options of the question in play, in order. */
export const options = (page: Page) => page.locator("[data-testid^=option-]");

/** Which option is the right one, worked out from the deck (the page does not say): the couplet is found by its first hemistich, or in گوش کن by the clip. */
export async function rightIndex(page: Page, game: QuizGame): Promise<number> {
  const entry = await currentEntry(page, game);
  const wanted = game === "poet" ? poetNames.get(entry.poet)! : game === "book" ? entry.bookTitle : plain(entry.m2);
  const texts = await options(page).evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label") ?? element.textContent ?? ""));
  const found = texts.indexOf(wanted);
  expect(found, `${wanted} among ${texts.join(" | ")}`).toBeGreaterThanOrEqual(0);
  return found;
}

async function currentEntry(page: Page, game: QuizGame): Promise<Entry> {
  if (game === "listen") {
    const card = page.getByTestId("listen-card");
    await card.waitFor();
    const [start, end] = [Number(await card.getAttribute("data-clip-start")), Number(await card.getAttribute("data-clip-end"))];
    const found = deck.find((entry) => entry.clip?.start === start && entry.clip.end === end);
    expect(found, `a deck couplet with the clip ${start}–${end}`).toBeDefined();
    return found!;
  }
  const first = (await page.getByTestId("quiz-couplet").locator("p").first().textContent())!;
  const found = deck.find((entry) => plain(entry.m1) === first);
  expect(found, first).toBeDefined();
  return found!;
}

/** Picks an option and confirms it, then waits for the sheet. */
export async function answer(page: Page, index: number) {
  await options(page).nth(index).click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("answer-sheet")).toBeVisible();
}

export async function answerRight(page: Page, game: QuizGame) {
  await answer(page, await rightIndex(page, game));
}

/** Answers with an option that is not the right one. */
export async function answerWrong(page: Page, game: QuizGame) {
  const right = await rightIndex(page, game);
  await answer(page, right === 0 ? 1 : 0);
  return right;
}

export const persian = (number: number) => String(number).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]!);

/** The points shown on the score sticker, in Arabic digits. */
export async function shownScore(page: Page) {
  const text = (await page.getByTestId("score").textContent())!;
  return Number(text.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace("+", ""));
}

/** The × asks «از بازی بری بیرون؟»: the clock waits for the answer, «بمون» stays, «برو بیرون» (also asked by Escape) goes back to the tab. */
export async function leaveAsks(page: Page) {
  await page.getByRole("button", { name: "بستن" }).click();
  const question = page.getByRole("dialog", { name: "از بازی بری بیرون؟" });
  await expect(question).toBeVisible();
  await expect(question).toContainText("نتیجه‌ی این دور ثبت نمی‌شه.");
  const timer = page.getByTestId("timer");
  if (await timer.count()) {
    const waiting = await timer.textContent();
    await page.waitForTimeout(2300);
    expect(await timer.textContent()).toBe(waiting);
  }
  await question.getByRole("button", { name: "بمون" }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByTestId("game")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "برو بیرون" }).click();
  await expect(page.getByTestId("game")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === "/games");
}
