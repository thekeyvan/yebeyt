import { Store } from "../reader/store";
import type { Api, RemoteStats } from "./api";
import type { SessionLike } from "./session";
import type { GameStats } from "../games/stats";

/**
 * The points and the streak shown on the بازی tab: for a signed-in person the server's (`/v1/me/stats`) once it has answered, but never less than this
 * browser's own (points from before the account, rounds not sent yet) when those are this account's: points carried over to another account are not
 * counted for this one (Games/MyStats.swift).
 */
export class MyStats extends Store<{ remote?: RemoteStats }> {
  constructor(
    private readonly local: GameStats,
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "stats">,
  ) {
    super({});
  }

  /** The points in this browser are the signed-in account's own (or nobody's yet). */
  private get localIsMine(): boolean {
    const { owner } = this.local;
    return owner === undefined || owner === this.session.user?.id;
  }

  get points(): number {
    if (!this.session.isSignedIn) return this.local.points;
    return Math.max(this.snapshot().remote?.totalPoints ?? 0, this.localIsMine ? this.local.guestPoints : 0);
  }

  get streak(): number {
    if (!this.session.isSignedIn) return this.local.streak;
    return Math.max(this.snapshot().remote?.streakDays ?? 0, this.localIsMine ? this.local.streak : 0);
  }

  /** Asks the server again; a failure keeps what is shown. */
  async refresh(): Promise<void> {
    if (!this.session.isSignedIn) {
      if (this.snapshot().remote) this.set({});
      return;
    }
    try {
      this.set({ remote: await this.api.stats() });
    } catch {
      // What is shown stays.
    }
  }
}
