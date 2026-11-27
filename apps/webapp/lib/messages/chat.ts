import { ApiError, messageOf, type Api } from "../account/api";
import { dayNumber } from "../library/date";
import { loaded, loading, type Phase } from "../friends/models";
import { Store } from "../reader/store";
import { chatTime, leagueLine, limited, messageCopy, messageToast, type ReportReason } from "./copy";
import type { LiveEvent } from "./liveEvents";
import { countsAsUnread, payloadOf, type ChatPerson, type Content, type Conversation, type Message } from "./models";

/** A message of mine that the server has not answered for yet, or has refused. `failed` shows «نرسید · دوباره». */
export type Pending = {
  readonly clientId: string;
  readonly content: Content;
  readonly createdAt: Date;
  failed: boolean;
  /** The server closed the chat (`messages_closed`): the text stays here, not lost, but cannot be sent again. */
  refused: boolean;
};

/** One thing drawn in the list: a day label, a message, or a send on its way. */
export type Entry = { id: string; rowId: string } & ({ kind: "day"; label: string } | { kind: "message"; message: Message; seen: boolean } | { kind: "pending"; pending: Pending });

type State = {
  other: ChatPerson;
  messages: readonly Message[];
  pending: readonly Pending[];
  otherReadMessageId: string | null;
  phase: Phase;
  isLoadingOlder: boolean;
  hasOlder: boolean;
  /** The server refused sends with `messages_closed`: the composer is replaced by a line. */
  isClosed: boolean;
  /** «لیگ غزل‌باز», when the server told it. */
  league?: string;
  /** A line shown for a moment («یه کم آروم‌تر»); `serial` counts every showing, so the same line shown again starts its time over. */
  toast?: { line: string; serial: number };
};

export const maxTextLength = 1000;
export const maxNoteLength = 200;

type ChatApi = Pick<Api, "messages" | "sendMessage" | "markRead" | "deleteMessage" | "report" | "leagueTier">;

const time = (message: Pick<Message, "createdAt">): number => Date.parse(message.createdAt);

/** Whether the list draws this message: of the lines that are not texts or couplets, a couplet added to the shared divan, a game that ended, an invitation and a challenge's result. */
export function isShown(message: Message): boolean {
  const event = payloadOf(message)?.event;
  switch (message.kind) {
    case "text":
    case "couplet":
      return true;
    case "system":
      return event === "divan_add" || event === "game_ended";
    case "game":
      return event === "game_invite" || event === "challenge_result";
  }
}

const sameContent = (content: Content, message: Message): boolean => (content.kind === "text" ? message.kind === "text" && message.text === content.text : message.kind === "couplet" && message.key === content.key);

/**
 * One chat: its messages (oldest first), the sends still on their way, the other person's read mark (Messages/ChatModel.swift). The view only draws `entries` and
 * calls the methods; live events arrive through `apply`.
 */
export class ChatModel extends Store<State> {
  readonly id: string;
  /** Message id → the send it answers: the bubble keeps one identity from «sending» to «sent». */
  private readonly sendIds = new Map<string, string>();
  private nextBefore?: string;
  private lastReadSent?: string;
  private toasts = 0;
  private visible = false;
  private readonly inflight = new Set<Promise<void>>();
  /** A reconnect found the chat covered and did not read it; it is read when it is looked at again. */
  needsReload = false;
  /** Called after a read mark reached the server, so the unread total can be asked again. */
  onRead?: () => void;

  constructor(
    conversation: Conversation,
    private readonly api: ChatApi,
    private readonly now: () => Date = () => new Date(),
    private readonly makeId: () => string = () => crypto.randomUUID(),
  ) {
    super({ other: conversation.other, messages: [], pending: [], otherReadMessageId: null, phase: loading, isLoadingOlder: false, hasOlder: false, isClosed: false });
    this.id = conversation.id;
  }

  /** «آنلاین · لیگ غزل‌باز»: the online word only when the person lets others see it. */
  get statusLine(): string | undefined {
    const { other, league } = this.snapshot();
    const parts = [other.online === true ? "آنلاین" : undefined, league].filter((part) => part !== undefined);
    return parts.length === 0 ? undefined : parts.join(" · ");
  }

  /** The last message of mine the other person has read. */
  get seenMessageId(): string | undefined {
    const { messages, otherReadMessageId } = this.snapshot();
    const readIndex = messages.findIndex((message) => message.id === otherReadMessageId);
    if (otherReadMessageId === null || readIndex < 0) return undefined;
    return messages.slice(0, readIndex + 1).findLast((message) => message.fromMe && !message.deleted && (message.kind === "text" || message.kind === "couplet"))?.id;
  }

