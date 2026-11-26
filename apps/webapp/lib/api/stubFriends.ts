import { normalizeUsername } from "../account/usernameRules";
import { TehranDay } from "../games/tehranDay";

// What the debug server answers for friends, friend requests, blocking, reports, the leaderboard and the feed (Debug/FriendsBackend.swift of the phone): friends
// sara, kian and mahsa and the demo friend «یه بیت»; two requests waiting for the account (آرین, بردیا), one it sent (پریا), and رها with nothing yet. The requests
// and friendships move as on the server, for each debug account on its own.

type Friendship = "none" | "requested" | "incoming" | "friends";
type Person = { username: string; displayName: string; avatar: Record<string, string> | null; canPlay?: false };

const face = (skin: string, hair: string, background: string) => ({ face: skin, eyes: "round", hair, mouth: "smile", accessory: "none", background });

const people: readonly Person[] = [
  { username: "sara.ghazal", displayName: "سارا", avatar: face("peach", "dark", "rose") },
  { username: "kian_k", displayName: "کیان", avatar: face("sand", "fire", "sun") },
  { username: "mahsa.m", displayName: "مهسا", avatar: face("tan", "black", "lapis") },
  { username: "aryan", displayName: "آرین", avatar: face("sand", "black", "mint") },
  { username: "bardia", displayName: "بردیا", avatar: face("peach", "amber", "sun") },
  { username: "paria", displayName: "پریا", avatar: face("tan", "dark", "mint") },
  { username: "raha", displayName: "رها", avatar: face("ivory", "lapis", "sky") },
  /** The demo friend: found and listed like anyone, but it cannot play, and a request to it is accepted at once. */
  { username: "yebeyt", displayName: "یه بیت", avatar: null, canPlay: false },
];

const person = (username: string): Person | undefined => people.find((one) => one.username === username);

/** Who the account is a friend of, who asked it and whom it asked, in the order the server lists them (the requests newest first), and whom it blocked. */
export class World {
  friends = new Set(["yebeyt", "sara.ghazal", "kian_k", "mahsa.m"]);
  received = ["aryan", "bardia"];
  sent = ["paria"];
  blocked = new Set<string>();

  state(username: string): Friendship {
    return this.friends.has(username) ? "friends" : this.received.includes(username) ? "incoming" : this.sent.includes(username) ? "requested" : "none";
  }

  /** Sends a request; one they sent is accepted instead, and the demo friend accepts at once. */
  send(username: string): Friendship {
    if (this.friends.has(username)) return "friends";
    if (this.received.includes(username) || username === "yebeyt") {
      this.accept(username);
      return "friends";
    }
    if (!this.sent.includes(username)) this.sent.push(username);
    return "requested";
  }

  accept(username: string): void {
    this.received = this.received.filter((one) => one !== username);
    this.friends.add(username);
  }

  /** Takes every tie away: a request, a friendship, and then the person is blocked. */
  block(username: string): void {
    this.received = this.received.filter((one) => one !== username);
    this.sent = this.sent.filter((one) => one !== username);
    this.friends.delete(username);
    this.blocked.add(username);
  }
}

const error = (status: number, code: string) => Response.json({ error: code }, { status });
const nothing = () => new Response(null, { status: 204 });
const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

/** The account that asks: how its own row and profile read. */
export type Me = { username: string | null; displayName: string | null; avatar: unknown };

type Call = { method: string; pathname: string; search: URLSearchParams; given: Record<string, unknown>; world: World; me: Me; mine: ReadonlySet<string> };

/** How the account stands with people, in the shape of the contract. */
const found = (one: Person, world: World) => ({ ...one, canPlay: one.canPlay ?? true, friendship: world.state(one.username), isFriend: world.state(one.username) === "friends" });

const row = (rank: number, one: { username: string | null; displayName: string | null; avatar: unknown }, points: number, isMe = false) => ({ rank, username: one.username, displayName: one.displayName, avatar: one.avatar, points, isMe, hidden: false });

const points: Record<string, number> = { "sara.ghazal": 2640, kian_k: 2310, "mahsa.m": 2090, aryan: 2910, bardia: 1950, paria: 1720, raha: 1610 };

/** The standings: the people ordered by points, the account's own row among them (2480). */
function standings(names: readonly string[], me: Call["me"]) {
  const rows = [...names.map((name) => ({ one: person(name)!, points: points[name]!, isMe: false })), { one: me, points: 2480, isMe: true }].sort((a, b) => b.points - a.points);
  return rows.map(({ one, points: score, isMe }, index) => row(index + 1, one, score, isMe));
}

const league = (call: Call) => {
  const rows = standings(["aryan", "sara.ghazal", "kian_k", "mahsa.m", "bardia", "paria", "raha"].filter((name) => !call.world.blocked.has(name)), call.me);
  rows.push({ rank: rows.length + 1, username: null, displayName: null, avatar: null, points: 1500, isMe: false, hidden: true });
  return { week: "2026-W47", tier: 2, endsAt: new Date(Date.now() + 2.6 * 86_400_000).toISOString(), rows, promoteCount: 5, demoteCount: 5 };
};

