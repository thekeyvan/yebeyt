import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { friendRequests, friendships, identities, messages, reports, sessions, users } from "../src/db/schema.js";
import { createHouse, HOUSE_COUPLETS } from "../src/house.js";
import type { LiveEvent } from "../src/hub.js";
import { houseSeedSql, makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type User = { token: string; id: string; username: string };
type Msg = { id: string; kind: string; fromMe: boolean; text: string | null; key: string | null };

const houseId = async () => (await h.db.select({ id: users.id }).from(users).where(eq(users.isHouse, true)))[0]!.id;
/** Opens the chat with «یه بیت» after asking it to be friends (messages come from friends only until the person says otherwise). */
const chat = async (u: User) => {
  await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: u.token });
  const res = await h.request("/v1/conversations", { method: "POST", token: u.token, json: { username: "yebeyt" } });
  expect(res.status).toBeLessThan(300);
  return ((await res.json()) as { id: string }).id;
};
const post = (u: User, id: string, json: unknown) => h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: u.token, json });
const say = (u: User, id: string, text = "salam") => post(u, id, { clientId: randomUUID(), kind: "text", text });
const items = async (u: User, id: string) => ((await (await h.request(`/v1/conversations/${id}/messages`, { token: u.token })).json()) as { items: Msg[] }).items;
const replies = async (u: User, id: string) => (await items(u, id)).filter((m) => !m.fromMe).reverse();
const wait = (ms: number) => (h.clock.time = new Date(h.clock.time.getTime() + ms));
const listen = (u: User) => {
  const events: LiveEvent[] = [];
  h.deps.hub.add(u.id, (e) => events.push(e));
  return events;
};
const unread = async (u: User) => ((await (await h.request("/v1/me/unread", { token: u.token })).json()) as { total: number }).total;

