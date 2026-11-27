import { conversationId } from "../messages/debugIds";
import type { World } from "./stubFriends";

// What the debug server answers for messages and shared divans (Debug/MessagesBackend.swift of the phone): the chats as on the boards (سارا, آرین, کیان, مهسا and بردیا
// in the inbox; the demo friend «یه بیت» has a chat of its own, which has no game chips), one shared divan with Sara (24 couplets, 13 hers and 11 mine, of which three are listed) and
// one with Kian. Unlike the phone's, this stub remembers: what is sent stays in the chat, a read mark clears the unread count, and couplets added, taken out and liked stay so
// for each debug account on its own. The people are the friends stub's, so one Sara is everywhere. Times are today and the days before, so the chats look as on the boards on any day.

type Person = { username: string; displayName: string; avatar: Record<string, string> | null; online: boolean | null; canPlay: boolean };
type Item = { id: string; key: string; note: string | null; addedByMe: boolean; createdAt: string; likedByMe: boolean; likedByThem: boolean };
type Message = { id: string; conversationId: string; kind: string; fromMe: boolean; text: string | null; key: string | null; note: string | null; payload: Record<string, unknown> | null; deleted: boolean; createdAt: string };
type Divan = { id: string; username: string; items: Item[]; extra: { mine: number; theirs: number } };

const face = (skin: string, hair: string, background: string) => ({ face: skin, eyes: "round", hair, mouth: "smile", accessory: "none", background });

const people: Record<string, Person> = {
  "sara.ghazal": { username: "sara.ghazal", displayName: "سارا", avatar: face("peach", "dark", "rose"), online: true, canPlay: true },
  aryan: { username: "aryan", displayName: "آرین", avatar: face("sand", "black", "mint"), online: null, canPlay: true },
  kian_k: { username: "kian_k", displayName: "کیان", avatar: face("sand", "fire", "sun"), online: null, canPlay: true },
  "mahsa.m": { username: "mahsa.m", displayName: "مهسا", avatar: face("tan", "black", "lapis"), online: false, canPlay: true },
  bardia: { username: "bardia", displayName: "بردیا", avatar: face("peach", "amber", "sun"), online: null, canPlay: true },
  yebeyt: { username: "yebeyt", displayName: "یه بیت", avatar: null, online: null, canPlay: false },
};

const personOf = (username: string): Person => people[username] ?? { username, displayName: username, avatar: null, online: null, canPlay: true };
const short = ({ username, displayName, avatar }: Person) => ({ username, displayName, avatar });

/** `daysAgo` (one or more) days before today at that local time, as the server writes a time. */
function at(daysAgo: number, hour: number, minute: number): string {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  day.setHours(hour, minute, 0, 0);
  return day.toISOString();
}

/** Today, `minutesAgo` minutes before now, but never before the start of the day (a stub that runs at night still has its chats on today, in order) and never in the future. */
function recent(minutesAgo: number): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(Math.max(Date.now() - minutesAgo * 60_000, start.getTime() + (60 - minutesAgo) * 1000)).toISOString();
}

const text = (id: string, username: string, body: string, when: string, mine = false): Message => ({ id, conversationId: conversationId(username), kind: "text", fromMe: mine, text: body, key: null, note: null, payload: null, deleted: false, createdAt: when });
const line = (id: string, username: string, kind: string, payload: Record<string, unknown>, when: string, mine = false): Message => ({ ...text(id, username, "", when, mine), kind, text: null, payload });

function startingChats(): Map<string, Message[]> {
  const chat = (username: string, messages: Message[]) => [username, messages] as const;
  return new Map([
    // Newest first, as the server sends them.
    chat("sara.ghazal", [
      line("g1", "sara.ghazal", "game", { event: "game_invite", kind: "mosh", gameId: "g1", code: "ABCD" }, recent(5)),
      text("m3", "sara.ghazal", "وای چقدر قشنگه! ممنون", recent(8), true),
      { ...text("m1", "sara.ghazal", "", recent(10)), kind: "couplet", text: null, key: "/hafez/ghazal/sh8#4", note: "اینو دیدم یاد تو افتادم" },
    ]),
    chat("kian_k", [
      text("k3", "kian_k", "بیت قشنگی بود", at(1, 21, 5)),
      line("k2", "kian_k", "system", { event: "divan_add", key: "/khayyam/robaee/sh2#0" }, at(1, 21, 4)),
      text("k1", "kian_k", "این رباعی رو ببین", at(1, 21, 0), true),
    ]),
    chat("mahsa.m", [text("h2", "mahsa.m", "فردا معما رو با هم حل کنیم؟", at(1, 18, 30), true), text("h1", "mahsa.m", "مهسا تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2", at(1, 18, 0))]),
    chat("aryan", [line("a1", "aryan", "game", { event: "game_invite", kind: "duel", gameId: "g2", code: "DUEL" }, recent(35))]),
    chat("bardia", [{ ...text("b1", "bardia", "", at(3, 12, 0)), kind: "couplet", text: null, key: "/hafez/ghazal/sh8#4" }]),
  ]);
}

