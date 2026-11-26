import { ApiError, type Api, type ReactionKind } from "./api";
import type { SessionLike } from "./session";
import type { ReaderMarks } from "../reader/marks";
import type { RemovableStorage } from "../reader/store";
import { StoredList } from "./storedList";

/** One change waiting to go: the last state of a couplet and kind, and the account it was made for (undefined: not known, the next sync takes it). */
export type Change = { key: string; kind: ReactionKind; on: boolean; userId?: string };

export const unsentKey = "reader.reactions.unsent";
export const ownerKey = "reader.reactions.owner";
export const pulledKey = "reader.reactions.pulled";

const kinds: readonly ReactionKind[] = ["like", "repost"];

const sameChange = (a: Change, b: Change): boolean => a.key === b.key && a.kind === b.kind && a.on === b.on && a.userId === b.userId;

/**
 * Keeps پسند and بازنشر here and on the server the same, for a signed-in person (Reader/ReactionsSync.swift). A change is sent at once; what could not be
 * sent (no network, a server error) stays here as «unsent», one entry per couplet and kind with the last state, and goes on the next sync. A sync (when
 * someone signs in, when the page comes to the front, when signing out) sends what is unsent and then pulls the server's list: the server's wins, except
 * for couplets still unsent. A guest's changes are not kept. Each change knows whose it is: one of another account is dropped. The first pull for an
 * account sends the likes here that the server lacks only when they were made while signed in as that same account; otherwise the server's list replaces
 * them (they may be another person's).
 */
export class ReactionsSync {
  /** The queue lives in storage only, so that tabs of this browser share it. */
  private readonly list: StoredList<Change>;
  private running?: Promise<void>;

  constructor(
    private readonly marks: ReaderMarks,
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "setReaction" | "myReactions">,
    private readonly storage: RemovableStorage,
  ) {
    this.list = new StoredList(storage, unsentKey);
    marks.onReactionChange = (key, kind, on) => this.record(key, kind, on);
  }

  get unsent(): readonly Change[] {
    return this.list.items;
  }

  get hasUnsent(): boolean {
    return this.list.items.length > 0;
  }

  /** The account that last liked or reposted something in this browser while signed in. */
  private get owner(): string | undefined {
    return this.storage.getItem(ownerKey) ?? undefined;
  }

  /** The account the server's list was last pulled for. */
  private get pulledFor(): string | undefined {
    return this.storage.getItem(pulledKey) ?? undefined;
  }

  /** Sends what is unsent, then reads the server's reactions and merges them. Returns whether it all went through (true too when there is no account to sync). */
  async syncNow(): Promise<boolean> {
    if (!this.session.isSignedIn) return true;
    await this.flush();
    const pulled = await this.pull();
    return pulled && !this.hasUnsent;
  }

  /** Sends what is unsent, oldest first; a failure stops there. A call while one is running waits for it. */
  flush(): Promise<void> {
    if (!this.session.isSignedIn) return Promise.resolve();
    if (this.running) return this.running;
    const task = this.send().finally(() => {
      if (this.running === task) this.running = undefined;
    });
    this.running = task;
    return task;
  }

  /** Waits for a send that is running, so nothing lands after the reactions are cleared. */
  async stop(): Promise<void> {
    await this.running;
  }

  /** Forgets what is unsent (the account is gone from this browser). */
  clear(): void {
    for (const key of [unsentKey, ownerKey, pulledKey]) this.storage.removeItem(key);
  }

  private async send(): Promise<void> {
    if (!this.session.user) await this.session.restore();
    const me = this.session.user?.id;
    if (!me) return; // who is signed in is not known (no network): try later
    this.list.items = this.list.items.filter((change) => change.userId === undefined || change.userId === me);
    for (let change = this.list.items[0]; change; change = this.list.items[0]) {
      try {
        await this.api.setReaction(change.kind, change.key, change.on);
      } catch (error) {
        if (!(error instanceof ApiError && error.isFinal)) break; // a refusal the server will never change is dropped; anything else waits
      }
      this.list.items = this.list.items.filter((other) => !sameChange(other, change!)); // read again: another tab may have added to it meanwhile
    }
  }

  private record(key: string, kind: ReactionKind, on: boolean): void {
    if (!this.session.isSignedIn) return;
    const userId = this.session.user?.id;
    if (userId) this.storage.setItem(ownerKey, userId);
    this.list.items = [...this.list.items.filter((change) => !(change.key === key && change.kind === kind)), { key, kind, on, ...(userId ? { userId } : {}) }];
    void this.flush();
  }

  private async pull(): Promise<boolean> {
    const items: { key: string; kind: ReactionKind }[] = [];
    let cursor: string | undefined;
    try {
      do {
        const page = await this.api.myReactions(cursor);
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
    } catch {
      return false;
    }
    const me = this.session.user?.id;
    if (!this.session.isSignedIn || !me) return false;
    const sendOwn = this.pulledFor !== me && this.owner === me;
    for (const kind of kinds) {
      const mark = kind === "like" ? "liked" : "reposted";
      const server = new Set(items.filter((item) => item.kind === kind).map((item) => item.key));
      const waiting = () => new Set(this.list.items.filter((change) => change.kind === kind).map((change) => change.key));
      if (sendOwn) {
        const own = [...this.marks.keys(mark)].filter((key) => !server.has(key) && !waiting().has(key)).sort();
        this.list.items = [...this.list.items, ...own.map((key): Change => ({ key, kind, on: true, userId: me }))];
      }
      this.marks.applyServer(server, mark, waiting());
    }
    this.storage.setItem(pulledKey, me);
    if (sendOwn && this.hasUnsent) await this.flush();
    return true;
  }
}
