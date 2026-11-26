import { persianClock } from "../persian";
import { Store } from "../reader/store";
import { leaveGame } from "./leave";
import type { QuizRound } from "./quizRound";
import { SeededGenerator } from "./seeded";
import type { GameStats } from "./stats";

/** A quiz round being played: the round, and what it does to the browser's points (Games/QuizSession.swift). Points are added as questions are answered; the best of the game is kept when the round ends. The state is a counter that grows with every change. */
export class QuizSession extends Store<number> {
  finished = false;
  /** The page is not in front (another tab, a locked screen): the clock waits. */
  isPaused = false;
  /** The question «از بازی بری بیرون؟» is open: the clock waits for the answer. */
  isAsking = false;
  private readonly generator: SeededGenerator;

  constructor(
    readonly round: QuizRound,
    private readonly stats: GameStats,
    seed?: bigint,
  ) {
    super(0);
    this.generator = seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed);
  }

  /** «۰:۱۲»; undefined in games without a clock. */
  get timeText(): string | undefined {
    const left = this.round.timeLeft;
    return left === undefined ? undefined : persianClock(left);
  }

  /** A round that has started asks before it is left: حدس شاعر, مصراع دوم and از کدوم کتاب؟ are timed; گوش کن has no clock, so it waits for the first answer. */
  get asksBeforeLeaving(): boolean {
    return leaveGame.asks({ answered: this.round.answers.length, clockRuns: this.round.clock.kind !== "none", finished: this.finished });
  }

  tick(): void {
    if (this.isPaused || this.isAsking) return;
    const before = this.round.answers.length;
    this.round.tick();
    if (this.round.answers.length > before) this.stats.award(this.round.answers[before]!.points);
    if (this.round.isOver && !this.round.sheetOpen) this.finish();
    this.changed();
  }

  select(option: number): void {
    this.round.select(option);
    this.changed();
  }

  fifty(): void {
    this.round.fifty(this.generator);
    this.changed();
  }

  showWord(): void {
    this.round.showWord();
    this.changed();
  }

  /** «رد کن» */
  skip(): void {
    this.round.skip();
    if (this.round.isFinished) this.finish();
    this.changed();
  }

  useReplay(): boolean {
    const used = this.round.useReplay();
    this.changed();
    return used;
  }

  /** «همینه!» */
  confirm(): void {
    const answer = this.round.confirm();
    if (answer) this.stats.award(answer.points);
    this.changed();
  }

  /** «سؤال بعدی»; after the last question the round ends. */
  next(): void {
    if (this.round.isFinished) this.finish();
    else this.round.next();
    this.changed();
  }

  /** Ends the round once: the best score is kept. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.raiseBest(this.round.kind, this.round.points);
    this.stats.finishRound(this.round.kind, this.round.points);
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
