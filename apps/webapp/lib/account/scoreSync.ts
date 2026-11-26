import { ApiError, type Api } from "./api";
import type { SessionLike } from "./session";
import { clipped, type ScoreGame } from "../games/scoreGame";
import type { TehranDay } from "../games/tehranDay";
import { readJSON, writeJSON, type RemovableStorage } from "../reader/store";

type Item = { score: { roundId: string; game: ScoreGame; points: number; playedAt: string } } | { daily: { date: string; solved: boolean; tries: number } };

/** A round waiting to go; `userId` is the account it was played for (undefined: not known, the next sign-in takes it). */
type Entry = { userId?: string; item: Item };

export const scoresKey = "scores.unsent";

/** The daily puzzle's tries (DailyGame.maxTries). */
const maxTries = 3;

/**
 * Reports finished rounds to the server for a signed-in person (Games/ScoreSync.swift): each round with a round id made once, so a retry never counts twice,
 * and the daily puzzle's result for the day. What could not be sent (no network, a server error, a limit) waits in a queue in this browser and goes on the
 * next flush: right away, when the page comes to the front and after a sign-in. A 409 is the round already counted; any other refusal means the server will
 * never take it, so both leave the queue. A guest's rounds are not kept (the onboarding round is, as the account step follows). Each entry knows whose round
 * it is: one of another account is dropped, never sent as the signed-in person's.
 */
export class ScoreSync {
  private queue: Entry[];
  private running?: Promise<void>;
  /** Told after a flush sent something, so the points shown can be fetched again. */
  onSent?: () => void;

  constructor(
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "postScore" | "postDaily">,
    private readonly storage: RemovableStorage,
    private readonly now: () => number = Date.now,
  ) {
    const saved = readJSON(storage, scoresKey);
    this.queue = Array.isArray(saved) ? (saved as Entry[]) : [];
  }

  get hasUnsent(): boolean {
    return this.queue.length > 0;
  }

  /** A round of `game` is over with `points` (clipped to the game's cap). */
  report(game: ScoreGame, points: number, keepWhileSignedOut = false): void {
    if (!this.session.isSignedIn && !keepWhileSignedOut) return;
    const clip = clipped(game, points);
    if (clip > 0) this.enqueue({ score: { roundId: crypto.randomUUID(), game, points: clip, playedAt: new Date(this.now()).toISOString() } });
  }

  /** The daily puzzle of `day` is over; its points go as a round of معمای امروز when it was solved. */
  reportDaily(day: TehranDay, solved: boolean, tries: number, points: number): void {
    if (!this.session.isSignedIn) return;
    this.enqueue({ daily: { date: day.key, solved, tries: Math.min(Math.max(tries, 1), maxTries) } });
    if (solved) this.report("daily", points);
  }

  /** Forgets what is waiting (the account is gone from this browser). */
  clear(): void {
    this.queue = [];
    this.storage.removeItem(scoresKey);
  }

  /** Sends what is waiting, oldest first; a failure stops there and the rest waits. A call while one is running waits for it. */
  flush(): Promise<void> {
    if (!this.session.isSignedIn) return Promise.resolve();
    if (this.running) return this.running;
    const task = this.send().finally(() => {
      if (this.running === task) this.running = undefined;
    });
    this.running = task;
    return task;
  }

  /** Waits for a flush that is running, so nothing lands after the queue is cleared. */
  async settle(): Promise<void> {
    await this.running;
  }

  private async send(): Promise<void> {
    if (!this.session.user) await this.session.restore();
    const me = this.session.user?.id;
    if (!me) return; // who is signed in is not known (no network): try later
    this.queue = this.queue.filter((entry) => entry.userId === undefined || entry.userId === me);
    this.save();
    let sent = false;
    for (let entry = this.queue[0]; entry; entry = this.queue[0]) {
      try {
        await ("score" in entry.item ? this.api.postScore(entry.item.score) : this.api.postDaily(entry.item.daily));
        sent = true;
      } catch (error) {
        if (!(error instanceof ApiError && error.isFinal)) break; // 409: already counted. Any other refusal is final too; the rest waits.
      }
      this.queue = this.queue.slice(1);
      this.save();
    }
    if (sent) this.onSent?.();
  }

  private enqueue(item: Item): void {
    const text = JSON.stringify(item);
    if (!this.queue.some((entry) => JSON.stringify(entry.item) === text)) this.queue.push({ ...(this.session.user ? { userId: this.session.user.id } : {}), item });
    this.save();
    void this.flush();
  }

  private save(): void {
    writeJSON(this.storage, scoresKey, this.queue);
  }
}
