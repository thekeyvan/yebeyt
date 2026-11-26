import { readJSON, Store, writeJSON, type KeyValueStorage, type RemovableStorage } from "../reader/store";
import type { DailyRecord } from "./letterMarks";
import type { GameKind } from "./kinds";
import { TehranDay } from "./tehranDay";

/** What the browser keeps of the games until accounts exist, in the shape the phone keeps it (Games/GameStats.swift `Saved`); W4 syncs it. */
export type SavedStats = {
  points: number;
  /** The Tehran days the daily puzzle was solved, as day numbers. */
  solvedDays: number[];
  /** The best round of each game. */
  best: Record<string, number>;
  /** Each day's daily puzzle, by day number. */
  daily: Record<string, DailyRecord>;
};

/** Where it is kept in localStorage: the phone's own name. */
export const statsKey = "games.stats";
/** The account the points were carried over to, and the points that belong to accounts that have left this browser (`GameStats.ownerKey`, `claimedKey`). */
export const statsOwnerKey = "games.stats.owner";
export const statsClaimedKey = "games.stats.claimed";

type State = {
  saved: SavedStats;
  today: TehranDay;
  /** The account these points were carried over to; undefined while they are a guest's. */
  owner?: string;
  /** The points that belong to accounts that have left this browser; only what is above them is the next account's to claim. */
  claimed: number;
};

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function load(storage: KeyValueStorage): SavedStats {
  const saved = (readJSON(storage, statsKey) ?? {}) as Partial<SavedStats>;
  const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
  return {
    points: isNumber(saved.points) ? saved.points : 0,
    solvedDays: Array.isArray(saved.solvedDays) ? saved.solvedDays.filter(isNumber) : [],
    best: Object.fromEntries(Object.entries(record(saved.best)).filter(([, value]) => isNumber(value))) as Record<string, number>,
    daily: record(saved.daily) as Record<string, DailyRecord>,
  };
}

const loadOwner = (storage: KeyValueStorage): string | undefined => {
  const owner = storage.getItem(statsOwnerKey);
  return owner === null || owner === "" ? undefined : owner;
};

const loadClaimed = (storage: KeyValueStorage): number => {
  const claimed = Number(storage.getItem(statsClaimedKey));
  return Number.isFinite(claimed) && claimed > 0 ? claimed : 0;
};

/**
 * The points, the streak, the best of each game and each day's daily puzzle (Games/GameStats.swift). `now` is the clock, which a debug build can set to a
 * Tehran day (`beytToday`).
 */
export class GameStats extends Store<State> {
  /** Told when a round of a solo game is over, with its points (for the server). */
  onRoundFinished?: (game: GameKind, points: number) => void;
  /** Told when a day's puzzle is over, solved or out of tries: the day, whether it was solved, the tries it took and its points. */
  onDailyFinished?: (day: TehranDay, solved: boolean, tries: number, points: number) => void;

  constructor(
    private readonly storage: RemovableStorage,
    private readonly now: () => Date = () => new Date(),
  ) {
    super({ saved: load(storage), today: TehranDay.of(now()), owner: loadOwner(storage), claimed: loadClaimed(storage) });
  }

  /** The Tehran day shown; `refreshToday` moves it at midnight. */
  get today(): TehranDay {
    return this.snapshot().today;
  }

  get points(): number {
    return this.snapshot().saved.points;
  }

  get owner(): string | undefined {
    return this.snapshot().owner;
  }

  /** The points a guest earned that no account has claimed: the current account's own, or the next one's. */
  get guestPoints(): number {
    const { saved, claimed } = this.snapshot();
    return Math.max(0, saved.points - claimed);
  }

  /** A person signs in: the points in this browser go to the first account that does, and stay that account's. Returns whether they are `userId`'s. */
  claim(userId: string): boolean {
    const { owner } = this.snapshot();
    if (owner === undefined) {
      this.storage.setItem(statsOwnerKey, userId);
      this.set({ ...this.snapshot(), owner: userId });
      return true;
    }
    return owner === userId;
  }

