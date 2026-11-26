import { Store } from "../reader/store";
import { persianClock } from "../persian";
import type { JigsawBoard } from "./jigsawBoard";
import type { JigsawRound } from "./jigsawRound";
import { leaveGame } from "./leave";
import { SeededGenerator } from "./seeded";
import type { GameStats } from "./stats";

/** A round being played: the round itself, and what it does to the browser's points (Games/JigsawSession.swift). Points are added as couplets are answered; the seconds left are added when the last couplet is. The state is a counter that grows with every change. */
export class JigsawSession extends Store<number> {
  finished = false;
  /** The page is not in front (another tab, a locked screen): the clock waits. */
  isPaused = false;
  /** The question «از بازی بری بیرون؟» is open: the clock waits for the answer. */
  isAsking = false;
  private readonly generator: SeededGenerator;

  constructor(
    readonly round: JigsawRound,
    private readonly stats: GameStats,
    seed?: bigint,
  ) {
    super(0);
    this.generator = seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed);
  }

  get timeText(): string {
    return persianClock(this.round.timeLeft);
  }

  /** A round that has started asks before it is left. */
  get asksBeforeLeaving(): boolean {
    return leaveGame.asks({ answered: this.round.answers.length, clockRuns: !this.round.isOver, finished: this.finished });
  }

  tick(): void {
    if (this.isPaused || this.isAsking) return;
    const wasOver = this.round.isOver;
    this.round.tick();
    if (!wasOver && this.round.isOver) this.finish();
    this.changed();
  }

  edit(change: (board: JigsawBoard) => void): void {
    this.round.edit(change);
    this.changed();
  }

  shuffle(): void {
    this.round.edit((board) => board.shuffle(this.generator));
    this.changed();
  }

  /** «بچسبون!» */
  check(): void {
    const answer = this.round.check();
    if (answer) this.stats.award(answer.result.points);
    this.changed();
  }

  /** «بیت بعدی»; after the last couplet the round ends. */
  next(): void {
    if (this.round.isFinished) this.finish();
    else this.round.next();
    this.changed();
  }

  /** Ends the round once: the seconds left and the best score are kept. */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.award(this.round.timeBonus);
    this.stats.raiseBest("jigsaw", this.round.totalPoints);
    this.stats.finishRound("jigsaw", this.round.totalPoints);
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
