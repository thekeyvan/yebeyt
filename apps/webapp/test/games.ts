import type { GameCouplet } from "../lib/games/couplet";
import { GameDeck } from "../lib/games/couplet";

/** Couplets and decks for the game tests, built in code so the rules are tested on known words (`GameFixtures` in the phone's tests). */
export function couplet(
  number: number,
  { m1 = "بنی آدم اعضای یکدیگرند", m2 = "که در آفرینش ز یک گوهرند", poet = "saadi" }: { m1?: string; m2?: string; poet?: string } = {},
): GameCouplet {
  return {
    poem: `/${poet}/golestan/sh${number}`,
    index: 0,
    m1,
    m2,
    meaning: "آدم‌ها همه از یه ریشه‌ان.",
    poetSlug: poet,
    poetName: "سعدی",
    bookTitle: "گلستان",
    bookPath: "/saadi/golestan",
    meaningIsAI: false,
  };
}

export const deck = (count: number): GameDeck => new GameDeck(Array.from({ length: count }, (_, number) => couplet(number, { m2: `که در آفرینش ز یک گوهر${number}` })));

export const tehran = (iso: string): Date => new Date(iso);
