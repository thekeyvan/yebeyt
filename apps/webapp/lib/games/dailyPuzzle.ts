import type { GameCouplet, GameDeck } from "./couplet";
import { alphabet, lettersOf, wordsOf } from "./letters";
import { SeededGenerator } from "./seeded";
import type { TehranDay } from "./tehranDay";

/** The words that are too easy or too common to hide: a hidden «که» is no puzzle. Compared as letters. */
export const stopWords: ReadonlySet<string> = new Set(
  "این آن اگر همه هر هم چون چو چنین چنان کجا کنون نیز پس مگر بود است شد شود باشد کرد کند دارد نه نی من تو او ما شما ایشان مرا ترا وین وان کان کین کز زان زین بدین بدان همچو همی بر در از به با تا که را یا ور اندر بی ای هیچ جز آنکه".split(" "),
);

export const letterRange = { min: 3, max: 6 };
/** The keys of the keyboard under the grid, besides «پاک کن»: the word's letters and distractors. */
export const keyCount = 12;

/** «معمای امروز»: one couplet and one word of it, the same for everyone on a Tehran day (Games/DailyPuzzle.swift). */
export type DailyPuzzle = {
  couplet: GameCouplet;
  /** The hidden word as written in the couplet, with its diacritics. */
  word: string;
  /** Its letters as the game compares them. */
  letters: string[];
  /** False when the word is in the first hemistich (only when the second has none). */
  inSecondHemistich: boolean;
  /** Where the word is among the words of its hemistich. */
  wordIndex: number;
  /** The keyboard: every letter of the word, distractors up to `keyCount`, in an order fixed for the day. */
  keys: string[];
};

/** The hemistich the word is in. */
export const hemistichOf = (puzzle: DailyPuzzle): string => (puzzle.inSecondHemistich ? puzzle.couplet.m2 : puzzle.couplet.m1);

/** The hideable words of a hemistich, in order. */
export function candidates(hemistich: string): { index: number; word: string; letters: string[] }[] {
  return wordsOf(hemistich).flatMap((word, index) => {
    const letters = lettersOf(word);
    return letters && letters.length >= letterRange.min && letters.length <= letterRange.max && !stopWords.has(letters.join("")) ? [{ index, word, letters }] : [];
  });
}

/** The word's own letters and other letters of the alphabet, `keyCount` in all, shuffled. */
export function keysFor(letters: readonly string[], generator: SeededGenerator): string[] {
  const own = [...new Set(letters)];
  const others = generator.shuffled(alphabet.filter((letter) => !own.includes(letter)));
  return generator.shuffled([...own, ...others.slice(0, Math.max(0, keyCount - own.length))]);
}

/**
 * The puzzle of a day. The couplet is taken from a day-seeded start in the deck, the first one that has a fitting word (3–6 letters, not a
 * stop word, from the second hemistich when it has one). It gives what the phone gives for the same day and deck.
 */
export function pickPuzzle(day: TehranDay, deck: GameDeck): DailyPuzzle | undefined {
  const count = deck.couplets.length;
  if (count === 0) return undefined;
  const generator = new SeededGenerator(BigInt.asUintN(64, BigInt(day.number) * 0x2545f4914f6cdd1dn));
  const start = generator.below(count);
  for (let step = 0; step < count; step++) {
    const couplet = deck.couplets[(start + step) % count]!;
    for (const inSecondHemistich of [true, false]) {
      const words = candidates(inSecondHemistich ? couplet.m2 : couplet.m1);
      if (words.length === 0) continue;
      const chosen = words[generator.below(words.length)]!;
      return { couplet, word: chosen.word, letters: chosen.letters, inSecondHemistich, wordIndex: chosen.index, keys: keysFor(chosen.letters, generator) };
    }
  }
  return undefined;
}
