import { Store } from "../reader/store";
import { leaveGame } from "./leave";
import { matchPair } from "./scoring";
import type { MatchRound, Pick } from "./matchRound";
import type { GameStats } from "./stats";

/** A معنی‌یاب round being played: pairs are added to the browser's points as they are made, the best when the round ends (Games/MatchSession.swift). The state is a counter that grows with every change. */
export class MatchSession extends Store<number> {
  finished = false;

  constructor(
    readonly round: MatchRound,
    private readonly stats: GameStats,
  ) {
    super(0);
  }

  /** معنی‌یاب has no clock: a pair is its first answer. */
  get asksBeforeLeaving(): boolean {
    return leaveGame.asks({ answered: this.round.pairs, clockRuns: false, finished: this.finished });
  }

  selectWord(id: number): void {
    this.round.selectWord(id);
    this.changed();
  }

  pick(meaning: number): Pick {
    const pick = this.round.pick(meaning);
    if (pick === "matched") this.stats.award(matchPair);
    this.changed();
    return pick;
  }

  /** «سؤال بعدی»; after the last couplet the round ends. */
  next(): void {
    if (this.round.isFinished) this.finish();
    else this.round.next();
    this.changed();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.raiseBest("match", this.round.points);
    this.stats.finishRound("match", this.round.points);
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
