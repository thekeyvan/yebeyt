import type { Api } from "./api";
import type { SessionLike } from "./session";
import { merged, type DivanItem } from "../reader/divan";
import type { ReaderMarks } from "../reader/marks";

/** The most items the server takes in one request. */
export const batchSize = 2000;

const same = (a: DivanItem | undefined, b: DivanItem): boolean => a !== undefined && a.keptAt === b.keptAt && a.removedAt === b.removedAt;

/**
 * Keeps the divan here and on the server the same, for a signed-in person (Me/Divan/DivanSync.swift): the server's divan is read and merged into this
 * browser's (the last change per couplet wins, as the server does it), and what the server lacks or has older goes up in batches of at most 2000. It runs
 * when someone signs in, when the page comes to the front, and two seconds after the last keep or un-keep. A guest's divan stays here. A failed run is
 * not shown; the next one tries again.
 */
export class DivanSync {
  private scheduled?: ReturnType<typeof setTimeout>;
  private running?: Promise<boolean>;
  private runAgain = false;

  constructor(
    private readonly marks: ReaderMarks,
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "divan" | "putDivan">,
    private readonly debounceMs = 2000,
  ) {
    marks.onKeptChange = () => this.scheduleSync();
  }

  /** Cancels a waiting sync and waits for the one running, so nothing lands after the divan is cleared. */
  async stop(): Promise<void> {
    clearTimeout(this.scheduled);
    this.scheduled = undefined;
    await this.running;
  }

  /** Runs a sync after the debounce; asking again meanwhile starts the wait over. */
  scheduleSync(): void {
    if (!this.session.isSignedIn) return;
    clearTimeout(this.scheduled);
    this.scheduled = setTimeout(() => void this.syncNow(), this.debounceMs);
  }

  /** Pull, merge, push. A call while one is running makes it go around once more, and waits for it to end. Returns whether the last round went through (true too when there is no account to sync). */
  syncNow(): Promise<boolean> {
    if (!this.session.isSignedIn) return Promise.resolve(true);
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    const task = (async () => {
      let succeeded = true;
      do {
        this.runAgain = false;
        try {
          await this.runOnce();
          succeeded = true;
        } catch {
          succeeded = false;
        }
      } while (this.runAgain);
      return succeeded;
    })().finally(() => {
      if (this.running === task) this.running = undefined;
    });
    this.running = task;
    return task;
  }

  private async runOnce(): Promise<void> {
    const server = await this.api.divan();
    this.marks.applyDivan(server);
    const known = new Map<string, DivanItem>();
    for (const item of server) known.set(item.key, known.has(item.key) ? merged(known.get(item.key)!, item) : item);
    const missing = this.marks.divanItems().filter((item) => !same(known.get(item.key), item));
    for (let start = 0; start < missing.length; start += batchSize) this.marks.applyDivan(await this.api.putDivan(missing.slice(start, start + batchSize)));
  }
}
