import { messageOf, type Api } from "../account/api";
import { Store } from "../reader/store";
import type { FriendsStandings, GlobalStandings, LeagueStandings, Phase } from "./models";

export type BoardTab = "league" | "friends" | "global";

/** The tabs in order, with their names (Friends/Leaderboard/LeaderboardModel.swift). */
export const boardTabs: readonly { value: BoardTab; label: string }[] = [
  { value: "league", label: "لیگ این هفته" },
  { value: "friends", label: "دوستا" },
  { value: "global", label: "همه" },
];

type State = { tab: BoardTab; league?: LeagueStandings; friends?: FriendsStandings; global?: GlobalStandings; phases: Readonly<Partial<Record<BoardTab, Phase>>> };

/** رده‌بندی: the three boards, each fetched when its tab is first opened. */
export class LeaderboardModel extends Store<State> {
  private globalCursor?: string;
  private isLoadingMore = false;

  constructor(
    private readonly api: Pick<Api, "leagueStandings" | "friendsStandings" | "globalStandings">,
    tab: BoardTab = "league",
  ) {
    super({ tab, phases: {} });
  }

  phaseOf(tab: BoardTab): Phase {
    return this.snapshot().phases[tab] ?? { kind: "loading" };
  }

  setTab(tab: BoardTab): void {
    this.set({ ...this.snapshot(), tab });
  }

  get hasMoreGlobal(): boolean {
    return this.globalCursor !== undefined;
  }

  /** Loads the tab on screen, once; `force` loads it again (coming back). */
  async load(force = false): Promise<void> {
    const { tab, phases } = this.snapshot();
    if (!force && phases[tab]?.kind === "loaded") return;
    try {
      if (tab === "league") this.set({ ...this.snapshot(), league: await this.api.leagueStandings() });
      else if (tab === "friends") this.set({ ...this.snapshot(), friends: await this.api.friendsStandings() });
      else {
        const page = await this.api.globalStandings();
        this.set({ ...this.snapshot(), global: page });
        this.globalCursor = page.nextCursor ?? undefined;
      }
      this.setPhase(tab, { kind: "loaded" });
    } catch (error) {
      if (this.snapshot().phases[tab]?.kind !== "loaded") this.setPhase(tab, { kind: "failed", message: messageOf(error) });
    }
  }

  /** The next 50 of the global list. */
  async loadMoreGlobal(): Promise<void> {
    const current = this.snapshot().global;
    if (this.globalCursor === undefined || this.isLoadingMore || !current) return;
    this.isLoadingMore = true;
    try {
      const page = await this.api.globalStandings(this.globalCursor);
      const ranks = new Set(current.rows.map((row) => row.rank));
      this.set({ ...this.snapshot(), global: { ...current, rows: [...current.rows, ...page.rows.filter((row) => !ranks.has(row.rank))], nextCursor: page.nextCursor } });
      this.globalCursor = page.nextCursor ?? undefined;
    } catch {
      // The list stays as it is.
    } finally {
      this.isLoadingMore = false;
    }
  }

  private setPhase(tab: BoardTab, phase: Phase): void {
    this.set({ ...this.snapshot(), phases: { ...this.snapshot().phases, [tab]: phase } });
  }
}
