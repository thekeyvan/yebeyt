import type { LiveHandlers, LiveSocket, LiveSocketFactory } from "../lib/messages/liveConnection";
import type { ChatPerson, ConversationItem, Message, SharedDivanItem } from "../lib/messages/models";

/** The fixed «now» of the chats' tests: 24 Aban 1405, a Tuesday in Tehran, at noon UTC; times are read in UTC. */
export const now = new Date("2026-11-24T12:00:00Z");
export const utc = "UTC";

export const sara: ChatPerson = { username: "sara", displayName: "سارا", avatar: null, online: true, canPlay: true };

export const message = (id: string, extra: Partial<Message> = {}): Message => ({
  id,
  conversationId: "c1",
  kind: "text",
  fromMe: false,
  text: "سلام",
  key: null,
  note: null,
  payload: null,
  deleted: false,
  createdAt: "2026-11-24T09:40:00.000Z",
  ...extra,
});

export const page = (items: Message[], extra: { before?: string; otherRead?: string } = {}) => ({ items, nextBefore: extra.before ?? null, otherReadMessageId: extra.otherRead ?? null });

export const row = (id: string, username: string, name: string | null, text: string | null, extra: { unread?: number; at?: string; kind?: Message["kind"]; event?: string | null; fromMe?: boolean } = {}): ConversationItem => ({
  id,
  other: { username, displayName: name, avatar: null, online: null, canPlay: true },
  last: { kind: extra.kind ?? "text", text, key: null, note: null, deleted: false, at: extra.at ?? "2026-11-24T09:45:00.000Z", fromMe: extra.fromMe ?? false, event: extra.event ?? null },
  unread: extra.unread ?? 0,
});

export const item = (id: string, key: string, mine: boolean, extra: Partial<SharedDivanItem> = {}): SharedDivanItem => ({ id, key, note: null, addedByMe: mine, createdAt: "2026-11-24T09:00:00.000Z", likedByMe: false, likedByThem: false, ...extra });

/** Lets what waits on promises and zero timers run. */
export const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits (up to a second) until `check` holds. */
export async function eventually(check: () => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return true;
    await tick(10);
  }
  return check();
}

/** A socket that does what the test says: `ready()`, `push(frame)`, `end(code)`. Like a browser's, it is opened a moment after it is made. */
export class FakeSocket implements LiveSocket {
  readonly sent: string[] = [];
  closedByClient = false;

  constructor(readonly url: string, private readonly handlers: LiveHandlers) {
    queueMicrotask(() => handlers.open());
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closedByClient = true;
  }

  ready(): void {
    this.push('{"type":"ready"}');
  }

  push(text: string): void {
    this.handlers.frame(text);
  }

  end(code?: number): void {
    this.handlers.close(code);
  }

  /** The token of the `auth` frame the connection sent first. */
  get authToken(): string | undefined {
    const first = this.sent[0] ? (JSON.parse(this.sent[0]) as { type?: string; token?: string }) : undefined;
    return first?.type === "auth" ? first.token : undefined;
  }
}

export class FakeSockets implements LiveSocketFactory {
  readonly sockets: FakeSocket[] = [];

  open(url: string, handlers: LiveHandlers): FakeSocket {
    const socket = new FakeSocket(url, handlers);
    this.sockets.push(socket);
    return socket;
  }
}