const startingUnread: Record<string, number> = { "sara.ghazal": 1, aryan: 1 };

/** Kian's chat has an older page (`before=older`): two messages two days back. */
const older = (): Message[] => [text("o2", "kian_k", "چطوری؟", at(2, 20, 5)), text("o1", "kian_k", "سلام کیان", at(2, 20, 0), true)];

/** The inbox's row for a chat: its last message, whose kind and event `last` says. */
function row(username: string, messages: Message[], unread: number) {
  const last = messages[0]!;
  return { id: conversationId(username), other: personOf(username), last: { kind: last.kind, text: last.text, key: last.key, note: last.note, deleted: last.deleted, at: last.createdAt, fromMe: last.fromMe, event: (last.payload?.event as string | undefined) ?? null }, unread };
}

function startingDivans(): Map<string, Divan> {
  const item = (id: string, key: string, mine: boolean, extra: Partial<Item>, when: string): Item => ({ id, key, note: null, addedByMe: mine, createdAt: when, likedByMe: false, likedByThem: false, ...extra });
  const list = () => [
    item("i1", "/hafez/ghazal/sh8#4", false, { note: "یاد سفر شیراز افتادم", likedByMe: true }, at(1, 20, 0)),
    item("i2", "/khayyam/robaee/sh2#0", true, { likedByThem: true }, at(3, 20, 0)),
    item("i3", "/babataher/2beytiha/sh1#0", false, {}, at(8, 20, 0)),
  ];
  // The rest of the 24 (11 mine, 13 hers) are not listed: the counts say the whole divan.
  return new Map([
    ["sara.ghazal", { id: "d-sara_ghazal", username: "sara.ghazal", items: list(), extra: { mine: 10, theirs: 11 } }],
    ["kian_k", { id: "d-kian_k", username: "kian_k", items: list(), extra: { mine: 0, theirs: 0 } }],
  ]);
}

const countsOf = ({ items, extra }: Divan) => {
  const mine = items.filter((one) => one.addedByMe).length + extra.mine;
  const theirs = items.filter((one) => !one.addedByMe).length + extra.theirs;
  return { total: mine + theirs, mine, theirs };
};

/** What a debug account has in its chats and shared divans. */
export class MessagesWorld {
  readonly chats = startingChats();
  readonly divans = startingDivans();
  readonly unread = new Map(Object.entries(startingUnread));
  private count = 0;

  nextId(prefix: string): string {
    this.count += 1;
    return `${prefix}-${this.count}`;
  }

  totalUnread(): number {
    return [...this.unread.values()].reduce((sum, one) => sum + one, 0);
  }
}

const error = (status: number, code: string) => Response.json({ error: code }, { status });
const nothing = () => new Response(null, { status: 204 });

type Call = { method: string; pathname: string; search: URLSearchParams; given: Record<string, unknown>; world: MessagesWorld; friends: World };

