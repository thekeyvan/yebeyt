import { readJSON, Store, writeJSON, type KeyValueStorage } from "../reader/store";
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

type State = { saved: SavedStats; today: TehranDay };

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

/**
 * The points, the streak, the best of each game and each day's daily puzzle (Games/GameStats.swift). `now` is the clock, which a debug build can set to a
 * Tehran day (`beytToday`).
 */
export class GameStats extends Store<State> {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => Date = () => new Date(),
  ) {
    super({ saved: load(storage), today: TehranDay.of(now()) });
  }

  /** The Tehran day shown; `refreshToday` moves it at midnight. */
  get today(): TehranDay {
    return this.snapshot().today;
  }

  get points(): number {
    return this.snapshot().saved.points;
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
    const wasSolved = saved.daily[day.number]?.outcome === "solved";
    const next: SavedStats = { ...saved, daily: { ...saved.daily, [day.number]: record } };
    if (record.outcome === "solved" && !wasSolved) {
      next.points += record.points;
      if (!next.solvedDays.includes(day.number)) next.solvedDays = [...next.solvedDays, day.number];
      next.best = { ...next.best, daily: Math.max(next.best.daily ?? 0, record.points) };
    }
    this.keep(next);
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
