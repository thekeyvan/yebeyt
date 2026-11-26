import { normalize } from "../library/normalize";
import type { GameCouplet } from "./couplet";
import { wordsOf } from "./letters";
import type { SeededGenerator } from "./seeded";

/** A word on the sticker sheet. Its id tells two stickers with the same word apart. */
export type JigsawSticker = { id: number; word: string };

export const wordRange = { min: 3, max: 14 };
const maxMissing = 6;
const extraStickers = 2;

/**
 * One couplet of جورچین بیت: the first hemistich whole, the second cut into word slots (Games/JigsawQuestion.swift). Some slots are filled already; the
 * others wait for a sticker. The sheet holds those words and two more that fit nowhere.
 */
export type JigsawQuestion = {
  couplet: GameCouplet;
  /** The words of the second hemistich, in order. */
  words: string[];
  /** The positions that wait for a sticker, in order. */
  missing: number[];
  /** The missing words and the extra ones, in the order the sheet first shows them. */
  stickers: JigsawSticker[];
};

/** Whether a couplet can be played: a first hemistich and a second one of 3–14 words. */
export function canPlay(couplet: GameCouplet): boolean {
  const count = wordsOf(couplet.m2).length;
  return couplet.m1.trim() !== "" && count >= wordRange.min && count <= wordRange.max;
}

/** How many words go missing: half of them, at least two and at most six. */
export const missingCount = (words: number): number => Math.min(maxMissing, Math.max(2, Math.floor((words + 1) / 2)));

/** `distractors` are words from other couplets; the first two that are not words of this couplet become the extras. */
export function makeQuestion(couplet: GameCouplet, distractors: readonly string[], generator: SeededGenerator): JigsawQuestion | undefined {
  if (!canPlay(couplet)) return undefined;
  const words = wordsOf(couplet.m2);
  const missing = generator
    .shuffled(words.map((_, index) => index))
    .slice(0, missingCount(words.length))
    .sort((a, b) => a - b);
  const known = new Set(words.map(normalize));
  const extras: string[] = [];
  for (const word of distractors) {
    const plain = normalize(word);
    if (extras.length < extraStickers && plain !== "" && !known.has(plain) && !extras.some((extra) => normalize(extra) === plain)) extras.push(word);
  }
  const stickers = generator.shuffled([...missing.map((position) => words[position]!), ...extras]).map((word, id) => ({ id, word }));
  return { couplet, words, missing, stickers };
}
