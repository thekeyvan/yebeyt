import { messageOf, type Api } from "../account/api";
import { Store } from "../reader/store";
import type { BlockedPeople } from "./blockedPeople";
import { loaded, loading, type FoundPerson, type Phase, type PersonShort } from "./models";

type State = { people: readonly FoundPerson[]; phase: Phase };

const asFriends = (items: readonly (PersonShort & { canPlay?: boolean })[]): FoundPerson[] =>
  items.map(({ username, displayName, avatar, canPlay = true }) => ({ username, displayName, avatar, canPlay, friendship: "friends", isFriend: true }));

/** My friends (`/v1/me/friends`), a page at a time (Friends/People.swift `FriendsListModel`). */
export class FriendsListModel extends Store<State> {
  private nextCursor?: string;
  private isLoadingMore = false;

  constructor(private readonly api: Pick<Api, "friends">) {
    super({ people: [], phase: loading });
  }

  get hasMore(): boolean {
    return this.nextCursor !== undefined;
  }

  async load(): Promise<void> {
    if (this.snapshot().people.length === 0) await this.fetch(undefined);
  }

  /** The next page; when everything on it is hidden (blocked), the one after it is asked for too. */
  async loadMore(blocked: Pick<BlockedPeople, "visible">): Promise<void> {
    if (this.isLoadingMore) return;
    this.isLoadingMore = true;
    try {
      while (this.nextCursor !== undefined) {
        const cursor = this.nextCursor;
        const before = this.snapshot().people.length;
        await this.fetch(cursor);
        if (this.nextCursor === cursor) return; // it failed
        if (blocked.visible(this.snapshot().people.slice(before), (person) => person.username).length > 0) return;
      }
    } finally {
      this.isLoadingMore = false;
    }
  }

  /** My friends changed (an accept, a removal): the first page is read again and replaces the list. */
  async reload(): Promise<void> {
    if (this.snapshot().phase.kind !== "loaded") return;
    try {
      const page = await this.api.friends();
      this.set({ ...this.snapshot(), people: asFriends(page.items) });
      this.nextCursor = page.nextCursor ?? undefined;
    } catch {
      // What is shown stays.
    }
  }

  private async fetch(cursor: string | undefined): Promise<void> {
    try {
      const page = await this.api.friends(cursor);
      const known = new Set(this.snapshot().people.map((person) => person.username));
      this.set({ people: [...this.snapshot().people, ...asFriends(page.items.filter((person) => !known.has(person.username)))], phase: loaded });
      this.nextCursor = page.nextCursor ?? undefined;
    } catch (error) {
      if (cursor === undefined) this.set({ ...this.snapshot(), phase: { kind: "failed", message: messageOf(error) } });
    }
  }
}
