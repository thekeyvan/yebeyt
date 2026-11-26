import * as scoring from "./scoring";
import type { QuizKind, QuizQuestion } from "./quizQuestion";
import type { SeededGenerator } from "./seeded";

/** Seconds for each question, seconds for the whole round, or no clock. */
export type Clock = { kind: "perQuestion"; seconds: number } | { kind: "round"; seconds: number } | { kind: "none" };

export type QuizAnswer = {
  /** The option confirmed; undefined when the time ran out. */
  chosen?: number;
  right: boolean;
  points: number;
  seconds: number;
};

const clockOf = (kind: QuizKind): Clock => {
  switch (kind) {
    case "poet":
    case "book":
      return { kind: "perQuestion", seconds: scoring.quizWindow };
    case "misra":
      return { kind: "round", seconds: 120 };
    default:
      return { kind: "none" };
  }
};

/**
 * A round of حدس شاعر, مصراع دوم, از کدوم کتاب؟ or گوش کن: questions one after another, each with options, a choice to confirm, ۵۰:۵۰ (and «یه کلمه» in
 * گوش کن) and a clock that depends on the game. The clock runs only while a question is being played, not while the sheet after the answer is open
 * (Games/QuizRound.swift).
 */
export class QuizRound {
  readonly clock: Clock;
  index = 0;
  selected?: number;
  /** The options ۵۰:۵۰ took away from the question in play. */
  removed = new Set<number>();
  wordShown = false;
  replaysLeft = 1;
  roundLeft: number;
  secondsOnCurrent = 0;
  /** One for each question passed: its answer, or null when it was skipped. */
  private slots: (QuizAnswer | null)[] = [];

  private constructor(
    readonly kind: QuizKind,
    readonly questions: readonly QuizQuestion[],
  ) {
    this.clock = clockOf(kind);
    this.roundLeft = this.clock.kind === "round" ? this.clock.seconds : 0;
  }

  /** A round of these questions; undefined when there are none. */
  static of(kind: QuizKind, questions: readonly QuizQuestion[]): QuizRound | undefined {
    return questions.length === 0 ? undefined : new QuizRound(kind, questions);
  }

  get current(): QuizQuestion {
    return this.questions[this.index]!;
  }

  /** The answers given (skipped questions have none). */
  get answers(): QuizAnswer[] {
    return this.slots.filter((slot) => slot !== null);
  }

  /** The answer whose sheet is open: the question is answered but the player has not moved on. */
  get sheetOpen(): boolean {
    return !!this.slots[this.index];
  }

  get lastAnswer(): QuizAnswer | undefined {
    return this.slots[this.index] ?? undefined;
  }

  get isFinished(): boolean {
    return this.slots.length === this.questions.length;
  }

  /** Every question is answered, or the round's time is up. */
  get isOver(): boolean {
    return this.isFinished || (this.clock.kind === "round" && this.roundLeft === 0);
  }

  /** The seconds the clock shows; undefined in games without one. */
  get timeLeft(): number | undefined {
    switch (this.clock.kind) {
      case "perQuestion":
        return Math.max(0, this.clock.seconds - this.secondsOnCurrent);
      case "round":
        return this.roundLeft;
      default:
        return undefined;
    }
  }

  get points(): number {
    return this.answers.reduce((sum, answer) => sum + answer.points, 0);
  }

  get rightCount(): number {
    return this.answers.filter((answer) => answer.right).length;
  }

  /** One dot each: right, wrong, or null for a question that was skipped. */
  get results(): (boolean | null)[] {
    return this.slots.map((slot) => (slot ? slot.right : null));
  }

  /** The hints used on the question in play, each costing 20. */
  get hints(): number {
    return (this.removed.size === 0 ? 0 : 1) + (this.wordShown ? 1 : 0);
  }

  private get inPlay(): boolean {
    return !this.isOver && !this.sheetOpen;
  }

  /** ۵۰:۵۰ is on حدس شاعر and مصراع دوم. */
  get canFifty(): boolean {
    return (this.kind === "poet" || this.kind === "misra") && this.removed.size === 0 && this.inPlay;
  }

  get canShowWord(): boolean {
    return this.kind === "listen" && !this.wordShown && this.inPlay;
  }

  /** «رد کن» is on حدس شاعر, مصراع دوم and گوش کن. */
  get canSkip(): boolean {
    return this.kind !== "book" && this.inPlay;
  }

  tick(): void {
    if (!this.inPlay) return;
    switch (this.clock.kind) {
      case "round":
        this.roundLeft -= 1;
        this.secondsOnCurrent += 1;
        break;
      case "perQuestion":
        this.secondsOnCurrent += 1;
        if (this.secondsOnCurrent >= this.clock.seconds) this.slots.push({ right: false, points: 0, seconds: this.clock.seconds });
        break;
    }
  }

  /** Chooses an option; choosing the chosen one again lets it go. */
  select(option: number): void {
    if (!this.inPlay || !this.current.options[option] || this.removed.has(option)) return;
    this.selected = this.selected === option ? undefined : option;
  }

  /** «همینه!»: nothing happens until an option is chosen. */
  confirm(): QuizAnswer | undefined {
    if (!this.inPlay || this.selected === undefined) return undefined;
    const right = this.selected === this.current.correct;
    const points = right ? scoring.quiz(this.secondsLeftForBonus, this.hints) : 0;
    const answer: QuizAnswer = { chosen: this.selected, right, points, seconds: this.clock.kind === "none" ? 0 : this.secondsOnCurrent };
    this.slots.push(answer);
    return answer;
  }

  /** «رد کن»: no points, no answer and no sheet; the next question starts, or the round ends after the last one. */
  skip(): void {
    if (!this.canSkip) return;
    this.slots.push(null);
    this.startNext();
  }

  private get secondsLeftForBonus(): number {
    return this.clock.kind === "none" ? 0 : Math.max(0, scoring.quizWindow - this.secondsOnCurrent);
  }

  /** ۵۰:۵۰: half of the wrong options go away (two of four, one of three). */
  fifty(generator: SeededGenerator): void {
    if (!this.canFifty) return;
    const wrong = this.current.options.flatMap((_, index) => (index === this.current.correct ? [] : index));
    this.removed = new Set(generator.shuffled(wrong).slice(0, Math.floor(this.current.options.length / 2)));
    if (this.selected !== undefined && this.removed.has(this.selected)) this.selected = undefined;
  }

  /** «یه کلمه» of گوش کن. */
  showWord(): void {
    if (this.canShowWord) this.wordShown = true;
  }

  /** «دوباره بشنو»: whether there was a replay left to use. */
  useReplay(): boolean {
    if (this.kind !== "listen" || !this.inPlay || this.replaysLeft === 0) return false;
    this.replaysLeft -= 1;
    return true;
  }

  /** «سؤال بعدی»: the next question. After the last one the round is finished. */
  next(): void {
    if (this.sheetOpen && !this.isFinished) this.startNext();
  }

  private startNext(): void {
    if (this.isFinished) return;
    this.index += 1;
    this.selected = undefined;
    this.removed = new Set();
    this.wordShown = false;
    this.replaysLeft = 1;
    this.secondsOnCurrent = 0;
  }
}
