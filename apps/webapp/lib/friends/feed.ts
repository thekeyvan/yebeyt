import type { Api } from "../account/api";
import { Store } from "../reader/store";
import type { BlockedPeople } from "./blockedPeople";
import type { Feed, FeedItem, ReactionCounts } from "./models";

export type FeedEntry = { id: string; item: FeedItem };

type State = { entries: readonly FeedEntry[]; counts: Readonly<Record<string, ReactionCounts>> };

const entryOf = (item: FeedItem): FeedEntry => ({ id: `${item.type}|${item.user.username}|${item.key ?? item.date ?? ""}|${item.at}`, item });

/** What a count shows when my own like or repost may have changed since the server counted: the server's count without mine, plus mine as it is now. */
export const shown = (count: number, serverMine: boolean, localMine: boolean): number => Math.max(0, count - (serverMine ? 1 : 0) + (localMine ? 1 : 0));

/** The server takes 50 keys at a time (a page has 30 items). */
const countsBatch = 50;

/** The home «دوستات» feed, newest first, a page at a time, with the counts of the couplets on each page (Friends/Feed/FeedModel.swift). */
export class FeedModel extends Store<State> {
  private nextCursor?: string;
  private isLoading = false;

  constructor(
    private readonly session: { readonly isSignedIn: boolean },
    private readonly api: Pick<Api, "feed" | "reactionCounts">,
  ) {
    super({ entries: [], counts: {} });
  }

  get hasMore(): boolean {
    return this.nextCursor !== undefined;
  }

  /** The first page again (the screen opened, the page came back). */
  async refresh(): Promise<void> {
    if (!this.session.isSignedIn) {
      this.set({ ...this.snapshot(), entries: [] });
      this.nextCursor = undefined;
      return;
    }
    const page = await this.fetch(undefined);
    if (!page) return;
    this.set({ ...this.snapshot(), entries: page.items.map(entryOf) });
    this.nextCursor = page.nextCursor ?? undefined;
    await this.loadCounts(page.items);
  }

  /** The next page. When everything on it is hidden (the people on it were blocked), the page after it is asked for too, so the list does not stop short of rows that are not on screen. */
  async loadMore(blocked: Pick<BlockedPeople, "visible">): Promise<void> {
    while (this.nextCursor !== undefined) {
      const page = await this.fetch(this.nextCursor);
      if (!page) return;
      const known = new Set(this.snapshot().entries.map((entry) => entry.id));
      const added = page.items.map(entryOf).filter((entry) => !known.has(entry.id));
      this.set({ ...this.snapshot(), entries: [...this.snapshot().entries, ...added] });
      this.nextCursor = page.nextCursor ?? undefined;
      await this.loadCounts(page.items);
      if (blocked.visible(added, (entry) => entry.item.user.username).length > 0) return;
    }
  }

  /** The counts of the couplets of a page, each key once. */
  private async loadCounts(items: readonly FeedItem[]): Promise<void> {
    const keys = [...new Set(items.flatMap((item) => item.key ?? []))];
    for (let start = 0; start < keys.length; start += countsBatch) {
      try {
        const found = await this.api.reactionCounts(keys.slice(start, start + countsBatch));
        this.set({ ...this.snapshot(), counts: { ...this.snapshot().counts, ...found } });
      } catch {
        // The cards show without counts.
      }
    }
  }

  /** One page; undefined when it failed (a failed refresh keeps what is shown) or one is already coming. */
  private async fetch(cursor: string | undefined): Promise<Feed | undefined> {
    if (this.isLoading) return undefined;
    this.isLoading = true;
    try {
      return await this.api.feed(cursor);
    } catch {
      return undefined;
    } finally {
      this.isLoading = false;
    }
  }
}
