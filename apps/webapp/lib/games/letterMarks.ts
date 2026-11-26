/** How a letter of a try fits the word: green is in its place, yellow is in the word elsewhere, grey is not in it (or there are no more of it). */
export type LetterMark = "green" | "yellow" | "grey";

/** The marks of a try, as in Wordle: greens first, then each yellow takes one of the word's remaining letters, so a letter typed twice is yellow twice only if the word has it twice. */
export function letterMarks(guess: readonly string[], answer: readonly string[]): LetterMark[] {
  const marks = guess.map((): LetterMark => "grey");
  const left = new Map<string, number>();
  answer.forEach((letter, index) => {
    if (index >= guess.length || guess[index] !== letter) left.set(letter, (left.get(letter) ?? 0) + 1);
  });
  guess.forEach((letter, index) => {
    if (index < answer.length && letter === answer[index]) marks[index] = "green";
  });
  guess.forEach((letter, index) => {
    const count = left.get(letter) ?? 0;
    if (marks[index] !== "green" && count > 0) {
      marks[index] = "yellow";
      left.set(letter, count - 1);
    }
  });
  return marks;
}

export type DailyOutcome = "playing" | "solved" | "failed";

/** What the browser keeps of one day's puzzle (`DailyRecord`: the same JSON as the phone's). */
export type DailyRecord = {
  tries: string[];
  /** The positions the bulb gave away. */
  hinted: number[];
  outcome: DailyOutcome;
  /** What the puzzle earned: set when it is solved. */
  points: number;
};

export const newRecord = (): DailyRecord => ({ tries: [], hinted: [], outcome: "playing", points: 0 });