describe("the built-in account", () => {
  it("is one user with the flag, a plain name and no way in", async () => {
    const all = await h.db.select().from(users).where(eq(users.isHouse, true));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ username: "yebeyt", displayName: "یه بیت", avatar: null });
    expect(await h.db.select().from(identities).where(eq(identities.userId, all[0]!.id))).toEqual([]);
    expect(await h.db.select().from(sessions).where(eq(sessions.userId, all[0]!.id))).toEqual([]);
  });

  it("is made by a migration that can run again without a second copy", async () => {
    await h.db.execute(sql.raw(houseSeedSql()));
    await h.db.execute(sql.raw(houseSeedSql()));
    expect(await h.db.select({ id: users.id }).from(users).where(eq(users.username, "yebeyt"))).toHaveLength(1);
    expect(await h.db.select({ id: users.id }).from(users).where(eq(users.isHouse, true))).toHaveLength(1);
    await expect(h.db.insert(users).values({ username: "other_house", isHouse: true })).rejects.toThrow();
  });

  it("gets no session from any sign-in or refresh", async () => {
    const id = await houseId();
    for (const sub of ["yebeyt", id, "house", ""]) {
      for (const provider of ["google", "apple"] as const) {
        const res =
          provider === "google"
            ? await h.request("/v1/auth/google", { method: "POST", json: { idToken: await h.googleToken(sub || "x") } })
            : await h.request("/v1/auth/apple", { method: "POST", json: { identityToken: await h.appleToken(sub || "x"), nonce: "test-nonce" } });
        if (res.status === 200) expect(((await res.json()) as { user: { id: string } }).user.id).not.toBe(id);
      }
    }
    expect((await h.request("/v1/auth/refresh", { method: "POST", json: { refreshToken: "x".repeat(43) } })).status).toBe(401);
    expect(await h.db.select().from(sessions).where(eq(sessions.userId, id))).toEqual([]);
  });

  it("is found by search and has a plain public profile", async () => {
    const ali = await h.signUp("ali");
    const found = await h.request("/v1/users/search?q=yeb", { token: ali.token });
    expect(await found.json()).toEqual({ items: [{ username: "yebeyt", displayName: "یه بیت", avatar: null, canPlay: false, friendship: "none", isFriend: false }] });
    const profile = await h.request("/v1/users/yebeyt", { token: ali.token });
    expect(await profile.json()).toMatchObject({ username: "yebeyt", displayName: "یه بیت", friendsCount: 0, friendship: "none", canMessage: false, league: null });
  });

  it("says it can't play in the friends list and in search, and everyone else can", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    await h.request("/v1/friend-requests/sara", { method: "POST", token: ali.token });
    await h.request("/v1/friend-requests/ali", { method: "POST", token: sara.token });
    const friends = (await (await h.request("/v1/me/friends", { token: ali.token })).json()) as { items: { username: string; canPlay: boolean }[] };
    expect(friends.items.map((p) => [p.username, p.canPlay]).sort()).toEqual([["sara", true], ["yebeyt", false]]);
    const found = (await (await h.request("/v1/users/search?q=sa", { token: ali.token })).json()) as { items: { canPlay: boolean }[] };
    expect(found.items.map((p) => p.canPlay)).toEqual([true]);
  });

  it("says it can't play in the chat it opens and in the chat list, and everyone else can", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    const opened = await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "yebeyt" } });
    const house = (await opened.json()) as { id: string; other: { canPlay: boolean } };
    expect(house.other.canPlay).toBe(false);
    await h.request("/v1/friend-requests/sara", { method: "POST", token: ali.token });
    await h.request("/v1/friend-requests/ali", { method: "POST", token: sara.token });
    const withSara = await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "sara" } });
    const friend = (await withSara.json()) as { id: string; other: { canPlay: boolean } };
    expect(friend.other.canPlay).toBe(true);
    await say(ali, house.id);
    await say(ali, friend.id);
    const list = (await (await h.request("/v1/conversations", { token: ali.token })).json()) as { items: { other: { username: string; canPlay: boolean } }[] };
    expect(list.items.map((i) => [i.other.username, i.other.canPlay]).sort()).toEqual([["sara", true], ["yebeyt", false]]);
  });

  it("shows no friends count, though everyone may be its friend", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    for (const u of [ali, sara]) await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: u.token });
    const profile = await h.request("/v1/users/yebeyt", { token: sara.token });
    expect(await profile.json()).toMatchObject({ friendsCount: 0, friendship: "friends" });
  });

  it("has a fixed list of 30 different couplets that the game data knows", () => {
    expect(HOUSE_COUPLETS).toHaveLength(30);
    expect(new Set(HOUSE_COUPLETS).size).toBe(30);
    for (const key of HOUSE_COUPLETS) expect(h.deps.data.byKey.has(key), key).toBe(true);
  });
});

describe("a friend request to it", () => {
  it("is accepted at once, with the live event and the friendship", async () => {
    const ali = await h.signUp("ali");
    const events = listen(ali);
    const res = await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ friendship: "friends" });
    expect(events).toEqual([{ type: "friend.accepted", from: { username: "yebeyt", displayName: "یه بیت", avatar: null } }]);
    const list = (await (await h.request("/v1/me/friends", { token: ali.token })).json()) as { items: { username: string }[] };
    expect(list.items.map((p) => p.username)).toEqual(["yebeyt"]);
    expect(await h.db.select().from(friendRequests)).toEqual([]);
    expect(await h.db.select().from(friendships)).toHaveLength(1);
    // asking again changes nothing
    expect(await (await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token })).json()).toEqual({ friendship: "friends" });
    expect(await h.db.select().from(friendships)).toHaveLength(1);
  });

  it("is not accepted for someone who blocked it", async () => {
    const ali = await h.signUp("ali");
    await h.request("/v1/blocks/yebeyt", { method: "PUT", token: ali.token });
    expect((await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token })).status).toBe(404);
    expect(await h.db.select().from(friendships)).toEqual([]);
  });
});

