import { describe, expect, it } from "vitest";
import { FriendsCenter } from "../lib/friends/center";
import { InboxModel, inboxPreview } from "../lib/messages/inbox";
import { MessagesCenter } from "../lib/messages/center";
import type { ConversationLast, Message } from "../lib/messages/models";
import { fakeServer, none, ok, refuse, type Answer, type Seen } from "./friends";
import { eventually, FakeSockets, message, page, row, sara, tick } from "./messages";

// The ports of InboxAndCenterTests.swift.

const first = { items: [row("c1", "sara", "سارا", "یه مشاعره شروع کرد", { unread: 1 }), row("c2", "arian_k", "آرین", "سلام", { at: "2026-11-23T09:10:00Z" })], nextCursor: "page2" };
const second = { items: [row("c3", "kian", "كیان", "بیت قشنگی بود", { at: "2026-11-21T09:00:00Z" })], nextCursor: null };

function inbox(handler: (request: Seen) => Answer | Promise<Answer>) {
  const server = fakeServer(handler);
  return { ...server, model: new InboxModel(server.api) };
}

const rows = (model: InboxModel) => model.snapshot().rows.map((one) => one.id);
const visible = (model: InboxModel) => model.visibleRows.map((one) => one.id);

describe("the inbox", () => {
  it("loads page by page, and reading the first page again keeps the older rows", async () => {
    const { model, requests } = inbox((request) => ok(request.query.includes("cursor=page2") ? second : first));
    await model.load();
    expect(model.snapshot().phase.kind).toBe("loaded");
    expect(rows(model)).toEqual(["c1", "c2"]);
    expect(model.snapshot().hasMore).toBe(true);
    await model.loadMore();
    expect(rows(model)).toEqual(["c1", "c2", "c3"]);
    expect(model.snapshot().hasMore).toBe(false);
    await model.loadMore();
    expect(requests).toHaveLength(2);
    await model.load(); // a reconnect
    expect(rows(model)).toEqual(["c1", "c2", "c3"]);
    expect(model.snapshot().hasMore).toBe(false);
  });

  it("a failed first load is failed, and an empty inbox is loaded", async () => {
    const { model, respond } = inbox(() => "offline");
    await model.load();
    expect(model.snapshot().phase).toEqual({ kind: "failed", message: "اینترنت نیست؛ یه بار دیگه امتحان کن." });
    respond(() => ok({ items: [], nextCursor: null }));
    await model.load();
    expect(model.snapshot().phase.kind).toBe("loaded");
    expect(rows(model)).toEqual([]);
  });

  it("search filters the loaded rows by name or username, treating Arabic letters as Persian", async () => {
    const { model } = inbox(() => ok({ ...first, nextCursor: null }));
    await model.load();
    expect(visible(model)).toHaveLength(2);
    for (const [query, expected] of [["سار", ["c1"]], ["arian", ["c2"]], ["ARIAN_K", ["c2"]], ["هیچی", []], ["  ", ["c1", "c2"]]] as const) {
      model.setQuery(query);
      expect(visible(model), query).toEqual(expected);
    }
    const arabic = inbox(() => ok(second));
    await arabic.model.load();
    arabic.model.setQuery("کیان"); // the name was saved with an Arabic ك
    expect(visible(arabic.model)).toHaveLength(1);
  });

  it("a new message moves its row to the top and counts unread unless the chat is open", async () => {
    const { model } = inbox(() => ok(first));
    await model.load();
    expect(model.apply({ type: "message", message: message("m1", { conversationId: "c2", text: "جدید" }) }, new Set())).toBe(false);
    expect(rows(model)).toEqual(["c2", "c1"]);
    expect(model.snapshot().rows[0]).toMatchObject({ unread: 1, last: { text: "جدید" } });
    model.apply({ type: "message", message: message("m2", { conversationId: "c2", text: "باز هم" }) }, new Set(["c2"]));
    expect(model.snapshot().rows[0]!.unread).toBe(1); // the chat is open: it is read as it comes
    model.apply({ type: "message", message: message("m3", { conversationId: "c1", fromMe: true, text: "جواب" }) }, new Set());
    expect(model.snapshot().rows[0]).toMatchObject({ id: "c1", unread: 1 }); // my own message is not unread
    expect(inboxPreview(model.snapshot().rows[0]!.last)).toBe("تو: جواب");
  });

  it("a message of a chat it doesn't know asks for the list again", async () => {
    const { model } = inbox(() => ok(first));
    await model.load();
    expect(model.apply({ type: "message", message: message("m1", { conversationId: "c9" }) }, new Set())).toBe(true);
    expect(rows(model)).toEqual(["c1", "c2"]);
  });

  it("presence and read marks update the rows", async () => {
    const { model } = inbox(() => ok(first));
    await model.load();
    model.apply({ type: "presence", username: "sara", online: true }, new Set());
    expect(model.snapshot().rows[0]!.other.online).toBe(true);
    model.markRead("c1");
    expect(model.snapshot().rows[0]!.unread).toBe(0);
    expect(model.apply({ type: "deleted", conversationId: "c2", messageId: "m" }, new Set())).toBe(true);
    expect(model.apply({ type: "deleted", conversationId: "c9", messageId: "m" }, new Set())).toBe(false);
  });

  it("the preview line follows the board", () => {
    const last = (kind: ConversationLast["kind"], extra: Partial<ConversationLast> = {}): ConversationLast => ({ kind, text: null, key: null, note: null, deleted: false, at: "2026-11-24T09:00:00Z", fromMe: false, event: null, ...extra });
    expect(inboxPreview(last("text", { text: "فردا معما رو با هم حل کنیم؟", fromMe: true }))).toBe("تو: فردا معما رو با هم حل کنیم؟");
    expect(inboxPreview(last("text", { text: "بیت قشنگی بود" }))).toBe("بیت قشنگی بود");
    expect(inboxPreview(last("couplet", { key: "/hafez/ghazal/sh3#0" }))).toBe("یه بیت فرستاد");
    expect(inboxPreview(last("couplet", { fromMe: true }))).toBe("تو: یه بیت فرستادی");
    expect(inboxPreview(last("game", { event: "game_invite" }))).toBe("دعوتت کرد به بازی");
    expect(inboxPreview(last("game", { fromMe: true, event: "game_invite" }))).toBe("تو: به بازی دعوتش کردی");
    expect(inboxPreview(last("game", { event: "challenge_result" }))).toBe("توی چالشت بازی کرد");
    expect(inboxPreview(last("game", { fromMe: true, event: "challenge_result" }))).toBe("تو: توی چالش بازی کردی");
    expect(inboxPreview(last("game"))).toBe("");
    expect(inboxPreview(last("system", { event: "divan_add" }))).toBe("یه بیت به دیوان مشترک اضافه کرد");
    expect(inboxPreview(last("system", { event: "game_ended" }))).toBe("بازی تموم شد");
    expect(inboxPreview(last("system", { event: "something_new" }))).toBe("");
    expect(inboxPreview(last("system"))).toBe(""); // an event this app doesn't know is not guessed
    expect(inboxPreview(last("text", { deleted: true }))).toBe("این پیام پاک شد");
  });

  it("a live system line keeps its event in the row, and is never unread", async () => {
    const { model } = inbox(() => ok(first));
    await model.load();
    const line: Message = message("s1", { conversationId: "c2", kind: "system", text: null, payload: { event: "game_ended", kind: "mosh" } });
    model.apply({ type: "message", message: line }, new Set());
    expect(model.snapshot().rows[0]!.last.event).toBe("game_ended");
    expect(inboxPreview(model.snapshot().rows[0]!.last)).toBe("بازی تموم شد");
    expect(model.snapshot().rows[0]!.unread).toBe(0);
  });
});