const feed = ({ world }: Call) => {
  const today = TehranDay.of(new Date()).key;
  const items = [
    { type: "repost", user: person("kian_k"), key: "/hafez/ghazal/sh3#0", at: hoursAgo(1.1) },
    { type: "daily", user: person("sara.ghazal"), date: today, tries: 2, at: hoursAgo(1 / 6) },
    { type: "like", user: person("mahsa.m"), key: "/hafez/ghazal/sh1#2", at: hoursAgo(2) },
  ].filter((item) => world.state(item.user!.username) === "friends");
  return { items: items.map((item) => ({ ...item, user: { username: item.user!.username, displayName: item.user!.displayName, avatar: item.user!.avatar } })), nextCursor: null };
};

/** Four likes and two reposts for each couplet asked, and the account's own on top. */
const counts = ({ search, mine }: Call) =>
  Object.fromEntries(
    (search.get("keys") ?? "").split(",").filter(Boolean).map((key) => [key, { likes: 4 + Number(mine.has(`like|${key}`)), reposts: 2 + Number(mine.has(`repost|${key}`)), likedByMe: mine.has(`like|${key}`), repostedByMe: mine.has(`repost|${key}`) }]),
  );

function profile(name: string, call: Call): Response {
  if (name === call.me.username) return Response.json({ ...call.me, friendsCount: call.world.friends.size, friendship: "none", isFriend: false, canMessage: false, league: { tier: 2 }, weekPoints: 2480 });
  const one = person(name);
  if (!one || call.world.blocked.has(name)) return error(404, "not_found");
  const state = call.world.state(name);
  return Response.json({ username: one.username, displayName: one.displayName, avatar: one.avatar, friendsCount: one.canPlay === false ? 0 : 12, friendship: state, isFriend: state === "friends", canMessage: state === "friends", league: { tier: 2 }, weekPoints: points[name] ?? null });
}

/** One friend action on `name`. */
function act(kind: string, name: string, { world, me }: Call): Response {
  if (name === me.username) return error(400, "invalid_request");
  if (!person(name) || world.blocked.has(name)) return error(404, "not_found");
  switch (kind) {
    case "send":
      return Response.json({ friendship: world.send(name) });
    case "accept":
      world.accept(name);
      return Response.json({ friendship: "friends" });
    case "reject":
      world.received = world.received.filter((one) => one !== name);
      return nothing();
    case "cancel":
      world.sent = world.sent.filter((one) => one !== name);
      return nothing();
    default:
      world.friends.delete(name);
      return nothing();
  }
}

const requests = (names: readonly string[]) => ({ items: names.map((name, index) => ({ ...person(name)!, createdAt: hoursAgo(index + 1) })), nextCursor: null });

const reportReasons = ["spam", "abuse", "other"];

/** The answer for a call of friends; undefined for a path that is not theirs. */
export function friendsAnswer(call: Call): Response | undefined {
  const { method, pathname, search, given, world } = call;
  const route = `${method} ${pathname}`;
  const [, , first, second, third] = pathname.split("/");
  switch (route) {
    case "GET /v1/users/search": {
      const query = normalizeUsername(search.get("q") ?? "").replace(/^@/, "");
      if ([...query].length < 2) return error(400, "invalid_request");
      return Response.json({ items: people.filter((one) => one.username.startsWith(query) && !world.blocked.has(one.username)).map((one) => found(one, world)) });
    }
    case "GET /v1/me/friends":
      return Response.json({ items: [...world.friends].map((name) => person(name)!).map(({ username, displayName, avatar, canPlay = true }) => ({ username, displayName, avatar, canPlay })), nextCursor: null });
    case "GET /v1/me/friend-requests":
      return Response.json(requests(search.get("direction") === "outgoing" ? world.sent : world.received));
    case "GET /v1/me/unread":
      return Response.json({ total: 0, friendRequests: world.received.length });
    case "POST /v1/reports":
      return reportReasons.includes(String(given.reason)) && typeof given.username === "string" ? nothing() : error(400, "invalid_request");
    case "GET /v1/leaderboard/league":
      return Response.json(league(call));
    case "GET /v1/leaderboard/friends":
      return Response.json({ week: "2026-W47", rows: standings(["sara.ghazal", "kian_k", "mahsa.m"].filter((name) => world.friends.has(name)), call.me) });
    case "GET /v1/leaderboard/global":
      return Response.json({ week: "2026-W47", rows: [row(1, person("sara.ghazal")!, 9120), row(2, person("kian_k")!, 8800), row(3, person("mahsa.m")!, 8410)], me: row(42, call.me, 2480, true), nextCursor: null });
    case "GET /v1/feed":
      return Response.json(feed(call));
    case "GET /v1/reactions/counts":
      return Response.json(counts(call));
  }
  if (!first || !second) return undefined;
  if (method === "GET" && first === "users") return profile(second, call);
  if (first === "friend-requests" && third === undefined && method === "POST") return act("send", second, call);
  if (first === "friend-requests" && third === undefined && method === "DELETE") return act("cancel", second, call);
  if (first === "friend-requests" && method === "POST" && (third === "accept" || third === "reject")) return act(third, second, call);
  if (first === "friends" && method === "DELETE") return act("unfriend", second, call);
  if (first === "blocks" && method === "PUT") {
    if (!person(second)) return error(404, "not_found");
    world.block(second);
    return nothing();
  }
  return undefined;
}
