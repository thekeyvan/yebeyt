import type { GameCouplet } from "./couplet";
import { locate, type GlossaryEntry, type GlossaryWord } from "./matchGlossary";
import * as scoring from "./scoring";
import type { SeededGenerator } from "./seeded";

/** A written word of a couplet; `glossed` words are the dotted ones. */
export type MatchToken = { text: string; glossed: boolean };

/** A hard word and its meaning. Its id is its place among the words, in reading order. */
export type MatchWord = { id: number; text: string; gloss: string };

export const maxWords = 5;
export const questionCount = 5;

/** One couplet of معنی‌یاب: its words and the meanings in another order (Games/MatchRound.swift). */
export type MatchQuestion = {
  couplet: GameCouplet;
  /** The two hemistichs, word by word. */
  lines: MatchToken[][];
  /** The glossed words as they are read (the first hemistich first). */
  words: MatchWord[];
  /** The word ids in the order of the meanings column. */
  meanings: number[];
};

/** Words that are not found in the couplet are left out; with fewer than two there is no question. */
export function matchQuestion(entry: GlossaryEntry, couplet: GameCouplet, generator: SeededGenerator): MatchQuestion | undefined {
  const found: { hemistich: number; start: number; word: GlossaryWord }[] = [];
  const lines: MatchToken[][] = [];
  for (const hemistich of [1, 2]) {
    const words = entry.words.filter((word) => word.m === hemistich);
    const located = locate(
      words.map((word) => word.text),
      hemistich === 1 ? couplet.m1 : couplet.m2,
    );
    const glossed = new Set<number>();
    words.forEach((word, index) => {
      const range = located.ranges[index];
      if (!range) return;
      found.push({ hemistich, start: range[0], word });
      for (let token = range[0]; token < range[1]; token++) glossed.add(token);
    });
    lines.push(located.tokens.map((text, index) => ({ text, glossed: glossed.has(index) })));
  }
  const ordered = found.sort((a, b) => a.hemistich - b.hemistich || a.start - b.start).slice(0, maxWords);
  if (ordered.length < 2) return undefined;
  const words = ordered.map(({ word }, id) => ({ id, text: word.text, gloss: word.gloss }));
  const inOrder = words.map((word) => word.id);
  let meanings = generator.shuffled(inOrder);
  if (meanings.every((id, place) => id === inOrder[place])) meanings = meanings.reverse(); // never in the order of the words
  return { couplet, lines, words, meanings };
}

export type Pick = "matched" | "wrong" | "ignored";

/** A round of معنی‌یاب: five couplets, each with its hard words to match to their meanings. A wrong meaning only shakes; there is no clock and no penalty. */
export class MatchRound {
  index = 0;
  /** The words of the couplet in play that have their meaning. */
  matched = new Set<number>();
  selectedWord?: number;
  pairs = 0;

  private constructor(readonly questions: readonly MatchQuestion[]) {}

  /** A round of these questions; undefined when there are none. */
  static of(questions: readonly MatchQuestion[]): MatchRound | undefined {
    return questions.length === 0 ? undefined : new MatchRound(questions);
  }

  /** Five couplets from the entries, in a random order; the ones `couplet` can't give are skipped. */
  static make(entries: readonly GlossaryEntry[], couplet: (entry: GlossaryEntry) => GameCouplet | undefined, generator: SeededGenerator): MatchRound | undefined {
    const questions: MatchQuestion[] = [];
    for (const entry of generator.shuffled(entries)) {
      if (questions.length >= questionCount) break;
      const game = couplet(entry);
      const question = game && matchQuestion(entry, game, generator);
      if (question) questions.push(question);
    }
    return MatchRound.of(questions);
  }

  get current(): MatchQuestion {
    return this.questions[this.index]!;
  }

  get points(): number {
    return this.pairs * scoring.matchPair;
  }

  /** Every word of the couplet has its meaning: the sheet opens. */
  get sheetOpen(): boolean {
    return this.matched.size === this.current.words.length;
  }

  get isFinished(): boolean {
    return this.sheetOpen && this.index === this.questions.length - 1;
  }

  /** One dot each: the couplets that are done. */
  get results(): true[] {
    return Array.from({ length: this.index + (this.sheetOpen ? 1 : 0) }, () => true);
  }

  private has(id: number): boolean {
    return this.current.words.some((word) => word.id === id);
  }

  /** Taps a word; tapping the one in hand again puts it down. */
  selectWord(id: number): void {
    if (this.sheetOpen || !this.has(id) || this.matched.has(id)) return;
    this.selectedWord = this.selectedWord === id ? undefined : id;
  }

  /** Taps a meaning (named by the id of the word it belongs to) with a word in hand. */
  pick(meaning: number): Pick {
    const word = this.selectedWord;
    if (this.sheetOpen || word === undefined || !this.has(meaning) || this.matched.has(meaning)) return "ignored";
    if (word !== meaning) return "wrong";
    this.matched.add(meaning);
    this.selectedWord = undefined;
    this.pairs += 1;
    return "matched";
  }

  /** «سؤال بعدی» */
  next(): void {
    if (!this.sheetOpen || this.isFinished) return;
    this.index += 1;
    this.matched = new Set();
    this.selectedWord = undefined;
  }
}
