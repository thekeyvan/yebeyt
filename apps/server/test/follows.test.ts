import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const follow = (token: string, username: string) => h.request(`/v1/follows/${username}`, { method: "PUT", token });
const unfollow = (token: string, username: string) => h.request(`/v1/follows/${username}`, { method: "DELETE", token });
const list = async (token: string, what: "following" | "followers" | "friends", cursor?: string) => {
  const res = await h.request(`/v1/me/${what}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { token });
  expect(res.status).toBe(200);
  return (await res.json()) as { items: { username: string; displayName: string | null; avatar: unknown; isFriend: boolean }[]; nextCursor: string | null };
};
const names = (page: { items: { username: string }[] }) => page.items.map((i) => i.username);

describe("follows", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/follows/ali", { method: "PUT" })).status).toBe(401);
    expect((await h.request("/v1/follows/ali", { method: "DELETE" })).status).toBe(401);
    for (const what of ["following", "followers", "friends"]) expect((await h.request(`/v1/me/${what}`)).status).toBe(401);
  });

  it("follows by username, ignoring case, and says whether they are friends", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    let res = await follow(ali.token, "SARA");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isFollowing: true, followsYou: false, isFriend: false });
    res = await follow(sara.token, "ali");
    expect(await res.json()).toEqual({ isFollowing: true, followsYou: true, isFriend: true });
  });

  it("is idempotent, for follow and unfollow", async () => {
    const ali = await h.signUp("ali");
    await h.signUp("sara");
    expect((await follow(ali.token, "sara")).status).toBe(200);
    expect((await follow(ali.token, "sara")).status).toBe(200);
    expect(names(await list(ali.token, "following"))).toEqual(["sara"]);
    expect(await (await unfollow(ali.token, "sara")).json()).toEqual({ isFollowing: false, followsYou: false, isFriend: false });
    expect((await unfollow(ali.token, "sara")).status).toBe(200);
    expect(names(await list(ali.token, "following"))).toEqual([]);
  });

  it("answers 404 for an unknown username and 400 for yourself", async () => {
    const ali = await h.signUp("ali");
    const unknown = await follow(ali.token, "nobody");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "not_found" });
    expect((await unfollow(ali.token, "nobody")).status).toBe(404);
    const self = await follow(ali.token, "ali");
    expect(self.status).toBe(400);
    expect(await self.json()).toEqual({ error: "invalid_request" });
  });

  it("needs a username of your own to follow", async () => {
    await h.signUp("sara");
    const nameless = await h.signIn("g-nameless");
    const res = await follow(nameless.accessToken, "sara");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "username_required" });
  });

  it("lists who I follow and who follows me, with isFriend, display name and avatar", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const reza = await h.signUp("reza");
    const avatar = { face: "f1", eyes: "e1", hair: "h1", mouth: "m1", accessory: "a1", background: "b1" };
    await h.request("/v1/me/avatar", { method: "PUT", token: sara.token, json: avatar });
    await follow(ali.token, "sara");
    h.clock.time = new Date(h.clock.time.getTime() + 1000);
    await follow(ali.token, "reza");
    await follow(sara.token, "ali");

    const following = await list(ali.token, "following");
    expect(following.items).toEqual([
      { username: "reza", displayName: null, avatar: null, isFriend: false },
      { username: "sara", displayName: "سارا", avatar, isFriend: true },
    ]);
    expect(following.nextCursor).toBeNull();
    expect((await list(ali.token, "followers")).items).toEqual([{ username: "sara", displayName: "سارا", avatar, isFriend: true }]);
    expect(names(await list(reza.token, "followers"))).toEqual(["ali"]);
    expect((await list(reza.token, "followers")).items[0]!.isFriend).toBe(false);
  });

  it("lists friends: only mutual follows", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await follow(ali.token, "sara");
    await follow(sara.token, "ali");
    await follow(ali.token, "reza");
    expect(names(await list(ali.token, "friends"))).toEqual(["sara"]);
    expect(names(await list(sara.token, "friends"))).toEqual(["ali"]);
    expect(names(await list(reza.token, "friends"))).toEqual([]);
    await unfollow(sara.token, "ali");
    expect(names(await list(ali.token, "friends"))).toEqual([]);
  });

  it("pages 50 at a time, newest first, with a cursor", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 53; i++) {
      // Each follow gets its own second, so the order is known.
      await h.db.execute(sql`
        with u as (insert into users (username) values (${`user${i}`}) returning id)
        insert into follows (follower_id, followee_id, created_at)
        select ${ali.id}::uuid, u.id, ${new Date(Date.UTC(2026, 5, 1, 12, 0, i)).toISOString()}::timestamptz from u`);
    }
    const pageOne = await list(ali.token, "following");
    expect(pageOne.items).toHaveLength(50);
    expect(pageOne.nextCursor).not.toBeNull();
    const pageTwo = await list(ali.token, "following", pageOne.nextCursor!);
    expect(pageTwo.items).toHaveLength(3);
    expect(pageTwo.nextCursor).toBeNull();
    expect(new Set([...names(pageOne), ...names(pageTwo)]).size).toBe(53);
    expect(names(pageOne)[0]).toBe("user52");
    expect(names(pageTwo)).toEqual(["user2", "user1", "user0"]);
  });

  it("keeps follows with the same timestamp: no row is skipped between pages", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 60; i++) {
      await h.db.execute(sql`
        with u as (insert into users (username) values (${`same${i}`}) returning id)
        insert into follows (follower_id, followee_id, created_at) select ${ali.id}::uuid, u.id, '2026-06-01T12:00:00Z' from u`);
    }
    const one = await list(ali.token, "following");
    const two = await list(ali.token, "following", one.nextCursor!);
    expect(new Set([...names(one), ...names(two)]).size).toBe(60);
  });

  it("rejects a malformed cursor", async () => {
    const ali = await h.signUp("ali");
    for (const cursor of ["x", "2026-02-30T00:00:00.000Z_00000000-0000-4000-8000-000000000000", "2026-06-01T12:00:00.000Z_nope"]) {
      expect((await h.request(`/v1/me/following?cursor=${cursor}`, { token: ali.token })).status).toBe(400);
    }
  });

  it("stops listing a user after they delete their account", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await follow(ali.token, "sara");
    await follow(sara.token, "ali");
    expect((await h.request("/v1/me", { method: "DELETE", token: sara.token })).status).toBe(204);
    expect(names(await list(ali.token, "following"))).toEqual([]);
    expect(names(await list(ali.token, "followers"))).toEqual([]);
  });
});