const usernameOfChat = (id: string): string | undefined => Object.keys(people).find((username) => conversationId(username) === id);
const divanById = (world: MessagesWorld, id: string): Divan | undefined => [...world.divans.values()].find((one) => one.id === id);
const divanJson = (divan: Divan) => ({ id: divan.id, other: short(personOf(divan.username)), counts: countsOf(divan) });
const newestFirst = (items: Item[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** The chats that have a message, the newest last message first. */
function conversations(world: MessagesWorld) {
  const rows = [...world.chats].filter(([, messages]) => messages.length > 0).map(([username, messages]) => row(username, messages, world.unread.get(username) ?? 0));
  return { items: rows.sort((a, b) => b.last.at.localeCompare(a.last.at)), nextCursor: null };
}

/** The answer for a call of messages; undefined for a path that is not theirs. */
export function messagesAnswer({ method, pathname, search, given, world, friends }: Call): Response | undefined {
  const route = `${method} ${pathname}`;
  const parts = pathname.split("/").filter(Boolean); // v1, conversations, c-sara_ghazal, messages
  switch (route) {
    case "GET /v1/me/unread":
      return Response.json({ total: world.totalUnread(), friendRequests: friends.received.length });
    case "GET /v1/conversations":
      return Response.json(conversations(world));
    case "POST /v1/conversations": {
      const username = String(given.username ?? "");
      if (!people[username] && !friends.friends.has(username)) return error(403, "messages_closed");
      return Response.json({ id: conversationId(username), other: personOf(username) });
    }
    case "GET /v1/shared-divans":
      return Response.json({ items: [...world.divans.values()].map(divanJson), nextCursor: null });
    case "POST /v1/shared-divans": {
      const username = String(given.username ?? "");
      if (!friends.friends.has(username)) return error(403, "forbidden");
      let divan = world.divans.get(username);
      if (!divan) world.divans.set(username, (divan = { id: `d-${username.replaceAll(".", "_")}`, username, items: [], extra: { mine: 0, theirs: 0 } }));
      return Response.json(divanJson(divan));
    }
  }
  if (parts[1] === "conversations" && parts.length === 4) return chatAnswer(method, parts[2]!, parts[3]!, search, given, world);
  if (method === "DELETE" && parts[1] === "messages" && parts.length === 3) return deleteMessage(parts[2]!, world);
  if (parts[1] === "shared-divans" && parts.length >= 4) return divanAnswer(method, parts, search, given, world);
  return undefined;
}

/** Only the sender takes a text or a couplet back: the row stays, cleared. */
function deleteMessage(id: string, world: MessagesWorld): Response {
  for (const [username, messages] of world.chats) {
    const found = messages.find((one) => one.id === id);
    if (!found) continue;
    if (!found.fromMe || (found.kind !== "text" && found.kind !== "couplet")) return error(403, "forbidden");
    world.chats.set(username, messages.map((one) => (one === found ? { ...one, deleted: true, text: null, key: null, note: null, payload: null } : one)));
    return nothing();
  }
  return error(404, "not_found");
}

function chatAnswer(method: string, id: string, what: string, search: URLSearchParams, given: Record<string, unknown>, world: MessagesWorld): Response | undefined {
  const username = usernameOfChat(id);
  if (!username) return error(404, "not_found");
  const messages = world.chats.get(username) ?? [];
  if (what === "messages" && method === "GET") {
    const paged = username === "kian_k";
    return Response.json({ items: search.has("before") ? (paged ? older() : []) : messages, nextBefore: paged && !search.has("before") ? "older" : null, otherReadMessageId: username === "sara.ghazal" ? "m3" : null });
  }
  if (what === "messages" && method === "POST") {
    const clientId = String(given.clientId ?? world.nextId("k"));
    const known = messages.find((one) => one.id === `sent-${clientId}`);
    if (known) return Response.json(known);
    const couplet = given.kind === "couplet";
    const sent: Message = { ...text(`sent-${clientId}`, username, String(given.text ?? ""), new Date().toISOString(), true), ...(couplet ? { kind: "couplet", text: null, key: String(given.key), note: typeof given.note === "string" ? given.note : null } : {}) };
    world.chats.set(username, [sent, ...messages]);
    return Response.json(sent, { status: 201 });
  }
  if (what === "read" && method === "PUT") {
    world.unread.set(username, 0);
    return nothing();
  }
  return undefined;
}

function divanAnswer(method: string, parts: string[], search: URLSearchParams, given: Record<string, unknown>, world: MessagesWorld): Response | undefined {
  const divan = divanById(world, parts[2]!);
  if (!divan) return error(404, "not_found");
  const [, , , what, itemId, like] = parts;
  if (what !== "items") return undefined;
  if (parts.length === 4 && method === "GET") {
    const by = search.get("by");
    const shown = divan.items.filter((one) => by !== "me" && by !== "them" ? true : (by === "me") === one.addedByMe);
    return Response.json({ items: newestFirst(shown), nextCursor: null, counts: countsOf(divan) });
  }
  if (parts.length === 4 && method === "POST") return addItem(divan, given, world);
  const found = divan.items.find((one) => one.id === itemId);
  if (!found) return error(404, "not_found");
  if (parts.length === 5 && method === "DELETE") {
    if (!found.addedByMe) return error(403, "forbidden");
    divan.items = divan.items.filter((one) => one !== found);
    return nothing();
  }
  if (parts.length === 6 && like === "like" && (method === "PUT" || method === "DELETE")) {
    found.likedByMe = method === "PUT";
    return Response.json(found);
  }
  return undefined;
}

/** A couplet already in the divan is a 200 with it and changes nothing; a new one is a 201, and puts the line «… به دیوان مشترک اضافه کرد» in the chat. */
function addItem(divan: Divan, given: Record<string, unknown>, world: MessagesWorld): Response {
  const key = String(given.key ?? "");
  const known = divan.items.find((one) => one.key === key);
  if (known) return Response.json(known);
  const added: Item = { id: world.nextId("item"), key, note: typeof given.note === "string" ? given.note : null, addedByMe: true, createdAt: new Date().toISOString(), likedByMe: false, likedByThem: false };
  divan.items = [added, ...divan.items];
  const chat = world.chats.get(divan.username) ?? [];
  world.chats.set(divan.username, [line(world.nextId("sys"), divan.username, "system", { event: "divan_add", key }, added.createdAt, true), ...chat]);
  return Response.json(added, { status: 201 });
}
