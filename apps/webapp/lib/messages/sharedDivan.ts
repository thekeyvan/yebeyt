import { ApiError, type Api } from "../account/api";
import { loaded, loading, type Phase } from "../friends/models";
import { persianDigits } from "../persian";
import { Store } from "../reader/store";
import { limited, messageToast, parseCoupletKey } from "./copy";
import { maxNoteLength } from "./chat";
import type { LiveEvent } from "./liveEvents";
import type { Author, SharedDivan, SharedDivanCounts, SharedDivanItem } from "./models";

/** The chips: everything, what the other person added, what I added, or one poet's couplets. */
export type DivanFilter = "all" | "them" | "me" | `poet:${string}`;

/** What the server is asked for; a poet is chosen among the couplets of everyone. */
export const authorOf = (filter: DivanFilter): Author => (filter === "them" || filter === "me" ? filter : "all");

export const poetOfKey = (key: string): string | undefined => parseCoupletKey(key)?.path.split("/")[1];

type State = {
  divan?: SharedDivan;
  items: readonly SharedDivanItem[];
  counts?: SharedDivanCounts;
  filter: DivanFilter;
  phase: Phase;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** The poets of the couplets seen so far, the most frequent first; the poet chips. */
  poetSlugs: readonly string[];
  toast?: { line: string; serial: number };
};

type DivanApi = Pick<Api, "sharedDivans" | "openSharedDivan" | "sharedDivanItems" | "addSharedDivanItem" | "removeSharedDivanItem" | "setSharedDivanLike">;

/** The divan two friends share: its couplets (newest first), the counts, the filter chips and the likes (Messages/SharedDivanModel.swift). */
export class SharedDivanModel extends Store<State> {
  private cursor?: string;
  private loadedAuthor: Author = "all";
  private toasts = 0;
  /** The couplets taken out, by me or live: an event about one again (mine comes to me too) has nothing left to do. */
  private readonly taken = new Set<string>();
  /** The screen is showing: a reconnect reads it again. */
  isVisible = false;

  constructor(
    readonly username: string,
    private readonly api: DivanApi,
  ) {
    super({ items: [], filter: "all", phase: loading, isLoadingMore: false, hasMore: false, poetSlugs: [] });
  }

  /** What the list shows: the loaded couplets, only one poet's when a poet chip is on. */
  get visibleItems(): readonly SharedDivanItem[] {
    const { items, filter } = this.snapshot();
    return filter.startsWith("poet:") ? items.filter((item) => poetOfKey(item.key) === filter.slice(5)) : items;
  }

  /** «۲۴ بیت · سارا ۱۳، تو ۱۱» */
  subtitle(name: string): string | undefined {
    const { counts } = this.snapshot();
    return counts && `${persianDigits(counts.total)} بیت · ${name} ${persianDigits(counts.theirs)}، تو ${persianDigits(counts.mine)}`;
  }

  // MARK: Loading

  /** Finds the divan with this person (made when there is none, which only friends can) and reads its couplets. */
  async load(): Promise<void> {
    if (this.snapshot().items.length === 0) this.update({ phase: loading });
    try {
      const divan = this.snapshot().divan ?? (await this.findOrOpen());
      this.update({ divan });
      await this.readItems(divan.id, undefined, true);
      this.update({ phase: loaded });
    } catch (error) {
      if (this.snapshot().items.length === 0) this.update({ phase: { kind: "failed", message: messageToast(error, true) } });
    }
  }

  async loadMore(): Promise<void> {
    const { divan, isLoadingMore } = this.snapshot();
    const cursor = this.cursor;
    if (!divan || cursor === undefined || isLoadingMore) return;
    this.update({ isLoadingMore: true });
    try {
      await this.readItems(divan.id, cursor, false);
    } catch {
      // The end of the list asks again.
    } finally {
      this.update({ isLoadingMore: false });
    }
  }

  async select(filter: DivanFilter): Promise<void> {
    if (filter === this.snapshot().filter) return;
    this.update({ filter });
    if (authorOf(filter) !== this.loadedAuthor) await this.load();
  }

  private async findOrOpen(): Promise<SharedDivan> {
    let next: string | undefined;
    do {
      const page = await this.api.sharedDivans(next);
      const found = page.items.find((divan) => divan.other.username === this.username);
      if (found) return found;
      next = page.nextCursor ?? undefined;
    } while (next !== undefined);
    return this.api.openSharedDivan(this.username);
  }

  private async readItems(id: string, start: string | undefined, reset: boolean): Promise<void> {
    const author = authorOf(this.snapshot().filter);
    const page = await this.api.sharedDivanItems(id, author, start);
    const items = reset ? page.items : [...this.snapshot().items, ...page.items.filter((item) => !this.snapshot().items.some((known) => known.id === item.id))];
    if (reset) this.loadedAuthor = author;
    this.cursor = page.nextCursor ?? undefined;
    this.update({ items, counts: page.counts, hasMore: this.cursor !== undefined, ...(author === "all" ? { poetSlugs: poetsOf(items) } : {}) });
  }

  // MARK: Likes