  /** The chat is on screen with the page in front: new messages are marked read. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) return;
    // A reconnect skipped this chat while it was covered (a poem open over it): it catches up now.
    if (this.needsReload) this.run(() => this.load());
    this.markRead();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  // MARK: Loading

  /** The newest page. Also what a reconnect calls, to catch up on what the closed socket missed. */
  async load(): Promise<void> {
    this.needsReload = false;
    const first = this.snapshot().phase.kind !== "loaded";
    if (this.snapshot().messages.length === 0) this.update({ phase: loading });
    try {
      const page = await this.api.messages(this.id);
      this.merge(page.items);
      if (first || this.snapshot().messages.length <= page.items.length) this.nextBefore = page.nextBefore ?? undefined;
      this.update({ otherReadMessageId: page.otherReadMessageId ?? this.snapshot().otherReadMessageId, phase: loaded, hasOlder: this.nextBefore !== undefined });
      this.markRead();
    } catch (error) {
      if (this.snapshot().messages.length === 0) this.update({ phase: { kind: "failed", message: messageOf(error) } });
    }
  }

  /** The page before the oldest one loaded (the list scrolled to its top). */
  async loadOlder(): Promise<void> {
    const before = this.nextBefore;
    if (before === undefined || this.snapshot().isLoadingOlder) return;
    this.update({ isLoadingOlder: true });
    try {
      const page = await this.api.messages(this.id, before);
      this.merge(page.items);
      this.nextBefore = page.nextBefore ?? undefined;
      this.update({ hasOlder: this.nextBefore !== undefined });
    } catch {
      // The list stays as it is; scrolling to the top asks again.
    } finally {
      this.update({ isLoadingOlder: false });
    }
  }

  async loadLeague(): Promise<void> {
    try {
      const tier = await this.api.leagueTier(this.snapshot().other.username);
      this.update({ league: tier === undefined ? undefined : leagueLine(tier) });
    } catch {
      // The header says no league.
    }
  }

  // MARK: Sending

  /** A text of mine goes into the list at once, as a send on its way. False when there is nothing to send. */
  send(text: string): boolean {
    const trimmed = text.trim();
    return trimmed !== "" && this.enqueue({ kind: "text", text: limited(trimmed, maxTextLength) });
  }

  sendCouplet(key: string, note?: string): boolean {
    const trimmed = note?.trim();
    return this.enqueue({ kind: "couplet", key, ...(trimmed ? { note: limited(trimmed, maxNoteLength) } : {}) });
  }

  /** «نرسید · دوباره»: the same send again, with the same `clientId`, so the server never makes two of it. */
  retry(clientId: string): void {
    const sending = this.snapshot().pending.find((one) => one.clientId === clientId);
    if (!sending?.failed || sending.refused) return;
    this.changePending(clientId, { failed: false });
    this.run(() => this.deliver(clientId));
  }

  discard(clientId: string): void {
    this.update({ pending: this.snapshot().pending.filter((one) => one.clientId !== clientId) });
  }

  private enqueue(content: Content): boolean {
    if (this.snapshot().isClosed) return false;
    const clientId = this.makeId();
    this.update({ pending: [...this.snapshot().pending, { clientId, content, createdAt: this.now(), failed: false, refused: false }] });
    this.run(() => this.deliver(clientId));
    return true;
  }

  private async deliver(clientId: string): Promise<void> {
    const sending = this.snapshot().pending.find((one) => one.clientId === clientId);
    if (!sending) return;
    try {
      const message = await this.api.sendMessage(this.id, clientId, sending.content);
      this.sendIds.set(message.id, clientId);
      this.update({ pending: this.snapshot().pending.filter((one) => one.clientId !== clientId) });
      this.insert(message);
    } catch (error) {
      if (error instanceof ApiError && error.code === "messages_closed") {
        this.update({ isClosed: true });
        this.changePending(clientId, { failed: true, refused: true }); // kept, so what was typed isn't lost
        return;
      }
      this.changePending(clientId, { failed: true });
      if (error instanceof ApiError && error.status === 429) this.showToast(messageCopy.slowDown);
    }
  }

  private changePending(clientId: string, change: Partial<Pending>): void {
    this.update({ pending: this.snapshot().pending.map((one) => (one.clientId === clientId ? { ...one, ...change } : one)) });
  }

  // MARK: Messages of others and mine

