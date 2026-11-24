import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const profile = (token: string, username: string) => h.request(`/v1/users/${username}`, { token });
const search = (token: string, q: string) => h.request(`/v1/users/search?q=${encodeURIComponent(q)}`, { token });
const score = (token: string, points: number) =>
  h.request("/v1/scores", { method: "POST", token, json: { roundId: randomUUID(), game: "poet", points, playedAt: h.clock.time.toISOString() } });
type User = { token: string; username: string };
const befriend = async (a: User, b: User) => {
  await h.befriend(a, b);
};

describe("GET /v1/users/{username}", () => {
  it("requires sign-in and answers 404 for an unknown name", async () => {
    expect((await h.request("/v1/users/ali")).status).toBe(401);
    const ali = await h.signUp("ali");
    const res = await profile(ali.token, "nobody");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("gives the public profile, ignoring the case of the name", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const avatar = { face: "f1", eyes: "e1", hair: "h1", mouth: "m1", accessory: "a1", background: "b1" };
    await h.request("/v1/me/avatar", { method: "PUT", token: sara.token, json: avatar });
    const res = await profile(ali.token, "SARA");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      username: "sara", displayName: "سارا", avatar, friendsCount: 0, friendship: "none", isFriend: false, canMessage: false, league: null, weekPoints: null,
    });
  });

  it("counts friends (accepted only) and shows where we stand", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const nima = await h.signUp("nima");
    await befriend(sara, reza);
    await befriend(sara, nima);
    await h.request("/v1/friend-requests/sara", { method: "POST", token: ali.token }); // pending
    const seen = await (await profile(ali.token, "sara")).json();
    expect(seen).toMatchObject({ friendsCount: 2, friendship: "requested", isFriend: false });
    expect(await (await profile(sara.token, "ali")).json()).toMatchObject({ friendship: "incoming", isFriend: false });
    await h.request("/v1/friend-requests/ali/accept", { method: "POST", token: sara.token });
    expect(await (await profile(ali.token, "sara")).json()).toMatchObject({ friendsCount: 3, friendship: "friends", isFriend: true });
    expect(await (await profile(sara.token, "ali")).json()).toMatchObject({ friendsCount: 1, friendship: "friends", isFriend: true });
  });

  describe("canMessage", () => {
    const open = (from: User, username: string) => h.request("/v1/conversations", { method: "POST", token: from.token, json: { username } });
    const write = (from: User, id: string, text: string) =>
      h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: from.token, json: { clientId: randomUUID(), kind: "text", text } });
    const can = async (viewer: User, username: string) => ((await (await profile(viewer.token, username)).json()) as { canMessage: boolean }).canMessage;

    it("follows «بهم پیام بده»: friends only by default, everyone when they say so, and never myself", async () => {
      const ali = await h.signUp("ali");
      const sara = await h.signUp("sara");
      expect(await can(ali, "sara")).toBe(false); // a stranger, and sara takes messages from friends
      await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "all" } });
      expect(await can(ali, "sara")).toBe(true);
      await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "friends" } });
      await befriend(ali, sara);
      expect(await can(ali, "sara")).toBe(true);
      expect(await can(ali, "ali")).toBe(false);
    });

    it("lets me answer someone who already wrote to me, as sending does", async () => {
      const ali = await h.signUp("ali");
      const sara = await h.signUp("sara");
      await befriend(ali, sara);
      const id = ((await (await open(sara, "ali")).json()) as { id: string }).id;
      await write(sara, id, "salam");
      await h.request("/v1/friends/ali", { method: "DELETE", token: sara.token });
      await h.request("/v1/friends/sara", { method: "DELETE", token: ali.token });
      expect(await can(ali, "sara")).toBe(true); // sara wrote here; ali answers even though sara takes friends only
      expect(await can(sara, "ali")).toBe(false); // ali has not written, and takes friends' messages only
    });

    it("is false when no chat allows it, and a block hides the person altogether", async () => {
      const ali = await h.signUp("ali");
      const sara = await h.signUp("sara");
      await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "all" } });
      expect(await can(ali, "sara")).toBe(true);
      await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
      expect((await profile(ali.token, "sara")).status).toBe(404);
      expect((await profile(sara.token, "ali")).status).toBe(404);
    });
  });

  it("shows the league tier like the points: to a friend or when they allow the global list, else null", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    expect((await (await profile(ali.token, "sara")).json()).league).toBeNull(); // not scored yet
    await score(sara.token, 50);
    await score(reza.token, 50);
    expect((await (await profile(ali.token, "sara")).json()).league).toBeNull(); // an opted-out stranger
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { inGlobalLeaderboard: true } });
    expect((await (await profile(ali.token, "sara")).json()).league).toEqual({ tier: 0 });
    await befriend(ali, reza);
    expect((await (await profile(ali.token, "reza")).json()).league).toEqual({ tier: 0 });
    await score(ali.token, 5);
    expect((await (await profile(ali.token, "ali")).json()).league).toEqual({ tier: 0 }); // yourself
  });

  it("gives the week's points to a friend, to yourself, and when they allow the global list; else null", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.signUp("reza");
    await score(sara.token, 70);
    await score(ali.token, 30);
    expect((await (await profile(ali.token, "sara")).json()).weekPoints).toBeNull();
    expect((await (await profile(ali.token, "ali")).json()).weekPoints).toBe(30);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { inGlobalLeaderboard: true } });
    expect((await (await profile(ali.token, "sara")).json()).weekPoints).toBe(70);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { inGlobalLeaderboard: false } });
    expect((await (await profile(ali.token, "sara")).json()).weekPoints).toBeNull();
    await befriend(ali, sara);
    expect((await (await profile(ali.token, "sara")).json()).weekPoints).toBe(70);
    expect((await (await profile(ali.token, "reza")).json()).weekPoints).toBeNull();
  });

  it("gives 0 points to someone who allows it but has not scored", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { inGlobalLeaderboard: true } });
    expect((await (await profile(ali.token, "sara")).json()).weekPoints).toBe(0);
  });
});

