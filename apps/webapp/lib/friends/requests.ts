import { messageOf } from "../account/api";
import { Store } from "../reader/store";
import type { FriendRequestDirection } from "./api";
import { friendToast, type FriendAction } from "./friendship";
import { loaded, loading, type FriendRequest, type Phase, type PersonShort } from "./models";

type State = {
  incoming: readonly FriendRequest[];
  outgoing: readonly FriendRequest[];
  phase: Phase;
  /** The server's count until the list is read, then the list's. */
  incomingCount: number;
  /** The people whose answer is on its way: a second tap waits. */
  pending: ReadonlySet<string>;
};

type Source = {
  friendRequests(direction: FriendRequestDirection, cursor?: string): Promise<{ items: FriendRequest[]; nextCursor: string | null }>;
  friendAction(action: FriendAction, username: string): Promise<unknown>;
};

/**
 * The requests I got and the ones I sent (Friends/FriendRequests.swift). The count of the incoming ones is the number on the messages row and in the tab
 * badge: the server's number until the list is read, then the list's.
 */
export class FriendRequestsModel extends Store<State> {
  /** The requests screen is showing: a reconnect of the live socket reads it again. */
  isVisible = false;

  constructor(private readonly api: Source) {
    super({ incoming: [], outgoing: [], phase: loading, incomingCount: 0, pending: new Set() });
  }

  /** The server's count of incoming requests (`/v1/me/unread`). */
  setCount(count: number): void {
    this.update({ incomingCount: count });
  }

  /** Both lists, every page. A failure keeps what is shown. */
  async load(): Promise<void> {
    const { incoming, outgoing, phase } = this.snapshot();
    if (incoming.length === 0 && outgoing.length === 0) this.update({ phase: loading });
    try {
      const received = await this.all("incoming");
      const sent = await this.all("outgoing");
      this.update({ incoming: received, outgoing: sent, incomingCount: received.length, phase: loaded });
    } catch (error) {
      if (phase.kind !== "loaded") this.update({ phase: { kind: "failed", message: messageOf(error) } });
    }
  }

  private async all(direction: FriendRequestDirection): Promise<FriendRequest[]> {
    const found: FriendRequest[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.api.friendRequests(direction, cursor);
      found.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return found;
  }

  /**
   * «قبول» and «رد» on a request I got, «لغو» on one I sent: the row goes at once and comes back where it was when the server refuses. Returns the line to
   * show when it failed.
   */
  async perform(action: FriendAction, username: string): Promise<string | undefined> {
    if (this.snapshot().pending.has(username) || action === "send" || action === "unfriend") return undefined;
    const wasIncoming = action === "accept" || action === "reject";
    const list = wasIncoming ? this.snapshot().incoming : this.snapshot().outgoing;
    const index = list.findIndex((request) => request.username === username);
    const row = list[index];
    if (!row) return undefined;
    this.setPending(username, true);
    this.remove(username, wasIncoming);
    try {
      await this.api.friendAction(action, username);
      return undefined;
    } catch (error) {
      this.restore(row, index, wasIncoming);
      return friendToast(error);
    } finally {
      this.setPending(username, false);
    }
  }

  private remove(username: string, incoming: boolean): void {
    const state = this.snapshot();
    if (incoming) this.update({ incoming: state.incoming.filter((request) => request.username !== username), incomingCount: state.incomingCount - 1 });
    else this.update({ outgoing: state.outgoing.filter((request) => request.username !== username) });
  }

  private restore(row: FriendRequest, index: number, incoming: boolean): void {
    const state = this.snapshot();
    const put = (list: readonly FriendRequest[]) => list.toSpliced(Math.min(index, list.length), 0, row);
    if (incoming) this.update({ incoming: put(state.incoming), incomingCount: state.incomingCount + 1 });
    else this.update({ outgoing: put(state.outgoing) });
  }

  private setPending(username: string, on: boolean): void {
    const pending = new Set(this.snapshot().pending);
    if (on) pending.add(username);
    else pending.delete(username);
    this.update({ pending });
  }

  /** Live `friend.request`: a new row on top (the same request twice changes nothing). */
  received(person: PersonShort, now: Date = new Date()): void {
    const { incoming, incomingCount } = this.snapshot();
    if (incoming.some((request) => request.username === person.username)) return;
    this.update({ incoming: [{ ...person, createdAt: now.toISOString() }, ...incoming], incomingCount: incomingCount + 1 });
  }

  /** I answered (or answered by asking back) the request of `username` somewhere other than this screen: the row goes, or, when the list was not read, the count is one less. */
  answered(username: string): void {
    const { incoming, incomingCount } = this.snapshot();
    this.update({ incoming: incoming.filter((request) => request.username !== username), incomingCount: Math.max(incomingCount - 1, 0) });
  }

  /** I blocked `username`: no request of theirs or mine stays in the lists. */
  removeAll(username: string): void {
    if (this.snapshot().incoming.some((request) => request.username === username)) this.answered(username);
    this.removeSent(username);
  }

  /** The request I sent is no longer waiting (accepted, or taken back elsewhere). */
  removeSent(username: string): void {
    this.update({ outgoing: this.snapshot().outgoing.filter((request) => request.username !== username) });
  }

  /** Signed out: nothing of the account stays in memory. */
  reset(): void {
    this.update({ incoming: [], outgoing: [], pending: new Set(), phase: loading, incomingCount: 0 });
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
