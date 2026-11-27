import type { Api } from "../account/api";
import { friendAccepted } from "../friends/friendship";
import type { FriendsCenter } from "../friends/center";
import { Store } from "../reader/store";
import { ChatModel } from "./chat";
import { messageToast } from "./copy";
import { InboxModel } from "./inbox";
import { LiveConnection, type LiveSocketFactory, type LiveToken } from "./liveConnection";
import type { LiveEvent } from "./liveEvents";
import { countsAsUnread, chatName, type Conversation } from "./models";
import { SharedDivanModel } from "./sharedDivan";
import type { SharedDivanTarget } from "./sharedDivanAdder";

type State = {
  /** The couplet «به دیوان مشترک» is adding: the sheet is open while there is one. */
  sharedTarget?: SharedDivanTarget;
};

type CenterApi = Pick<Api, "conversations" | "openConversation" | "messages" | "sendMessage" | "markRead" | "deleteMessage" | "report" | "leagueTier" | "sharedDivans" | "openSharedDivan" | "sharedDivanItems" | "addSharedDivanItem" | "removeSharedDivanItem" | "setSharedDivanLike">;

type Options = {
  friends: FriendsCenter;
  api: CenterApi;
  sockets: LiveSocketFactory;
  token: () => Promise<LiveToken>;
  /** What the backoff of the socket sleeps with (tests make it instant). */
  wait?: (ms: number) => Promise<void>;
};

/**
 * The messages side of the app, made once: the live socket, the inbox, the chats that were opened, the shared divans and the unread total for the tab badge
 * (which, with the friend requests, `FriendsCenter` keeps). Live events and the lists meet here (Messages/MessagesCenter.swift).
 */
export class MessagesCenter extends Store<State> {
  readonly inbox: InboxModel;
  readonly friends: FriendsCenter;
  /** Shows a line («<name> درخواستت رو قبول کرد»). */
  onToast?: (line: string) => void;
  private readonly chats = new Map<string, ChatModel>();
  private readonly chatsByUsername = new Map<string, ChatModel>();
  private readonly divans = new Map<string, SharedDivanModel>();
  private readonly live: LiveConnection;

  constructor(private readonly options: Options) {
    super({});
    this.friends = options.friends;
    this.inbox = new InboxModel(options.api);
    this.live = new LiveConnection({
      factory: options.sockets,
      token: options.token,
      wait: options.wait,
      onEvent: (event) => this.handle(event),
      onReady: () => void this.reconnected(),
    });
  }

  // MARK: The live socket

  /** The page is in front and someone is signed in: the socket is open. Otherwise it is closed. */
  setActive(active: boolean): void {
    if (active) this.live.start();
    else this.live.stop();
  }

  /** Events are not kept while the socket is closed: every connect reads again what is on screen (a screen that comes back reads its own list when it appears). */
  async reconnected(): Promise<void> {
    await this.friends.refreshUnread();
    if (this.inbox.isVisible) await this.inbox.load();
    if (this.friends.requests.isVisible) await this.friends.requests.load();
    for (const chat of this.chats.values()) {
      if (chat.isVisible) await chat.load();
      else if (chat.snapshot().phase.kind === "loaded") chat.needsReload = true;
    }
    for (const divan of this.divans.values()) if (divan.isVisible) await divan.load();
  }

  handle(event: LiveEvent): void {
    switch (event.type) {
      case "message":
        if (countsAsUnread(event.message) && this.chats.get(event.message.conversationId)?.isVisible !== true) this.friends.messageArrived();
        break;
      case "deleted":
        void this.friends.refreshUnread();
        break;
      case "friend.request":
        this.friends.requests.received(event.from);
        this.friends.friendsChanged();
        break;
      case "friend.accepted":
        this.friends.requests.removeSent(event.from.username);
        this.friends.friendsChanged();
        this.onToast?.(friendAccepted(chatName(event.from)));
        break;
    }
    const viewing = new Set([...this.chats.values()].filter((chat) => chat.isVisible).map((chat) => chat.id));
    if (this.inbox.apply(event, viewing)) void this.inbox.load();
    for (const chat of this.chats.values()) chat.apply(event);
    for (const divan of this.divans.values()) divan.apply(event);
  }

  // MARK: Chats and divans

  chat(conversation: Conversation): ChatModel {
    const known = this.chats.get(conversation.id);
    if (known) return known;
    const chat = new ChatModel(conversation, this.options.api);
    chat.onRead = () => {
      this.inbox.markRead(conversation.id);
      void this.friends.refreshUnread();
    };
    this.chats.set(conversation.id, chat);
    this.chatsByUsername.set(conversation.other.username, chat);
    return chat;
  }

  /** The chat with `username`, made if there is none (the entry of «پیام بده» and of the chat's address); the line to show when it could not be opened. */
  async openChat(username: string): Promise<{ chat: ChatModel } | { error: string }> {
    const known = this.chatsByUsername.get(username);
    if (known) return { chat: known };
    try {
      return { chat: this.chat(await this.options.api.openConversation(username)) };
    } catch (error) {
      return { error: messageToast(error) };
    }
  }

  sharedDivan(username: string): SharedDivanModel {
    let divan = this.divans.get(username);
    if (!divan) this.divans.set(username, (divan = new SharedDivanModel(username, this.options.api)));
    return divan;
  }

  // MARK: «به دیوان مشترک»

  /** The sheet that adds the couplet `key` to a shared divan opens (the person is known when the long press happened in a chat with them). */
  askSharedDivan(target: SharedDivanTarget): void {
    this.set({ sharedTarget: target });
  }

  closeSharedDivan(): void {
    this.set({});
  }

  /** Signed out: nothing of the account stays in memory. */
  reset(): void {
    this.live.stop();
    this.chats.clear();
    this.chatsByUsername.clear();
    this.divans.clear();
    this.inbox.reset();
    this.set({});
  }
}