// The center: events from the socket meet the lists and the badge.

function center(handler: (request: Seen) => Answer | Promise<Answer>, sockets = new FakeSockets()) {
  const server = fakeServer(handler);
  const friends = new FriendsCenter({ user: undefined }, server.api);
  const made = new MessagesCenter({ friends, api: server.api, sockets, token: async () => ({ token: "t1", url: "wss://x/v1/live" }), wait: () => tick(2) });
  return { ...server, center: made, friends, sockets, unread: () => friends.snapshot().unreadMessages };
}

const unreadAnswer = (total: number, friendRequests = 0) => ok({ total, friendRequests });

describe("the center", () => {
  it("the unread total comes from the server and grows with live messages that count", async () => {
    const { center: c, friends, unread } = center((request) => (request.path === "/v1/me/unread" ? unreadAnswer(2) : refuse(404, "not_found")));
    await friends.refreshUnread();
    expect(unread()).toBe(2);
    c.handle({ type: "message", message: message("m1", { text: "سلام" }) });
    expect(unread()).toBe(3);
    c.handle({ type: "message", message: message("m2", { fromMe: true }) });
    c.handle({ type: "message", message: message("m3", { kind: "system", text: null, payload: { event: "divan_add" } }) });
    c.handle({ type: "message", message: message("m4", { kind: "game", text: null, payload: { event: "game_invite" } }) });
    expect(unread()).toBe(4); // a game line of theirs counts (as on the server); mine and system lines don't
  });

  it("a message in the open chat is read as it comes and moves the badge back", async () => {
    const { center: c, requests, unread } = center((request) => {
      if (request.path === "/v1/me/unread") return unreadAnswer(0);
      return request.method === "PUT" ? none() : refuse(404, "not_found");
    });
    const chat = c.chat({ id: "c1", other: sara });
    chat.setVisible(true);
    c.handle({ type: "message", message: message("m1", { text: "سلام" }) });
    expect(unread()).toBe(0); // the chat is open
    expect(chat.snapshot().messages.map((one) => one.id)).toEqual(["m1"]);
    await chat.settle();
    expect(requests.some((request) => request.method === "PUT" && request.json?.messageId === "m1")).toBe(true);
    expect(await eventually(() => requests.some((request) => request.path === "/v1/me/unread"))).toBe(true); // the total is asked again after a read
  });

  it("events reach the chat and the inbox", async () => {
    const { center: c } = center((request) => (request.path === "/v1/conversations" ? ok(first) : refuse(404, "not_found")));
    await c.inbox.load();
    const chat = c.chat({ id: "c2", other: c.inbox.snapshot().rows[1]!.other });
    c.handle({ type: "message", message: message("m1", { conversationId: "c2", text: "سلام" }) });
    c.handle({ type: "presence", username: "arian_k", online: true });
    expect(chat.snapshot().messages.map((one) => one.id)).toEqual(["m1"]);
    expect(chat.snapshot().other.online).toBe(true);
    expect(c.inbox.snapshot().rows[0]).toMatchObject({ id: "c2", other: { online: true } });
  });

  it("a live friend request makes a row and counts on the badge, and an acceptance takes the sent request away and says so", async () => {
    const { center: c, friends } = center(() => refuse(404, "not_found"));
    const lines: string[] = [];
    c.onToast = (line) => lines.push(line);
    const aryan = { username: "aryan", displayName: "آرین", avatar: null };
    c.handle({ type: "friend.request", from: aryan });
    c.handle({ type: "friend.request", from: aryan }); // the same twice changes nothing
    expect(friends.requests.snapshot().incoming.map((request) => request.username)).toEqual(["aryan"]);
    expect(friends.requests.snapshot().incomingCount).toBe(1);
    expect(friends.snapshot().friendsRevision).toBe(2);
    friends.requests.setCount(1);
    c.handle({ type: "friend.accepted", from: { username: "paria", displayName: "پریا", avatar: null } });
    expect(lines).toEqual(["پریا درخواستت رو قبول کرد"]);
  });

  it("the socket brings events, and every connect reads the lists again", async () => {
    const sockets = new FakeSockets();
    const { center: c, requests, unread } = center((request) => (request.path === "/v1/me/unread" ? unreadAnswer(1) : ok(first)), sockets);
    await c.inbox.load();
    c.inbox.isVisible = true;
    c.setActive(true);
    expect(await eventually(() => sockets.sockets.length === 1)).toBe(true);
    sockets.sockets[0]!.ready();
    expect(await eventually(() => unread() === 1)).toBe(true); // read again on connect
    sockets.sockets[0]!.push(JSON.stringify({ type: "message", message: message("m1", { conversationId: "c1" }) }));
    expect(unread()).toBe(2);
    expect(await eventually(() => requests.filter((request) => request.path === "/v1/conversations").length >= 2)).toBe(true);
    c.setActive(false);
    expect(sockets.sockets[0]!.closedByClient).toBe(true);
  });

  it("a connect reads only what is on screen, and a covered chat catches up when it is looked at again", async () => {
    const { center: c, requests } = center((request) => {
      if (request.path === "/v1/me/unread") return unreadAnswer(0);
      if (request.path === "/v1/conversations") return ok(first);
      return ok(page([]));
    });
    await c.inbox.load();
    const open = c.chat({ id: "c1", other: sara });
    const away = c.chat({ id: "c2", other: { ...sara, username: "arian_k" } });
    await open.load();
    await away.load();
    open.setVisible(true);
    const before = requests.length;
    await c.reconnected();
    const paths = requests.slice(before).map((request) => request.path);
    expect(paths).toContain("/v1/me/unread");
    expect(paths).toContain("/v1/conversations/c1/messages");
    expect(paths).not.toContain("/v1/conversations/c2/messages"); // not on screen
    expect(paths).not.toContain("/v1/conversations"); // the inbox is not on screen either
    const again = requests.length;
    away.setVisible(true);
    await away.settle();
    expect(requests.slice(again).some((request) => request.path === "/v1/conversations/c2/messages")).toBe(true);
  });

  it("opens a chat by username once, finds it again without asking, and a closed one says why", async () => {
    const { center: c, requests, respond } = center((request) => (request.method === "POST" ? ok({ id: "c7", other: sara }) : refuse(404, "not_found")));
    const opened = await c.openChat("sara");
    expect("chat" in opened && opened.chat.id).toBe("c7");
    expect(requests[0]!.json).toEqual({ username: "sara" });
    expect(await c.openChat("sara")).toEqual(opened); // known: nothing asked
    expect(requests).toHaveLength(1);
    respond(() => refuse(403, "messages_closed"));
    expect(await c.openChat("kian")).toEqual({ error: "دیگه نمی‌تونی به این گفتگو پیام بدی" });
  });

  it("signing out forgets everything", async () => {
    const { center: c, friends, requests } = center((request) => (request.path === "/v1/me/unread" ? unreadAnswer(4) : ok(first)));
    await c.inbox.load();
    c.chat({ id: "c1", other: sara });
    c.askSharedDivan({ key: "/hafez/ghazal/sh3#0" });
    c.reset();
    friends.reset();
    expect(c.inbox.snapshot().rows).toEqual([]);
    expect(c.snapshot().sharedTarget).toBeUndefined();
    expect(friends.snapshot().unreadMessages).toBe(0);
    await c.openChat("sara");
    expect(requests.some((request) => request.method === "POST" && request.path === "/v1/conversations")).toBe(true); // the chat was forgotten: it is asked for again
  });
});