describe("GET /v1/users/search", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/users/search?q=al")).status).toBe(401);
  });

  it("matches the start of a username, ignoring case, in alphabetical order, without me", async () => {
    const me = await h.signUp("alma");
    for (const name of ["ali", "alireza", "bali", "al_x", "alborz"]) await h.signUp(name);
    const res = await search(me.token, "AL");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: { username: string }[] }).items.map((i) => i.username)).toEqual(["al_x", "alborz", "ali", "alireza"]);
  });

  it("is not a substring search, and matches _ and % as themselves", async () => {
    const me = await h.signUp("zed");
    await h.signUp("al_x");
    await h.signUp("alex");
    const names = async (q: string) => ((await (await search(me.token, q)).json()) as { items: { username: string }[] }).items.map((i) => i.username);
    expect(await names("li")).toEqual([]);
    expect(await names("al_")).toEqual(["al_x"]);
    expect(await names("a%")).toEqual([]);
    expect(await names("%%")).toEqual([]);
  });

  it("needs at least 2 characters, after trimming", async () => {
    const me = await h.signUp("zed");
    for (const q of ["", "a", " a ", "  "]) {
      const res = await search(me.token, q);
      expect(res.status, JSON.stringify(q)).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    expect((await h.request("/v1/users/search", { token: me.token })).status).toBe(400);
  });

  it("returns at most 20, with the names, avatar and friendship state", async () => {
    const me = await h.signUp("zed");
    for (let i = 0; i < 25; i++) await h.signUp(`pal${String(i).padStart(2, "0")}`);
    const sara = await h.signUp("palsara", { displayName: "سارا" });
    await befriend(me, sara);
    await h.request("/v1/friend-requests/pal00", { method: "POST", token: me.token });
    const { items } = (await (await search(me.token, "pal")).json()) as { items: Record<string, unknown>[] };
    expect(items).toHaveLength(20);
    expect(items[0]).toEqual({ username: "pal00", displayName: null, avatar: null, friendship: "requested", isFriend: false });
    const found = ((await (await search(me.token, "palsa")).json()) as { items: unknown[] }).items;
    expect(found).toEqual([{ username: "palsara", displayName: "سارا", avatar: null, friendship: "friends", isFriend: true }]);
  });

  it("does not take a profile for the search: a user named like it is unknown", async () => {
    const me = await h.signUp("zed");
    // "search" is reserved, so no account can ever have it.
    const res = await h.request("/v1/me/username", { method: "PUT", token: me.token, json: { username: "search" } });
    expect(res.status).toBe(400);
  });

  it("never logs the names looked up", async () => {
    const me = await h.signUp("zed");
    await h.signUp("secretname");
    h.logs.length = 0;
    await profile(me.token, "secretname");
    await search(me.token, "secret");
    await h.request("/v1/friend-requests/secretname", { method: "POST", token: me.token });
    expect(h.logs.join("\n")).not.toContain("secret");
    expect(h.logs.some((l) => l.startsWith("GET /v1/users/:username 200 "))).toBe(true);
  });

  it("limits searches to 60 a minute per user", async () => {
    const me = await h.signUp("zed");
    const other = await h.signUp("yan");
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await search(me.token, "ab")).status;
    expect(last).toBe(429);
    expect((await search(other.token, "ab")).status).toBe(200);
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    expect((await search((await h.signIn("g-zed")).accessToken, "ab")).status).toBe(200);
  });
});