  /** A message of mine, taken back: the server keeps the row and clears it; both phones get an event. */
  async delete(message: Message): Promise<void> {
    if (!message.fromMe || (message.kind !== "text" && message.kind !== "couplet")) return;
    try {
      await this.api.deleteMessage(message.id);
      this.markDeleted(message.id);
    } catch (error) {
      this.showToast(messageToast(error));
    }
  }

  async report(message: Message, reason: ReportReason): Promise<void> {
    try {
      await this.api.report({ username: this.snapshot().other.username, messageId: message.id, reason });
      this.showToast(messageCopy.reported);
    } catch (error) {
      this.showToast(messageToast(error));
    }
  }

  showToast(line: string): void {
    this.toasts += 1;
    this.update({ toast: { line, serial: this.toasts } });
  }

  clearToast(): void {
    this.update({ toast: undefined });
  }

  // MARK: Live

  apply(event: LiveEvent): void {
    const { pending, other } = this.snapshot();
    switch (event.type) {
      case "message": {
        const { message } = event;
        if (message.conversationId !== this.id) return;
        const mine = message.fromMe ? pending.find((one) => !one.failed && sameContent(one.content, message)) : undefined;
        if (mine) {
          this.sendIds.set(message.id, mine.clientId);
          this.update({ pending: pending.filter((one) => one !== mine) }); // the event came before the answer of the send
        }
        this.insert(message);
        return;
      }
      case "read":
        if (event.conversationId === this.id && event.username === other.username) this.update({ otherReadMessageId: event.messageId });
        return;
      case "deleted":
        if (event.conversationId === this.id) this.markDeleted(event.messageId);
        return;
      case "presence":
        if (event.username === other.username) this.update({ other: { ...other, online: event.online } });
    }
  }

  private insert(message: Message): void {
    if (this.snapshot().messages.some((one) => one.id === message.id)) return;
    this.merge([message]);
    if (!message.fromMe) this.markRead();
  }

  private merge(incoming: readonly Message[]): void {
    const messages = [...this.snapshot().messages];
    const known = new Set(messages.map((message) => message.id));
    for (const message of incoming) if (!known.has(message.id)) messages.push(message);
    messages.sort((a, b) => time(a) - time(b) || (a.id < b.id ? -1 : 1));
    this.update({ messages });
  }

  private markDeleted(messageId: string): void {
    this.update({ messages: this.snapshot().messages.map((message) => (message.id === messageId ? { ...message, deleted: true, text: null, key: null, note: null } : message)) });
  }

  // MARK: Read marks

  /** Tells the server the newest message is read, when the chat is on screen and something of the other person's came after the last mark. */
  markRead(): void {
    const { messages } = this.snapshot();
    const newest = messages.at(-1);
    const unread = messages.findLastIndex(countsAsUnread);
    if (!this.visible || !newest || unread < 0) return;
    const sentIndex = this.lastReadSent === undefined ? -1 : messages.findIndex((message) => message.id === this.lastReadSent);
    if (sentIndex >= unread) return;
    const before = this.lastReadSent;
    this.lastReadSent = newest.id;
    this.run(async () => {
      try {
        await this.api.markRead(this.id, newest.id);
        this.onRead?.();
      } catch {
        if (this.lastReadSent === newest.id) this.lastReadSent = before;
      }
    });
  }

  // MARK: What the list draws

  /** Day labels, messages and sends on their way, oldest first. */
  entries(now: Date = this.now(), timeZone?: string): Entry[] {
    const { messages, pending } = this.snapshot();
    const seen = this.seenMessageId;
    const result: Entry[] = [];
    let lastDay: number | undefined;
    const day = (date: Date) => {
      const number = dayNumber(date, timeZone);
      if (number === lastDay) return;
      lastDay = number;
      result.push({ kind: "day", id: `day-${number}`, rowId: `day-${number}`, label: chatTime.day(date, now, timeZone) });
    };
    for (const message of messages.filter(isShown)) {
      day(new Date(message.createdAt));
      result.push({ kind: "message", id: message.id, rowId: this.sendIds.get(message.id) ?? message.id, message, seen: message.id === seen });
    }
    for (const sending of pending) {
      day(sending.createdAt);
      result.push({ kind: "pending", id: sending.clientId, rowId: sending.clientId, pending: sending });
    }
    return result;
  }

  // MARK: Tasks

  private run(work: () => Promise<void>): void {
    const task = work().finally(() => this.inflight.delete(task));
    this.inflight.add(task);
  }

  /** Waits for the sends and read marks started so far (for tests). */
  async settle(): Promise<void> {
    while (this.inflight.size > 0) await Promise.all([...this.inflight]);
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
