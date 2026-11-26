import { ApiError, type Api, type ReactionKind } from "./api";
import type { SessionLike } from "./session";
import type { ReaderMarks } from "../reader/marks";
import { readJSON, writeJSON, type RemovableStorage } from "../reader/store";

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
  private changes: Change[];
  private running?: Promise<void>;
  /** The account that last liked or reposted something here while signed in. */
  private owner: string | undefined;
  /** The account the server's list was last pulled for. */
  private pulledFor: string | undefined;

  constructor(
    private readonly marks: ReaderMarks,
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "setReaction" | "myReactions">,
    private readonly storage: RemovableStorage,
  ) {
    const saved = readJSON(storage, unsentKey);
    this.changes = Array.isArray(saved) ? (saved as Change[]) : [];
    this.owner = storage.getItem(ownerKey) ?? undefined;
    this.pulledFor = storage.getItem(pulledKey) ?? undefined;
    marks.onReactionChange = (key, kind, on) => this.record(key, kind, on);
  }

  get unsent(): readonly Change[] {
    return this.changes;
  }

  get hasUnsent(): boolean {
    return this.changes.length > 0;
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
    this.changes = [];
    this.owner = undefined;
    this.pulledFor = undefined;
    for (const key of [unsentKey, ownerKey, pulledKey]) this.storage.removeItem(key);
  }

  private async send(): Promise<void> {
    if (!this.session.user) await this.session.restore();
    const me = this.session.user?.id;
    if (!me) return; // who is signed in is not known (no network): try later
    this.changes = this.changes.filter((change) => change.userId === undefined || change.userId === me);
    this.save();
    for (let change = this.changes[0]; change; change = this.changes[0]) {
      try {
        await this.api.setReaction(change.kind, change.key, change.on);
      } catch (error) {
        if (!(error instanceof ApiError && error.isFinal)) break; // a refusal the server will never change is dropped; anything else waits
      }
      this.changes = this.changes.filter((other) => !sameChange(other, change!));
      this.save();
    }
  }

  private record(key: string, kind: ReactionKind, on: boolean): void {
    if (!this.session.isSignedIn) return;
    const userId = this.session.user?.id;
    if (userId) {
      this.owner = userId;
      this.storage.setItem(ownerKey, userId);
    }
    this.changes = [...this.changes.filter((change) => !(change.key === key && change.kind === kind)), { key, kind, on, ...(userId ? { userId } : {}) }];
    this.save();
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
      const waiting = () => new Set(this.changes.filter((change) => change.kind === kind).map((change) => change.key));
      if (sendOwn) {
        for (const key of [...this.marks.keys(mark)].filter((key) => !server.has(key) && !waiting().has(key)).sort()) this.changes.push({ key, kind, on: true, userId: me });
      }
      this.marks.applyServer(server, mark, waiting());
    }
    this.pulledFor = me;
    this.storage.setItem(pulledKey, me);
    this.save();
    if (sendOwn && this.hasUnsent) await this.flush();
    return true;
  }

  private save(): void {
    writeJSON(this.storage, unsentKey, this.changes);
  }
}
