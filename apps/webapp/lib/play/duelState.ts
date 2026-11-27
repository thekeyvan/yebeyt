import type { GameCouplet } from "../games/couplet";
import type { RoundSummary } from "../games/summary";
import { parseCoupletKey } from "../messages/copy";
import { playCopy } from "./copy";
import type { DuelQuestion, GameEvent } from "./liveGameEvents";
import type { DuelResult, EndReason, GameScore } from "./models";

/** How a finished game ended. */
export type Ending = { winner: string | null; reason: EndReason; scores: GameScore[]; couplets: DuelResult[] };

/** One bar of the round strip under «در برابر». */
export type Segment = { kind: "won"; by: string } | { kind: "nobody" } | { kind: "current" } | { kind: "coming" };

export const roundCount = 5;

/**
 * A game of رودررو as the live events tell it: the question in front, my answer, who answered, the rounds so far and, at the end, the couplets. No screens and
 * no clock of its own (`now` is given, in milliseconds). It changes in place: whoever holds it tells the page (Play/DuelState.swift).
 */
export class DuelState {
  question?: DuelQuestion;
  private askedAt = 0;
  /** The option I chose in this round; undefined before I answered. */
  chosen?: number;
  /** My answer was wrong: I am out of the round. */
  lockedOut = false;
  /** The other player answered wrong and is out of the round (the «جواب داد» chip). */
  otherAnswered = false;
  /** The right option, known when the round is over. */
  rightOption?: number;
  /** Who won each round played, by round number (null: nobody). */
  readonly winners = new Map<number, string | null>();
  readonly scores = new Map<string, number>();
  ending?: Ending;

  /** `me` is my username, `other` the other player's. */
  constructor(
    readonly gameID: string,
    readonly me: string,
    readonly other: string,
  ) {}

  get myScore(): number {
    return this.scores.get(this.me) ?? 0;
  }

  get theirScore(): number {
    return this.scores.get(this.other) ?? 0;
  }

  get isEnded(): boolean {
    return this.ending !== undefined;
  }

  /** The round on screen (1 to 5), 0 before the first question. */
  get round(): number {
    return this.question?.round ?? 0;
  }

  /** The question is open and I may still answer it. */
  get canAnswer(): boolean {
    return this.question !== undefined && this.rightOption === undefined && this.chosen === undefined && !this.lockedOut && !this.isEnded;
  }

  /** The round has a result: the right option is shown and nobody can answer. */
  get isRoundOver(): boolean {
    return this.rightOption !== undefined;
  }

  /** The winner of the round on screen once it is over (null: nobody, or not over). */
  get roundWinner(): string | null {
    return this.winners.get(this.round) ?? null;
  }

  /** Seconds left in the round: the time the question came with, minus the time since. */
  secondsLeft(now: number): number {
    if (!this.question || this.isRoundOver || this.isEnded) return 0;
    return Math.max(0, Math.ceil(this.question.deadlineMs / 1000 - (now - this.askedAt) / 1000));
  }

  /** The five bars: a round won by someone (in their colour), a round nobody won, the one in play, the ones to come. */
  get segments(): Segment[] {
    return Array.from({ length: roundCount }, (_, index): Segment => {
      const number = index + 1;
      if (this.winners.has(number)) {
        const winner = this.winners.get(number);
        return winner ? { kind: "won", by: winner } : { kind: "nobody" };
      }
      return number === Math.max(this.round, 1) && !this.isEnded ? { kind: "current" } : { kind: "coming" };
    });
  }

  /** I choose an option (only while I can answer). Returns whether the answer is to be sent. */
  choose(option: number): boolean {
    if (!this.canAnswer || !this.question || !Number.isInteger(option) || option < 0 || option >= this.question.options.length) return false;
    this.chosen = option;
    return true;
  }

  /** My answer could not be sent: I may answer again. */
  undoChoice(): void {
    if (!this.lockedOut && !this.isRoundOver) this.chosen = undefined;
  }

  apply(event: GameEvent, now: number): void {
    switch (event.type) {
      case "duel.question": {
        if (event.question.gameId !== this.gameID) return;
        // The server asks an open round again when a socket comes back: it is the same round, with the time that is left.
        const again = event.question.round === this.question?.round && this.rightOption === undefined;
        this.question = event.question;
        this.askedAt = now;
        if (!again) {
          this.chosen = undefined;
          this.lockedOut = false;
          this.otherAnswered = false;
          this.rightOption = undefined;
        }
        return;
      }
      case "duel.answered":
        if (event.gameId !== this.gameID || event.round !== this.round) return;
        if (event.username === this.me) this.lockedOut = true;
        else this.otherAnswered = true;
        return;
      case "duel.round":
        if (event.gameId !== this.gameID) return;
        this.winners.set(event.round, event.winner);
        this.rightOption = event.rightOption;
        this.take(event.scores);
        return;
      case "game.ended":
        if (event.gameId !== this.gameID) return;
        this.take(event.scores);
        this.ending = { winner: event.winner, reason: event.reason, scores: event.scores, couplets: event.couplets };
        return;
      default:
        return;
    }
  }

  private take(list: readonly GameScore[]): void {
    for (const { username, score } of list) this.scores.set(username, score);
  }

  /** «بردی!», «سارا برد», «مساوی»; «سارا رفت» when the other left and I won. */
  endTitle(otherName: string): string | undefined {
    const { ending } = this;
    if (!ending) return undefined;
    if (ending.reason === "left" && ending.winner === this.me) return playCopy.duelLeft(otherName);
    if (ending.winner === null) return playCopy.title("draw", otherName);
    return playCopy.title(ending.winner === this.me ? "won" : "lost", otherName);
  }

  /**
   * The end-of-game screen's content: the result as the title, the rounds won, and the five couplets with their meanings (a green ✓ for a round I won, a red × for
   * one the other won, a grey dot when nobody did). Undefined before the end.
   */
  summary(otherName: string, poetName: (slug: string) => string): RoundSummary | undefined {
    const { ending } = this;
    const title = this.endTitle(otherName);
    if (!ending || title === undefined) return undefined;
    const rows = ending.couplets.flatMap((result) => {
      const parsed = parseCoupletKey(result.key);
      if (!parsed) return [];
      const couplet: GameCouplet = { poem: parsed.path, index: parsed.index, m1: result.m1, m2: result.m2, meaning: result.meaning, poetSlug: result.poet, poetName: poetName(result.poet), bookTitle: result.bookTitle, bookPath: "", meaningIsAI: false };
      return [{ couplet, result: result.winner === null ? null : result.winner === this.me }];
    });
    return {
      points: 0,
      right: this.myScore,
      total: roundCount,
      subtitle: playCopy.scores(this.myScore, otherName, this.theirScore),
      rows,
      title,
      showsPoints: false,
      showsMeanings: true,
      won: ending.winner === this.me,
    };
  }
}
