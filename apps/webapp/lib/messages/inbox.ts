import { messageOf, type Api } from "../account/api";
import { loaded, loading, type Phase } from "../friends/models";
import { contains, normalize } from "../library/normalize";
import { Store } from "../reader/store";
import { messageCopy } from "./copy";
import type { LiveEvent } from "./liveEvents";
import { chatName, countsAsUnread, payloadOf, type ConversationItem, type ConversationLast } from "./models";

type State = { rows: readonly ConversationItem[]; phase: Phase; isLoadingMore: boolean; hasMore: boolean; query: string };

/** The line under a name: «تو: فردا معما رو با هم حل کنیم؟», «یه بیت فرستاد», «دعوتت کرد به بازی». */
export function inboxPreview(last: ConversationLast): string {
  let body: string;
  if (last.deleted) body = messageCopy.deletedMessage;
  else if (last.kind === "text") body = last.text ?? "";
  else if (last.kind === "couplet") body = last.fromMe ? "یه بیت فرستادی" : "یه بیت فرستاد";
  else if (last.kind === "game") {
    if (last.event === "game_invite") body = last.fromMe ? "به بازی دعوتش کردی" : "دعوتت کرد به بازی";
    else if (last.event === "challenge_result") body = last.fromMe ? "توی چالش بازی کردی" : "توی چالشت بازی کرد";
    else return "";
  } else if (last.event === "divan_add") body = last.fromMe ? "یه بیت به دیوان مشترک اضافه کردی" : "یه بیت به دیوان مشترک اضافه کرد";
  else if (last.event === "game_ended") body = "بازی تموم شد";
  else return "";
  return last.fromMe ? `تو: ${body}` : body;
}

/** The list of chats: newest message first, with the last message and what is unread. Search only filters the rows already loaded (Messages/InboxModel.swift). */
export class InboxModel extends Store<State> {
  private nextCursor?: string;
  /** The inbox is showing: a reconnect reads it again. */
  isVisible = false;

  constructor(private readonly api: Pick<Api, "conversations">) {
    super({ rows: [], phase: loading, isLoadingMore: false, hasMore: false, query: "" });
  }

  /** The rows whose name or username holds what was typed (all of them when nothing is typed). */
  get visibleRows(): readonly ConversationItem[] {
    const { rows, query } = this.snapshot();
    return normalize(query) === "" ? rows : rows.filter((row) => contains(chatName(row.other), query) || contains(row.other.username, query));
  }

  setQuery(query: string): void {
    this.update({ query });
  }

  /** The first page. Also what a reconnect calls: the rows are replaced, so what the socket missed shows up. */
  async load(): Promise<void> {
    if (this.snapshot().rows.length === 0) this.update({ phase: loading });
    try {
      const page = await this.api.conversations();
      // Rows of pages loaded further down stay (those the first page now holds move up).
      const fresh = new Set(page.items.map((row) => row.id));
      const older = this.snapshot().rows.filter((row) => !fresh.has(row.id));
      if (this.snapshot().phase.kind !== "loaded" || older.length === 0) this.nextCursor = page.nextCursor ?? undefined;
      this.update({ rows: [...page.items, ...older], phase: loaded, hasMore: this.nextCursor !== undefined });
    } catch (error) {
      if (this.snapshot().rows.length === 0) this.update({ phase: { kind: "failed", message: messageOf(error) } });
    }
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursor;
    if (cursor === undefined || this.snapshot().isLoadingMore) return;
    this.update({ isLoadingMore: true });
    try {
      const page = await this.api.conversations(cursor);
      const known = new Set(this.snapshot().rows.map((row) => row.id));
      this.nextCursor = page.nextCursor ?? undefined;
      this.update({ rows: [...this.snapshot().rows, ...page.items.filter((row) => !known.has(row.id))], hasMore: this.nextCursor !== undefined });
    } catch {
      // Scrolling to the end asks again.
    } finally {
      this.update({ isLoadingMore: false });
    }
  }

  /** A live event. Returns true when the inbox should be read again (a message of a chat it doesn't know yet). `viewing` holds the chats the person has open: their unread count stays at zero. */
  apply(event: LiveEvent, viewing: ReadonlySet<string>): boolean {
    const { rows, phase } = this.snapshot();
    switch (event.type) {
      case "message": {
        const { message } = event;
        const index = rows.findIndex((row) => row.id === message.conversationId);
        if (index < 0) return phase.kind === "loaded";
        const row = rows[index]!;
        const last: ConversationLast = { kind: message.kind, text: message.text, key: message.key, note: message.note, deleted: message.deleted, at: message.createdAt, fromMe: message.fromMe, event: payloadOf(message)?.event ?? null };
        const unread = row.unread + (countsAsUnread(message) && !viewing.has(message.conversationId) ? 1 : 0);
        this.update({ rows: [{ ...row, last, unread }, ...rows.filter((_, at) => at !== index)] });
        return false;
      }
      case "presence":
        this.update({ rows: rows.map((row) => (row.other.username === event.username ? { ...row, other: { ...row.other, online: event.online } } : row)) });
        return false;
      case "deleted":
        return rows.some((row) => row.id === event.conversationId); // it may have been the last message, or an unread one
      default:
        return false;
    }
  }

  /** The person read the chat here: its dot goes out. */
  markRead(conversation: string): void {
    this.update({ rows: this.snapshot().rows.map((row) => (row.id === conversation ? { ...row, unread: 0 } : row)) });
  }

  reset(): void {
    this.nextCursor = undefined;
    this.set({ rows: [], phase: loading, isLoadingMore: false, hasMore: false, query: "" });
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
