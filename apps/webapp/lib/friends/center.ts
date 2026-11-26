import { Store } from "../reader/store";
import type { Api } from "../account/api";
import type { SessionLike } from "../account/session";
import { BlockedPeople } from "./blockedPeople";
import type { FriendAction } from "./friendship";
import { FriendRequestsModel } from "./requests";
import type { Friendship } from "./models";

type State = { unreadMessages: number; friendsRevision: number };

/**
 * What the friends screens share (the friends part of Messages/MessagesCenter.swift): the requests, whom I blocked, the unread number behind the tab badge,
 * and a count that goes up when my friends changed, so a list on screen reads again.
 */
export class FriendsCenter extends Store<State> {
  readonly requests: FriendRequestsModel;
  readonly blocked: BlockedPeople;

  constructor(
    session: Pick<SessionLike, "user">,
    private readonly api: Pick<Api, "unread" | "friendRequests" | "friendAction">,
  ) {
    super({ unreadMessages: 0, friendsRevision: 0 });
    this.requests = new FriendRequestsModel(api);
    this.blocked = new BlockedPeople(session);
  }

  /** The tab badge: the unread messages and the friend requests waiting for my answer. */
  get badge(): number {
    return this.snapshot().unreadMessages + this.requests.snapshot().incomingCount;
  }

  /** The server's counts; a failure keeps what is shown. */
  async refreshUnread(): Promise<void> {
    try {
      const unread = await this.api.unread();
      this.set({ ...this.snapshot(), unreadMessages: unread.total });
      this.requests.setCount(unread.friendRequests);
    } catch {
      // The badge stays as it was.
    }
  }

  /** What a friend action did elsewhere than the requests screen: the badge and the lists follow. */
  friendshipChanged(username: string, action: FriendAction, state: Friendship): void {
    if (action === "accept" || action === "reject" || (action === "send" && state === "friends")) {
      this.requests.answered(username);
      void this.refreshUnread();
    }
    if (action === "cancel" || state === "friends") this.requests.removeSent(username);
    if (state === "friends" || action === "unfriend") this.set({ ...this.snapshot(), friendsRevision: this.snapshot().friendsRevision + 1 });
  }

  /** I blocked `username`: they leave the lists I loaded, and any request between us is gone (the server drops them). */
  blockedPerson(username: string): void {
    this.blocked.add(username);
    this.requests.removeAll(username);
    void this.refreshUnread();
  }

  /** Signed out: nothing of the account stays in memory. */
  reset(): void {
    this.requests.reset();
    this.set({ unreadMessages: 0, friendsRevision: 0 });
  }
}
