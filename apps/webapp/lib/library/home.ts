import type { Couplet } from "../poetry/models";
import { Store, readJSON, writeJSON, type KeyValueStorage } from "../reader/store";
import { candidates as candidatesOf, pick as pickOf, preferring, type Candidate } from "./dailyPick";
import type { IndexedPoem } from "./bookIndex";

/** Today's couplet, ready to show. */
export type Pick = { path: string; index: number; couplet: Couplet; poet: string; /** «غزل ۳» */ title: string };

export const pickId = ({ path, index }: Pick): string => `${path}#${index}`;

/** Where the couplets come from: the popular poems of the bundled books, and a candidate as a couplet with its poet and title. */
export type HomeSource = {
  poems(): Promise<IndexedPoem[]>;
  pick(candidate: Candidate): Promise<Pick | undefined>;
};

export type HomeState = { day: number; rejected: number; pick?: Pick };

/** The toast after «رد کن» (it comes with «برگردون»). */
export const rejectedLine = "امروز دیگه نشونت نمی‌دیم";

/** Where the «رد کن» count of the day is kept: `[day, count]`, as the phone keeps it. The taste of onboarding is a list of poet slugs. */
export const rejectedKey = "home.rejected";
export const tastePoetsKey = "taste.poets";

function savedRejects(storage: KeyValueStorage, day: number): number {
  const saved = readJSON(storage, rejectedKey);
  return Array.isArray(saved) && saved.length === 2 && saved[0] === day && typeof saved[1] === "number" ? saved[1] : 0;
}

/**
 * «بیتِ امروز»: today's couplet and the «رد کن» count of the day (kept, so the same couplet is shown after leaving the page; a new day
 * starts again from its own first couplet) (Home/HomeModel.swift).
 */
export class HomeModel extends Store<HomeState> {
  private candidates: Candidate[] = [];

  constructor(
    day: number,
    private readonly storage: KeyValueStorage,
    private readonly source: HomeSource,
  ) {
    super({ day, rejected: savedRejects(storage, day) });
  }

  async load(): Promise<void> {
    if (this.snapshot().pick) return;
    const taste = readJSON(this.storage, tastePoetsKey);
    const poets = new Set(Array.isArray(taste) ? taste.filter((slug): slug is string => typeof slug === "string") : []);
    this.candidates = candidatesOf(preferring(poets, await this.source.poems()));
    await this.show();
  }

  /** The page came back on `today`: after midnight it is a new day with its own couplet and no rejects. */
  async refresh(today: number): Promise<void> {
    const now = this.snapshot();
    if (today === now.day) return;
    const fresh = { day: today, rejected: savedRejects(this.storage, today) };
    this.set(this.candidates.length === 0 ? fresh : { ...now, ...fresh });
    await (this.candidates.length === 0 ? this.load() : this.show());
  }

  /** «برگردون»: the couplet rejected on `rejectedDay` is shown again. Nothing happens on another day or with nothing rejected. */
  async undoReject(rejectedDay: number): Promise<void> {
    const { day, rejected } = this.snapshot();
    if (rejectedDay !== day || rejected <= 0) return;
    await this.setRejected(day, rejected - 1);
  }

  /** «رد کن»: the next candidate for today. */
  async reject(): Promise<void> {
    const { day, rejected, pick } = this.snapshot();
    if (pick) await this.setRejected(day, rejected + 1);
  }

  private async setRejected(day: number, rejected: number): Promise<void> {
    writeJSON(this.storage, rejectedKey, [day, rejected]);
    this.set({ ...this.snapshot(), rejected });
    await this.show();
  }

  private async show(): Promise<void> {
    const { day, rejected } = this.snapshot();
    const candidate = pickOf(day, rejected, this.candidates);
    const pick = candidate && (await this.source.pick(candidate));
    const now = this.snapshot();
    // Another «رد کن» or a new day came while the poem was loading: that one shows its own couplet.
    if (pick && now.day === day && now.rejected === rejected) this.set({ ...now, pick });
  }
}