describe("its reply to a message", () => {
  it("is a couplet from the list, after one to two seconds, to a text", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    const events = listen(ali);
    expect((await say(ali, id)).status).toBe(201);
    expect(h.houseTimers).toHaveLength(1);
    expect(h.houseTimers[0]!.ms).toBeGreaterThanOrEqual(1000);
    expect(h.houseTimers[0]!.ms).toBeLessThanOrEqual(2000);
    expect(await replies(ali, id)).toEqual([]);
    wait(1500);
    expect(await h.flushHouse()).toHaveLength(1);
    const [reply] = await replies(ali, id);
    expect(reply).toMatchObject({ kind: "couplet", fromMe: false, text: null });
    expect(HOUSE_COUPLETS).toContain(reply!.key);
    expect(events.filter((e) => e.type === "message")).toHaveLength(2); // mine, then theirs
    expect(await unread(ali)).toBe(1);
  });

  it("answers a couplet too, once for each message", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    await post(ali, id, { clientId: randomUUID(), kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "bokhun" });
    wait(3000);
    await h.flushHouse();
    await say(ali, id);
    wait(3000);
    await h.flushHouse();
    expect(await replies(ali, id)).toHaveLength(2);
    // sending the same message again is not a new message
    const same = randomUUID();
    await post(ali, id, { clientId: same, kind: "text", text: "x" });
    await post(ali, id, { clientId: same, kind: "text", text: "x" });
    expect(h.houseTimers).toHaveLength(1);
  });

  it("never repeats its previous reply", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    const always0 = createHouse(h.deps, { later: (run, ms) => h.houseTimers.push({ run, ms }), pick: () => 0 });
    h.deps.house = always0;
    for (let i = 0; i < 6; i++) {
      await say(ali, id);
      wait(3000);
      await h.flushHouse();
    }
    const keys = (await replies(ali, id)).map((m) => m.key);
    expect(keys).toHaveLength(6);
    keys.forEach((k, i) => i > 0 && expect(k).not.toBe(keys[i - 1]));
    expect(HOUSE_COUPLETS).toEqual(expect.arrayContaining(keys as string[]));
  });

  it("does not reply to someone who blocked it, and does after they unblock", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    await say(ali, id);
    await h.request("/v1/blocks/yebeyt", { method: "PUT", token: ali.token });
    wait(1500);
    await h.flushHouse(); // blocked while the reply was waiting
    expect(await h.db.select().from(messages).where(eq(messages.senderId, await houseId()))).toEqual([]);
    expect((await say(ali, id)).status).toBe(403);
    expect(h.houseTimers).toHaveLength(0);
    await h.request("/v1/blocks/yebeyt", { method: "DELETE", token: ali.token });
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token }); // blocking ended the friendship
    wait(3000);
    expect((await say(ali, id)).status).toBe(201);
    wait(1500);
    await h.flushHouse();
    expect(await h.db.select().from(messages).where(eq(messages.senderId, await houseId()))).toHaveLength(1);
  });

  it("is silent past one reply in two seconds", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    await say(ali, id);
    wait(1000);
    await say(ali, id);
    expect(h.houseTimers).toHaveLength(1);
    wait(1000);
    await say(ali, id);
    expect(h.houseTimers).toHaveLength(2);
  });

  it("is silent past 30 replies a day for one person, and starts again the next day", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const id = await chat(ali);
    const saraChat = await chat(sara);
    for (let i = 0; i < 30; i++) {
      wait(3000);
      await say(ali, id);
    }
    expect(h.houseTimers).toHaveLength(30);
    h.houseTimers.length = 0;
    wait(3000);
    expect((await say(ali, id)).status).toBe(201);
    expect(h.houseTimers).toHaveLength(0);
    await say(sara, saraChat); // others have their own count
    expect(h.houseTimers).toHaveLength(1);
    wait(24 * 3600_000);
    const later = { ...ali, token: (await h.signIn("g-ali")).accessToken }; // the old token has expired
    await say(later, id);
    expect(h.houseTimers).toHaveLength(2);
  });

  it("is dropped and logged when it fails, and the sender is not told", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    h.deps.house = createHouse(h.deps, {
      later: (run, ms) => h.houseTimers.push({ run, ms }),
      pick: () => {
        throw new Error("boom");
      },
    });
    expect((await say(ali, id)).status).toBe(201);
    wait(1500);
    await expect(h.flushHouse()).resolves.toHaveLength(1);
    expect(h.logs).toContain("house reply failed");
    expect(await h.db.select().from(messages).where(eq(messages.senderId, await houseId()))).toEqual([]);
  });

  it("does not come from messages between other people", async () => {
    const ali = await h.signUp("ali");
    await h.signUp("sara");
    const res = await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "sara" } });
    await say(ali, ((await res.json()) as { id: string }).id);
    expect(h.houseTimers).toHaveLength(0);
  });
});

