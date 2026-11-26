import type { GameKind } from "../games/kinds";
import { readJSON, writeJSON, type KeyValueStorage } from "../reader/store";

/** Where the counters are kept in localStorage: the phone's own name and JSON. */
export const achievementsKey = "me.achievements";

type Saved = { hafezRight: number; bookWins: number };

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/**
 * Counters the browser keeps for badges and avatar items, outside the games: right answers on Hafez couplets and wins in «از کدوم کتاب؟» (a round with
 * at least 7 right of 10). The games tell it through `GameStats`'s hooks (Me/Profile/Achievements.swift).
 */
export class Achievements {
  private saved: Saved;

  constructor(private readonly storage: KeyValueStorage) {
    const found = readJSON(storage, achievementsKey) as Partial<Saved> | undefined;
    this.saved = { hafezRight: count(found?.hafezRight), bookWins: count(found?.bookWins) };
  }

  get hafezRight(): number {
    return this.saved.hafezRight;
  }

  get bookWins(): number {
    return this.saved.bookWins;
  }

  /** A right answer in a quiz game, on a couplet of this poet. */
  recordRight(poetSlug: string): void {
    if (poetSlug !== "hafez") return;
    this.saved = { ...this.saved, hafezRight: this.saved.hafezRight + 1 };
    this.save();
  }

  /** A finished quiz round: in «از کدوم کتاب؟» at least 7 right of 10 (the same share for any other length) is a win. */
  recordRound(game: GameKind, right: number, total: number): void {
    if (game !== "book" || total <= 0 || right * 10 < total * 7) return;
    this.saved = { ...this.saved, bookWins: this.saved.bookWins + 1 };
    this.save();
  }

  private save(): void {
    writeJSON(this.storage, achievementsKey, this.saved);
  }
}
