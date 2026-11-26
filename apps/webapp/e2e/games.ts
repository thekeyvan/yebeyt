import { expect, type Page } from "@playwright/test";
import { openApp } from "./browse";

/** The daily puzzle of the fixed day (2 Azar 1405): a couplet of Khayyam, and the word «نهاد» hidden in its second hemistich. */
export const daily = { word: [..."نهاد"], misses: [[..."رلمگ"], [..."مگلر"], [..."گمرل"]], first: "ماییم که اصلِ شادی و کانِ غمیم", day: Date.UTC(2026, 10, 23) / 86_400_000 };

export const green = "rgb(108, 203, 58)";
export const fire = "rgb(255, 77, 36)";

/** Taps the keys of the on-screen keyboard. */
export async function tapKeys(page: Page, letters: string[]) {
  for (const letter of letters) await page.locator(`[data-key="${letter}"]`).click();
}

/** Opens a page of the app on the fixed day with the جورچین round fixed too (`beytSeed`): its first couplet is Hafez's ghazal 141, couplet 2, which is in the bundled books, and no couplet of it has the same word twice. */
export async function openRound(page: Page, path = "/games/jigsaw") {
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  await openApp(page, path);
}

/** A key of a Persian keyboard, which Playwright cannot press (it knows the keys of a US one): the page is told the key was pressed. */
export const typeKey = (page: Page, key: string) => page.evaluate((pressed) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: pressed, bubbles: true })), key);

/** What the browser keeps of the games (`games.stats`). */
export const savedStats = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("games.stats") ?? "{}") as { points?: number; solvedDays?: number[]; best?: Record<string, number>; daily?: Record<string, { tries: string[]; outcome: string; points: number; hinted: number[] }> });

/** The couplet on the جورچین card, found in the bundled deck: where it is in its poem and the right words of its second hemistich. */
export async function coupletOnCard(page: Page) {
  await page.getByTestId("jigsaw-card").waitFor();
  return page.evaluate(async () => {
    const m1 = document.querySelector("[data-testid=jigsaw-card] p")!.textContent;
    const deck = (await (await fetch("/data/games.json")).json()) as { poem: string; index: number; m1: string; m2: string }[];
    const entry = deck.find((couplet) => couplet.m1 === m1)!;
    return { poem: entry.poem, index: entry.index, words: entry.m2.split(/\s+/).filter(Boolean) };
  });
}

/** The positions of the slots that wait for a sticker. */
export const emptySlots = (page: Page) => page.locator("[data-drop]").evaluateAll((elements) => elements.map((element) => Number((element as HTMLElement).dataset.drop)));

const sticker = (page: Page, word: string) => page.locator(`[data-testid^=sticker-][data-word="${word}"]`).first();

/** Fills every slot by tapping a sticker and then the slot: with the right words, or each slot with the word of the next one (so every slot is wrong). Returns the slots. */
export async function fillByTaps(page: Page, how: "right" | "wrong") {
  const { words } = await coupletOnCard(page);
  const slots = await emptySlots(page);
  for (const [order, position] of slots.entries()) {
    await sticker(page, words[how === "right" ? position : slots[(order + 1) % slots.length]!]!).click();
    await page.getByTestId(`slot-${position}`).click();
  }
  return slots;
}

/** Answers the couplet on the card and waits for its sheet. */
export async function answerCouplet(page: Page, how: "right" | "wrong") {
  await fillByTaps(page, how);
  await page.getByTestId("check").click();
  await expect(page.getByTestId("answer-sheet")).toBeVisible();
}

/** The time on the clock, in seconds. */
export async function clockSeconds(page: Page) {
  const digits = (await page.getByTestId("timer").textContent())!.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const [minutes, seconds] = digits.split(":").map(Number);
  return minutes! * 60 + seconds!;
}

/** The middle of an element. */
export async function centreOf(locator: ReturnType<Page["locator"]>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Puts a finger (Chromium on a phone: real touch events through the protocol) or, where the browser cannot, the mouse, on `from` and moves it to `to`
 * without letting go. `release` lets go.
 */
export async function holdAndMove(page: Page, browserName: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 12;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (browserName === "chromium" && (await page.evaluate(() => matchMedia("(pointer: coarse)").matches))) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(i)] });
    return () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
  return () => page.mouse.up();
}