  /** Takes my like on or off at once; the server's answer replaces the item, and a failure puts it back. */
  async toggleLike(item: SharedDivanItem): Promise<void> {
    const { divan, items } = this.snapshot();
    const index = items.findIndex((one) => one.id === item.id);
    if (!divan || index < 0) return;
    const liked = !items[index]!.likedByMe;
    this.replace(item.id, (one) => ({ ...one, likedByMe: liked }));
    try {
      const answer = await this.api.setSharedDivanLike(divan.id, item.id, liked);
      this.replace(item.id, () => answer);
    } catch (error) {
      this.replace(item.id, (one) => ({ ...one, likedByMe: !liked }));
      this.showToast(messageToast(error));
    }
  }

  private replace(id: string, change: (item: SharedDivanItem) => SharedDivanItem): void {
    this.update({ items: this.snapshot().items.map((item) => (item.id === id ? change(item) : item)) });
  }

  // MARK: Removing

  /**
   * «بردار»: a couplet I added goes out of the list at once; the server is asked, and a failure puts it back in its place (newest first) with the toast. A
   * couplet the other person added is never removed.
   */
  async remove(item: SharedDivanItem): Promise<void> {
    const { divan, items } = this.snapshot();
    const index = items.findIndex((one) => one.id === item.id);
    if (!divan || !item.addedByMe || index < 0) return;
    const removed = items[index]!;
    this.dropFromList(removed);
    this.taken.add(item.id);
    try {
      await this.api.removeSharedDivanItem(divan.id, item.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return; // already gone from the server: it stays out of the list
      this.taken.delete(item.id);
      const now = this.snapshot().items;
      if (!now.some((one) => one.id === removed.id)) {
        // Newest first: its place is by its date, since the list may have changed while the server was asked.
        const at = now.findIndex((one) => Date.parse(one.createdAt) < Date.parse(removed.createdAt));
        this.update({ items: now.toSpliced(at < 0 ? now.length : at, 0, removed) });
        this.adjustCounts(removed, 1);
        this.notePoets();
      }
      this.showToast(messageToast(error));
      await this.load(); // the counts come from the server, not from what they were
    }
  }

  private dropFromList(gone: SharedDivanItem): void {
    this.update({ items: this.snapshot().items.filter((one) => one.id !== gone.id) });
    this.adjustCounts(gone, -1);
    this.notePoets();
  }

  private adjustCounts(item: SharedDivanItem, delta: number): void {
    const { counts } = this.snapshot();
    if (counts) this.update({ counts: { total: counts.total + delta, mine: counts.mine + (item.addedByMe ? delta : 0), theirs: counts.theirs + (item.addedByMe ? 0 : delta) } });
  }

  private notePoets(): void {
    if (authorOf(this.snapshot().filter) === "all") this.update({ poetSlugs: poetsOf(this.snapshot().items) });
  }

  // MARK: Adding

  /** «+»: a couplet goes into this divan. */
  async add(key: string, note?: string): Promise<void> {
    const { divan } = this.snapshot();
    if (!divan) return;
    const trimmed = note?.trim();
    try {
      await this.api.addSharedDivanItem(divan.id, key, trimmed ? limited(trimmed, maxNoteLength) : undefined);
      // The answer doesn't say whether it was new (a couplet already there is a 200 and changes nothing), and the live event of my own add may come
      // too: the list and the counts are read again, never counted by hand.
      await this.load();
    } catch (error) {
      this.showToast(messageToast(error, true));
    }
  }

  // MARK: Live

  /** A couplet the other person added arrives at the top (when the chips would show it) and the counts move; a couplet taken out leaves the list and the counts move. */
  apply(event: LiveEvent): void {
    const { divan, items, filter } = this.snapshot();
    if (event.type === "divan.removed") return this.applyRemoval(event.itemId, event.sharedDivanId);
    if (event.type !== "divan" || event.sharedDivanId !== divan?.id || items.some((one) => one.id === event.item.id)) return;
    this.adjustCounts(event.item, 1);
    const author = authorOf(filter);
    if (author !== "all" && (author === "me") !== event.item.addedByMe) return;
    this.update({ items: [event.item, ...items] });
    this.notePoets();
  }

  /** A couplet leaves the list and the counts move; when the list doesn't hold it (a chip hides it, or it is further down) the list is read again for the counts when the screen is showing. */
  private applyRemoval(itemId: string, divanId: string): void {
    if (divanId !== this.snapshot().divan?.id || this.taken.has(itemId)) return;
    this.taken.add(itemId);
    const gone = this.snapshot().items.find((one) => one.id === itemId);
    if (!gone) {
      if (this.isVisible) void this.load(); // away, nothing is read: the screen reads the list when it shows
      return;
    }
    this.dropFromList(gone);
  }

  showToast(line: string): void {
    this.toasts += 1;
    this.update({ toast: { line, serial: this.toasts } });
  }

  clearToast(): void {
    this.update({ toast: undefined });
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}

/** The poets of the couplets, the most frequent first (a tie keeps the newest first). */
function poetsOf(items: readonly SharedDivanItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const slug = poetOfKey(item.key);
    if (slug !== undefined) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.keys()].map((slug, order) => ({ slug, order })).sort((a, b) => counts.get(b.slug)! - counts.get(a.slug)! || a.order - b.order).map(({ slug }) => slug);
}
