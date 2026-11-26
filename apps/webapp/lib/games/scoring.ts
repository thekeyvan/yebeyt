// The points of the games, in one place (Games/Scoring.swift; docs/yebeyt-2.md, «Scores before accounts»).

/** The bulb of معمای امروز («یه حرف») costs this much. */
export const dailyHintCost = 30;
/** The bulb of جورچین costs this much. */
export const jigsawHintCost = 20;
/** معمای امروز: 100, 70 or 40 for the first, second or third try. */
export const dailyByTry = [100, 70, 40] as const;
/** جورچین: points for each word the player placed right. */
export const jigsawWord = 20;
/** جورچین: points for each second left when the round is finished. */
export const jigsawSecondLeft = 1;

/** A solved daily puzzle: by the try it was solved on (1-based), less the hints used; never below zero. */
export function daily(solvedOnTry: number, hints: number): number {
  const points = dailyByTry[solvedOnTry - 1];
  return points === undefined ? 0 : Math.max(0, points - hints * dailyHintCost);
}

/** One جورچین couplet: 20 for each word the player placed right, less the hints used; never below zero. */
export const jigsaw = (correctWords: number, hints: number): number => Math.max(0, correctWords * jigsawWord - hints * jigsawHintCost);

/** The bonus of a round that was finished before the time ran out. */
export const jigsawTimeBonus = (secondsLeft: number): number => Math.max(0, secondsLeft) * jigsawSecondLeft;

/** The quiz games (حدس شاعر, مصراع دوم, از کدوم کتاب؟, گوش کن): 20 for a right answer. */
export const quizBase = 20;
/** … and 2 for each second left of the 12 a question gets. */
export const quizSecondLeft = 2;
export const quizWindow = 12;
/** ۵۰:۵۰ and «یه کلمه» cost this much each. */
export const quizHintCost = 20;
/** معنی‌یاب: points for each pair. */
export const matchPair = 10;

/** A right answer of a quiz: 20 and 2 per second left, less the hints used; never below zero. */
export const quiz = (secondsLeft: number, hints: number): number => Math.max(0, quizBase + Math.max(0, secondsLeft) * quizSecondLeft - hints * quizHintCost);
