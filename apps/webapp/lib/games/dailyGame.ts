import { letterMarks, newRecord, type DailyOutcome, type DailyRecord, type LetterMark } from "./letterMarks";
import * as scoring from "./scoring";

const rank: Record<LetterMark, number> = { grey: 0, yellow: 1, green: 2 };

/** One play of معمای امروز: three tries at the word, built from the keyboard, with a bulb that gives one letter (Games/DailyGame.swift). */
export class DailyGame {
  static readonly maxTries = 3;

  private tried: string[][];
  /** The positions the bulb gave away, in the order they were given. */
  hinted: number[];
  /** The row being built: a letter or nothing in each position. Given positions are filled and stay. */
  entry: (string | undefined)[];

  constructor(
    readonly answer: readonly string[],
    record: DailyRecord = newRecord(),
  ) {
    this.tried = record.tries.map((text) => [...text]);
    this.hinted = [...record.hinted];
    this.entry = answer.map(() => undefined);
    this.fillHints();
  }

  get tries(): readonly (readonly string[])[] {
    return this.tried;
  }

  get outcome(): DailyOutcome {
    const last = this.tried.at(-1);
    if (last && last.join("") === this.answer.join("")) return "solved";
    return this.tried.length >= DailyGame.maxTries ? "failed" : "playing";
  }

  /** The tries that were not the word. */
  get misses(): number {
    return this.tried.filter((letters) => letters.join("") !== this.answer.join("")).length;
  }

  /** Which try (1-based) found the word. */
  get solvedOnTry(): number | undefined {
    return this.outcome === "solved" ? this.tried.length : undefined;
  }

  /** What the puzzle earns: nothing until it is solved. */
  get points(): number {
    const on = this.solvedOnTry;
    return on === undefined ? 0 : scoring.daily(on, this.hinted.length);
  }

  get record(): DailyRecord {
    return { tries: this.tried.map((letters) => letters.join("")), hinted: [...this.hinted], outcome: this.outcome, points: this.points };
  }

  get marks(): LetterMark[][] {
    return this.tried.map((letters) => letterMarks(letters, this.answer));
  }

  /** The best mark of each letter tried so far, for colouring the keys. */
  get keyMarks(): ReadonlyMap<string, LetterMark> {
    const result = new Map<string, LetterMark>();
    this.tried.forEach((letters, row) => {
      const marks = this.marks[row]!;
      letters.forEach((letter, column) => {
        if (rank[marks[column]!] > (result.has(letter) ? rank[result.get(letter)!] : -1)) result.set(letter, marks[column]!);
      });
    });
    return result;
  }

  /** The position the next letter goes to. */
  get cursor(): number | undefined {
    const position = this.entry.findIndex((letter) => letter === undefined);
    return position === -1 ? undefined : position;
  }

  get canSubmit(): boolean {
    return this.outcome === "playing" && this.cursor === undefined;
  }

  /** The bulb has a letter to give: one the word has in a position not given and not already found in place. */
  get canHint(): boolean {
    return this.outcome === "playing" && this.hintPosition !== undefined;
  }

  type(letter: string): void {
    const at = this.cursor;
    if (this.outcome === "playing" && at !== undefined) this.entry[at] = letter;
  }

  /** Takes back the last letter typed (not the ones the bulb gave). */
  erase(): void {
    if (this.outcome !== "playing") return;
    const last = this.entry.findLastIndex((letter, position) => letter !== undefined && !this.hinted.includes(position));
    if (last !== -1) this.entry[last] = undefined;
  }

  /** Puts the row in as a try. False when the row is not full. */
  submit(): boolean {
    if (!this.canSubmit) return false;
    this.tried.push(this.entry as string[]);
    this.entry = this.answer.map(() => undefined);
    this.fillHints();
    return true;
  }

  /** Gives one letter: the first position that is neither given nor already green in a try. */
  hint(): boolean {
    const position = this.hintPosition;
    if (this.outcome !== "playing" || position === undefined) return false;
    this.hinted.push(position);
    this.entry[position] = this.answer[position];
    return true;
  }

  private get hintPosition(): number | undefined {
    const found = new Set(this.marks.flatMap((marks) => marks.flatMap((mark, position) => (mark === "green" ? [position] : []))));
    const position = this.answer.findIndex((_, at) => !this.hinted.includes(at) && !found.has(at));
    return position === -1 ? undefined : position;
  }

  private fillHints(): void {
    for (const position of this.hinted) if (position < this.entry.length) this.entry[position] = this.answer[position];
  }
}