describe("it stays out of", () => {
  it("the leaderboards, the leagues, the feed and the daily results", async () => {
    const ali = await h.signUp("ali");
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    await h.request("/v1/me/privacy", { method: "PUT", token: ali.token, json: { inGlobalLeaderboard: true } });
    await h.request("/v1/scores", { method: "POST", token: ali.token, json: { roundId: randomUUID(), game: "poet", points: 50, playedAt: h.clock.time.toISOString() } });
    const rows = async (path: string) => ((await (await h.request(path, { token: ali.token })).json()) as { rows: { username: string | null }[] }).rows.map((r) => r.username);
    expect(await rows("/v1/leaderboard/friends")).toEqual(["ali"]);
    expect(await rows("/v1/leaderboard/global")).toEqual(["ali"]);
    expect(await rows("/v1/leaderboard/league")).toEqual(["ali"]);
    expect(await (await h.request("/v1/feed", { token: ali.token })).json()).toEqual({ items: [], nextCursor: null });
    const daily = await h.request("/v1/daily/2026-06-01/friends", { token: ali.token });
    expect(await daily.json()).toEqual({ solvedCount: 0, friends: [] });
  });
});

describe("game invitations", () => {
  it("skip it like a person who cannot be invited", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.befriend(ali, sara);
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    const res = await h.request("/v1/games", { method: "POST", token: ali.token, json: { kind: "mosh", turnSeconds: 30, invite: ["yebeyt", "sara"] } });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ invited: ["sara"], skipped: [{ username: "yebeyt", reason: "not_found" }] });
    expect(await h.db.select().from(messages).where(eq(messages.kind, "game"))).toHaveLength(1);
  });
});

describe("safety and accounts", () => {
  it("takes a report like any user's, in the normal table", async () => {
    const ali = await h.signUp("ali");
    const id = await chat(ali);
    await say(ali, id);
    wait(1500);
    await h.flushHouse();
    const [reply] = await replies(ali, id);
    const res = await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "yebeyt", messageId: reply!.id, reason: "spam" } });
    expect(res.status).toBe(204);
    expect(await h.db.select().from(reports).where(eq(reports.targetUserId, await houseId()))).toHaveLength(1);
  });

  it("goes with a deleted account's friendship and chat, and stays itself", async () => {
    const ali = await h.signUp("ali");
    await h.request("/v1/friend-requests/yebeyt", { method: "POST", token: ali.token });
    const id = await chat(ali);
    await say(ali, id);
    wait(1500);
    await h.flushHouse();
    expect((await h.request("/v1/me", { method: "DELETE", token: ali.token })).status).toBe(204);
    expect(await h.db.select().from(friendships)).toEqual([]);
    expect(await h.db.select().from(messages).where(eq(messages.senderId, await houseId()))).toEqual([]);
    expect(await h.db.select({ id: users.id }).from(users).where(eq(users.isHouse, true))).toHaveLength(1);
  });
});
