import { persianDigits } from "../persian";
import { playCopy, type Outcome } from "./copy";
import { otherThan, playerName, playerOf, type FriendGame, type MoshMove } from "./models";
import { lastLetter } from "./moshLetters";

/**
 * What PlayMosh shows for a game, worked out from the game and who I am: whose turn, the letter to start with, the scores, the time left. No screens, and no
 * clock of its own (`now` is given, in milliseconds) (Play/MoshState.swift).
 */
export class MoshState {
  /** `me` is my username. */
  constructor(
    readonly game: FriendGame,
    readonly me: string,
  ) {}

  get mine() {
    return playerOf(this.game, this.me);
  }

  get other() {
    return otherThan(this.game, this.me);
  }

  /** The other player's name, empty while nobody has joined. */
  get otherName(): string {
    return this.other ? playerName(this.other) : "";
  }

  get isWaiting(): boolean {
    return this.game.status === "waiting";
  }

  get isActive(): boolean {
    return this.game.status === "active";
  }

  get isDone(): boolean {
    return this.game.status === "done";
  }

  /** It is my turn in an active game. */
  get isMyTurn(): boolean {
    return this.isActive && this.game.turn?.username === this.me;
  }

  get myScore(): number {
    return this.mine?.score ?? 0;
  }

  get theirScore(): number {
    return this.other?.score ?? 0;
  }

  get lastMove(): MoshMove | undefined {
    return this.game.moves.at(-1);
  }

  /** The letter the next couplet starts with: the last letter of the previous one. Undefined for the first couplet, which is free. */
  get requiredLetter(): string | undefined {
    return this.lastMove && lastLetter(this.lastMove.m2);
  }

  /** The couplets already played, which may not be played again. */
  get usedKeys(): Set<string> {
    return new Set(this.game.moves.map((move) => move.key));
  }

  /** «دور ۸»: the couplet being asked for (the one after the played ones); after the end, the last one played. */
  get round(): number {
    return this.isDone ? Math.max(this.game.moves.length, 1) : this.game.moves.length + 1;
  }

  /** «تا فردا», «۳۰ ثانیه», «۲ دقیقه». */
  get turnLabel(): string {
    return playCopy.turnTime(this.game.turnSeconds);
  }

  /** «دور ۸ · تا فردا» */
  get roundLine(): string {
    return `دور ${persianDigits(this.round)} · ${this.turnLabel}`;
  }

  /** Seconds left in the turn at `now`, undefined when no turn is running. */
  secondsLeft(now: number): number | undefined {
    const deadline = this.game.turn?.deadline;
    return this.isActive && deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000)) : undefined;
  }

  /** The clock of the header: «۲۱ ساعت» for a game with a day to answer, «۰:۲۵» for the short ones. */
  timeLabel(now: number): string | undefined {
    const seconds = this.secondsLeft(now);
    return seconds === undefined ? undefined : playCopy.timeLeft(seconds, this.game.turnSeconds);
  }

  /** The line over the input: «نوبت توئه، با حرف «د»», «نوبت توئه؛ بیت اول رو بگو», or «منتظر سارا…». */
  get turnLine(): string {
    if (this.isWaiting || !this.isMyTurn) return playCopy.waiting(this.otherName);
    return this.requiredLetter ? playCopy.myTurn(this.requiredLetter) : playCopy.myTurnFirst;
  }

  /** The card of the بازی tab: «سارا جوابت رو داد», or «سارا اومد توی بازی» before anything was played. */
  get cardTitle(): string {
    return this.game.moves.length === 0 ? `${this.otherName} اومد توی بازی` : `${this.otherName} جوابت رو داد`;
  }

  get outcome(): Outcome | undefined {
    if (!this.isDone) return undefined;
    return this.game.winner === null ? "draw" : this.game.winner === this.me ? "won" : "lost";
  }

  /** «بردی!», «سارا برد», «مساوی» */
  get outcomeTitle(): string | undefined {
    return this.outcome && playCopy.title(this.outcome, this.otherName);
  }

  /** Why it ended: «وقتت تموم شد», «سارا کم آورد», «سارا رفت». Undefined for a game that ended by playing out. */
  get endLine(): string | undefined {
    const reason = this.game.endReason;
    if (!this.isDone || !reason) return undefined;
    const loserIsMe = this.game.winner !== null && this.game.winner !== this.me;
    switch (reason) {
      case "timeout":
        return loserIsMe ? "وقتت تموم شد" : `وقت ${this.otherName} تموم شد`;
      case "resigned":
        return loserIsMe ? "کم آوردی" : `${this.otherName} کم آورد`;
      case "left":
        return `${this.otherName} رفت`;
      default:
        return undefined;
    }
  }
}
