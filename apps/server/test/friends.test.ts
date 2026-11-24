import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { LiveEvent } from "../src/hub.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const send = (token: string, username: string) => h.request(`/v1/friend-requests/${username}`, { method: "POST", token });
const cancel = (token: string, username: string) => h.request(`/v1/friend-requests/${username}`, { method: "DELETE", token });
const accept = (token: string, username: string) => h.request(`/v1/friend-requests/${username}/accept`, { method: "POST", token });
const reject = (token: string, username: string) => h.request(`/v1/friend-requests/${username}/reject`, { method: "POST", token });
const unfriend = (token: string, username: string) => h.request(`/v1/friends/${username}`, { method: "DELETE", token });
const state = async (token: string, username: string) => ((await (await h.request(`/v1/users/${username}`, { token })).json()) as { friendship: string }).friendship;
type Page = { items: { username: string; displayName: string | null; avatar: unknown }[]; nextCursor: string | null };
const requests = async (token: string, direction: "incoming" | "outgoing", cursor?: string) => {
  const res = await h.request(`/v1/me/friend-requests?direction=${direction}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { token });
  expect(res.status).toBe(200);
  return (await res.json()) as Page;
};
const friends = async (token: string) => {
  const res = await h.request("/v1/me/friends", { token });
  expect(res.status).toBe(200);
  return (await res.json()) as Page;
};
const names = (page: Page) => page.items.map((i) => i.username);
const unread = async (token: string) => (await (await h.request("/v1/me/unread", { token })).json()) as { total: number; friendRequests: number };
const listen = (userId: string) => {
  const events: LiveEvent[] = [];
  h.deps.hub.add(userId, (e) => events.push(e));
  return events;
};
const rows = async (table: "friendships" | "friend_requests") => ((await h.db.execute(sql.raw(`select * from ${table}`))) as unknown as { rows: unknown[] }).rows;

describe("friend requests", () => {
  it("require sign-in", async () => {
    expect((await h.request("/v1/friend-requests/ali", { method: "POST" })).status).toBe(401);
    expect((await h.request("/v1/friend-requests/ali", { method: "DELETE" })).status).toBe(401);
    expect((await h.request("/v1/friend-requests/ali/accept", { method: "POST" })).status).toBe(401);
    expect((await h.request("/v1/friend-requests/ali/reject", { method: "POST" })).status).toBe(401);
    expect((await h.request("/v1/friends/ali", { method: "DELETE" })).status).toBe(401);
    expect((await h.request("/v1/me/friend-requests?direction=incoming")).status).toBe(401);
    expect((await h.request("/v1/me/friends")).status).toBe(401);
  });

  it("need a username of your own", async () => {
    await h.signUp("sara");
    const token = (await h.signIn("g-nameless")).accessToken;
    for (const res of [await send(token, "sara"), await cancel(token, "sara"), await accept(token, "sara"), await reject(token, "sara"), await unfriend(token, "sara")]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "username_required" });
    }
    expect((await h.request("/v1/me/friend-requests?direction=incoming", { token })).status).toBe(403);
    expect((await h.request("/v1/me/friends", { token })).status).toBe(403);
  });

  it("sends a request by username, ignoring case; it shows on both pages and in the profiles", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const res = await send(ali.token, "SARA");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ friendship: "requested" });
    expect(await state(ali.token, "sara")).toBe("requested");
    expect(await state(sara.token, "ali")).toBe("incoming");
    expect(names(await requests(ali.token, "outgoing"))).toEqual(["sara"]);
    expect(names(await requests(sara.token, "incoming"))).toEqual(["ali"]);
    expect(names(await requests(ali.token, "incoming"))).toEqual([]);
    expect(names(await requests(sara.token, "outgoing"))).toEqual([]);
    expect(await friends(ali.token)).toEqual({ items: [], nextCursor: null });
  });

  it("lists the person with name and avatar, newest first", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const reza = await h.signUp("reza");
    const avatar = { face: "f1", eyes: "e1", hair: "h1", mouth: "m1", accessory: "a1", background: "b1" };
    await h.request("/v1/me/avatar", { method: "PUT", token: sara.token, json: avatar });
    await send(sara.token, "ali");
    h.clock.time = new Date(h.clock.time.getTime() + 1000);
    await send(reza.token, "ali");
    const page = await requests(ali.token, "incoming");
    expect(page.items).toEqual([
      { username: "reza", displayName: null, avatar: null, createdAt: "2026-06-01T12:00:01.000Z" },
      { username: "sara", displayName: "سارا", avatar, createdAt: "2026-06-01T12:00:00.000Z" },
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("is idempotent: a second request changes nothing", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const events = listen(sara.id);
    expect((await send(ali.token, "sara")).status).toBe(200);
    const again = await send(ali.token, "sara");
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ friendship: "requested" });
    expect(names(await requests(ali.token, "outgoing"))).toEqual(["sara"]);
    expect(events).toHaveLength(1);
  });

  it("answers 404 for an unknown username and 400 for yourself", async () => {
    const ali = await h.signUp("ali");
    for (const call of [send, cancel, accept, reject, unfriend]) {
      const res = await call(ali.token, "nobody");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
    for (const call of [send, cancel, accept, reject, unfriend]) {
      const res = await call(ali.token, "ali");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });

  it("accepting makes friends; both see it, and the request is gone", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(ali.token, "sara");
    const res = await accept(sara.token, "ali");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ friendship: "friends" });
    expect(await state(ali.token, "sara")).toBe("friends");
    expect(await state(sara.token, "ali")).toBe("friends");
    expect(names(await friends(ali.token))).toEqual(["sara"]);
    expect(names(await friends(sara.token))).toEqual(["ali"]);
    expect(names(await requests(sara.token, "incoming"))).toEqual([]);
    expect(names(await requests(ali.token, "outgoing"))).toEqual([]);
    expect((await accept(sara.token, "ali")).status).toBe(200); // already friends: nothing to do
  });

  it("cannot accept a request nobody sent, nor one I sent myself", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    expect((await accept(sara.token, "ali")).status).toBe(404);
    await send(ali.token, "sara");
    expect((await accept(ali.token, "sara")).status).toBe(404);
    expect(await state(ali.token, "sara")).toBe("requested");
  });

  it("sending to someone who already asked me accepts at once", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const events = listen(ali.id);
    await send(ali.token, "sara");
    const res = await send(sara.token, "ali");
    expect(await res.json()).toEqual({ friendship: "friends" });
    expect(names(await friends(ali.token))).toEqual(["sara"]);
    expect(names(await requests(ali.token, "outgoing"))).toEqual([]);
    expect(events).toEqual([{ type: "friend.accepted", from: { username: "sara", displayName: null, avatar: null } }]);
  });

  it("sending to a friend is a 200 no-op", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.befriend(ali, sara);
    const res = await send(ali.token, "sara");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ friendship: "friends" });
    expect(await rows("friend_requests")).toEqual([]);
  });

  it("cancelling removes my request; it is idempotent and never touches a friendship", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(ali.token, "sara");
    expect((await cancel(ali.token, "sara")).status).toBe(204);
    expect((await cancel(ali.token, "sara")).status).toBe(204);
    expect(await state(sara.token, "ali")).toBe("none");
    await h.befriend(ali, sara);
    expect((await cancel(ali.token, "sara")).status).toBe(204);
    expect(await state(ali.token, "sara")).toBe("friends");
  });

  it("cancelling does not remove a request they sent me", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(sara.token, "ali");
    await cancel(ali.token, "sara");
    expect(await state(ali.token, "sara")).toBe("incoming");
  });

  it("rejecting is silent: the sender is not told and may ask again at once", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(ali.token, "sara");
    const events = listen(ali.id);
    expect((await reject(sara.token, "ali")).status).toBe(204);
    expect((await reject(sara.token, "ali")).status).toBe(204);
    expect(events).toEqual([]);
    expect(await state(ali.token, "sara")).toBe("none");
    expect(await state(sara.token, "ali")).toBe("none");
    expect((await send(ali.token, "sara")).status).toBe(200);
    expect(await state(sara.token, "ali")).toBe("incoming");
  });

  it("rejecting does not remove my own request, nor a friendship", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(ali.token, "sara");
    await reject(ali.token, "sara");
    expect(await state(ali.token, "sara")).toBe("requested");
    await accept(sara.token, "ali");
    await reject(ali.token, "sara");
    expect(await state(ali.token, "sara")).toBe("friends");
  });

  it("unfriending is silent and idempotent, and they may ask again", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.befriend(ali, sara);
    const events = listen(sara.id);
    expect((await unfriend(ali.token, "sara")).status).toBe(204);
    expect((await unfriend(ali.token, "sara")).status).toBe(204);
    expect(events).toEqual([]);
    expect(await state(ali.token, "sara")).toBe("none");
    expect(await state(sara.token, "ali")).toBe("none");
    expect(names(await friends(sara.token))).toEqual([]);
    expect((await send(sara.token, "ali")).status).toBe(200);
  });

  it("makes one friendship when both send at the same time", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const answers = await Promise.all([send(ali.token, "sara"), send(sara.token, "ali")]);
    expect(answers.map((r) => r.status)).toEqual([200, 200]);
    expect(await rows("friendships")).toHaveLength(1);
    expect(await rows("friend_requests")).toEqual([]);
  });

  it("lists friends newest first with a cursor, 50 a page", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 53; i++) {
      await h.db.execute(sql`
        with u as (insert into users (username) values (${`user${i}`}) returning id)
        insert into friendships (user_low, user_high, created_at)
        select least(${ali.id}::uuid, u.id), greatest(${ali.id}::uuid, u.id), ${new Date(Date.UTC(2026, 5, 1, 12, 0, i)).toISOString()}::timestamptz from u`);
    }
    const one = await friends(ali.token);
    expect(one.items).toHaveLength(50);
    expect(names(one)[0]).toBe("user52");
    const res = await h.request(`/v1/me/friends?cursor=${encodeURIComponent(one.nextCursor!)}`, { token: ali.token });
    const two = (await res.json()) as Page;
    expect(names(two)).toEqual(["user2", "user1", "user0"]);
    expect(two.nextCursor).toBeNull();
  });

  it("pages requests the same way, without skipping rows with the same time", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 60; i++) {
      await h.db.execute(sql`
        with u as (insert into users (username) values (${`same${i}`}) returning id)
        insert into friend_requests (from_id, to_id, created_at) select u.id, ${ali.id}::uuid, '2026-06-01T12:00:00Z' from u`);
    }
    const one = await requests(ali.token, "incoming");
    expect(one.items).toHaveLength(50);
    const two = await requests(ali.token, "incoming", one.nextCursor!);
    expect(new Set([...names(one), ...names(two)]).size).toBe(60);
    expect(two.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor and a missing or wrong direction", async () => {
    const ali = await h.signUp("ali");
    for (const cursor of ["x", "2026-02-30T00:00:00.000Z_00000000-0000-4000-8000-000000000000", "2026-06-01T12:00:00.000Z_nope"]) {
      expect((await h.request(`/v1/me/friend-requests?direction=incoming&cursor=${cursor}`, { token: ali.token })).status).toBe(400);
      expect((await h.request(`/v1/me/friends?cursor=${cursor}`, { token: ali.token })).status).toBe(400);
    }
    expect((await h.request("/v1/me/friend-requests", { token: ali.token })).status).toBe(400);
    expect((await h.request("/v1/me/friend-requests?direction=both", { token: ali.token })).status).toBe(400);
  });

  it("allows 30 new requests an hour per user, then 429, and counts only new ones", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 31; i++) await h.signUp(`pal${String(i).padStart(2, "0")}`);
    for (let i = 0; i < 30; i++) expect((await send(ali.token, `pal${String(i).padStart(2, "0")}`)).status).toBe(200);
    expect((await send(ali.token, "pal00")).status).toBe(200); // a repeat is no new request
    const over = await send(ali.token, "pal30");
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: "rate_limited" });
    expect(await state(ali.token, "pal30")).toBe("none");
    h.clock.time = new Date(h.clock.time.getTime() + 3_600_001);
    expect((await send((await h.signIn("g-ali")).accessToken, "pal30")).status).toBe(200); // the old token has expired by now
  });

  it("does not count an acceptance of a mutual request against the limit", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 30; i++) {
      const pal = await h.signUp(`pal${String(i).padStart(2, "0")}`);
      await send(pal.token, "ali");
    }
    for (let i = 0; i < 30; i++) expect((await send(ali.token, `pal${String(i).padStart(2, "0")}`)).status).toBe(200);
    expect((await friends(ali.token)).items).toHaveLength(30);
    await h.signUp("extra");
    expect((await send(ali.token, "extra")).status).toBe(200);
  });

  it("tells the receiver live, with who it is from", async () => {
    const ali = await h.signUp("ali", { displayName: "علی" });
    const sara = await h.signUp("sara");
    const avatar = { face: "f1", eyes: "e1", hair: "h1", mouth: "m1", accessory: "a1", background: "b1" };
    await h.request("/v1/me/avatar", { method: "PUT", token: ali.token, json: avatar });
    const events = listen(sara.id);
    await send(ali.token, "sara");
    expect(events).toEqual([{ type: "friend.request", from: { username: "ali", displayName: "علی", avatar } }]);
  });

  it("tells the sender live when the request is accepted", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    await send(ali.token, "sara");
    const events = listen(ali.id);
    await accept(sara.token, "ali");
    expect(events).toEqual([{ type: "friend.accepted", from: { username: "sara", displayName: "سارا", avatar: null } }]);
  });

  it("counts incoming requests in /v1/me/unread", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    expect(await unread(ali.token)).toEqual({ total: 0, friendRequests: 0 });
    await send(sara.token, "ali");
    await send(reza.token, "ali");
    await send(ali.token, "reza"); // mutual: accepted, no longer a request
    expect(await unread(ali.token)).toEqual({ total: 0, friendRequests: 1 });
    await reject(ali.token, "sara");
    expect(await unread(ali.token)).toEqual({ total: 0, friendRequests: 0 });
  });

  it("is refused between people who blocked each other (404), and blocking removes requests and friendships", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await h.befriend(ali, sara);
    await send(reza.token, "ali");
    expect(await rows("friend_requests")).toHaveLength(1);
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    await h.request("/v1/blocks/reza", { method: "PUT", token: ali.token });
    expect(await rows("friendships")).toEqual([]);
    expect(await rows("friend_requests")).toEqual([]);
    for (const [from, to] of [[ali, sara], [sara, ali], [ali, reza], [reza, ali]] as const) {
      expect((await send(from.token, to.username)).status).toBe(404);
      expect((await accept(from.token, to.username)).status).toBe(404);
    }
  });

  it("a block and a request at the same time never leave a request or friendship behind", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await send(sara.token, "ali");
    await Promise.all([h.request("/v1/blocks/sara", { method: "PUT", token: ali.token }), accept(ali.token, "sara"), send(sara.token, "ali")]);
    expect(await rows("friendships")).toEqual([]);
    expect(await rows("friend_requests")).toEqual([]);
  });

  it("removes a deleted account's requests and friendships", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const nima = await h.signUp("nima");
    await h.befriend(ali, sara);
    await send(reza.token, "sara");
    await send(sara.token, "nima");
    expect((await h.request("/v1/me", { method: "DELETE", token: sara.token })).status).toBe(204);
    expect(names(await friends(ali.token))).toEqual([]);
    expect(names(await requests(reza.token, "outgoing"))).toEqual([]);
    expect(names(await requests(nima.token, "incoming"))).toEqual([]);
  });
});