  /**
   * The account leaves this browser (signing out, deleting it): the points so far stay its own and are not offered to the next account, and its streak and
   * best scores go (they would be carried to the next account as its own); what is earned from now on is a guest's again and the next account may claim
   * it. The day records of the puzzle stay.
   */
  release(): void {
    const { saved } = this.snapshot();
    this.storage.removeItem(statsOwnerKey);
    this.storage.setItem(statsClaimedKey, String(saved.points));
    const next: SavedStats = { ...saved, solvedDays: [], best: {} };
    writeJSON(this.storage, statsKey, next);
    this.set({ ...this.snapshot(), saved: next, owner: undefined, claimed: saved.points });
  }

  /** What a guest carries over to an account (`PUT /v1/me/progress`, Account/ProgressCarryOver.swift): the points, the streak (its last day is today when today's puzzle is solved, else yesterday) and the best of every game played. */
  get carryOver(): { points: number; streakDays: number; streakLastDate: string | null; bestByGame: Record<string, number> } {
    const { saved, today } = this.snapshot();
    const streakDays = this.streak;
    const solvedToday = saved.daily[today.number]?.outcome === "solved";
    return {
      points: this.guestPoints,
      streakDays,
      streakLastDate: streakDays > 0 ? (solvedToday ? today : today.previous).key : null,
      bestByGame: Object.fromEntries(Object.entries(saved.best).filter(([, score]) => score > 0)),
    };
  }

  /** A round of a solo game is over: it is reported to the account, when there is one (`ScoreSync`). */
  finishRound(game: GameKind, points: number): void {
    this.onRoundFinished?.(game, points);
  }

  /** The days in a row the daily puzzle was solved, up to today. A day not played yet doesn't break it until the day is over. */
  get streak(): number {
    const { saved, today } = this.snapshot();
    const solved = new Set(saved.solvedDays);
    let day = solved.has(today.number) ? today : today.previous;
    let count = 0;
    while (solved.has(day.number)) {
      count++;
      day = day.previous;
    }
    return count;
  }

  best(game: GameKind): number {
    return this.snapshot().saved.best[game] ?? 0;
  }

  daily(day: TehranDay): DailyRecord | undefined {
    return this.snapshot().saved.daily[day.number];
  }

  /** The app came back: after Tehran midnight it is a new day. */
  refreshToday(): void {
    const current = TehranDay.of(this.now());
    if (!current.equals(this.today)) this.set({ ...this.snapshot(), today: current });
  }

  /** How long until the next Tehran midnight, for a timer that turns the day while the page stays open. */
  get secondsUntilNextDay(): number {
    return Math.max(0, (new TehranDay(this.today.number + 1).start.getTime() - this.now().getTime()) / 1000);
  }

  /** Keeps a day's puzzle. The moment it is first solved, its points are added and the day counts for the streak. */
  record(record: DailyRecord, day: TehranDay): void {
    const { saved } = this.snapshot();
    const before = saved.daily[day.number]?.outcome ?? "playing";
    const wasSolved = before === "solved";
    const next: SavedStats = { ...saved, daily: { ...saved.daily, [day.number]: record } };
    if (record.outcome === "solved" && !wasSolved) {
      next.points += record.points;
      if (!next.solvedDays.includes(day.number)) next.solvedDays = [...next.solvedDays, day.number];
      next.best = { ...next.best, daily: Math.max(next.best.daily ?? 0, record.points) };
    }
    this.keep(next);
    if (before === "playing" && record.outcome !== "playing") this.onDailyFinished?.(day, record.outcome === "solved", record.tries.length, record.points);
  }

  /** Points earned in a round, as they come. */
  award(points: number): void {
    if (points > 0) this.keep({ ...this.snapshot().saved, points: this.points + points });
  }

  raiseBest(game: GameKind, score: number): void {
    if (score > this.best(game)) this.keep({ ...this.snapshot().saved, best: { ...this.snapshot().saved.best, [game]: score } });
  }

  private keep(saved: SavedStats): void {
    writeJSON(this.storage, statsKey, saved);
    this.set({ ...this.snapshot(), saved });
  }
}
