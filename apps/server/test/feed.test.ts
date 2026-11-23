import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type User = { token: string; username: string };
type Item = { type: string; user: { username: string; displayName: string | null; avatar: unknown }; key?: string; date?: string; tries?: number; at: string };
const tick = (seconds = 1) => (h.clock.time = new Date(h.clock.time.getTime() + seconds * 1000));
const befriend = async (a: User, b: User) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
const react = (u: User, kind: "like" | "repost", key: string, method = "PUT") => h.request(`/v1/reactions/${kind}?key=${encodeURIComponent(key)}`, { method, token: u.token });
const daily = (u: User, solved: boolean, tries: number, date = "2026-06-01") => h.request("/v1/daily", { method: "POST", token: u.token, json: { date, solved, tries } });
const feed = async (u: User, cursor?: string) => {
  const res = await h.request(`/v1/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { token: u.token });
  expect(res.status).toBe(200);
  return (await res.json()) as { items: Item[]; nextCursor: string | null };
};

describe("GET /v1/feed", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/feed")).status).toBe(401);
  });

  it("is empty with no friends", async () => {
    const ali = await h.signUp("ali");
    expect(await feed(ali)).toEqual({ items: [], nextCursor: null });
  });

  it("shows friends' likes, reposts and solved dailies, newest first", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const reza = await h.signUp("reza");
    await befriend(ali, sara);
    await befriend(ali, reza);
    await react(sara, "like", "/hafez/ghazal/sh3#0");
    tick();
    await react(reza, "repost", "/saadi/ghazal/sh1#4");
    tick();
    await daily(sara, true, 2);
    tick();
    await react(sara, "repost", "/hafez/ghazal/sh3#0");

    const { items, nextCursor } = await feed(ali);
    expect(nextCursor).toBeNull();
    expect(items.map((i) => [i.type, i.user.username])).toEqual([
      ["repost", "sara"],
      ["daily", "sara"],
      ["repost", "reza"],
      ["like", "sara"],
    ]);
    expect(items[0]).toEqual({
      type: "repost", user: { username: "sara", displayName: "سارا", avatar: null }, key: "/hafez/ghazal/sh3#0", at: "2026-06-01T12:00:03.000Z",
    });
    expect(items[1]).toEqual({ type: "daily", user: { username: "sara", displayName: "سارا", avatar: null }, date: "2026-06-01", tries: 2, at: "2026-06-01T12:00:02.000Z" });
    expect(items[2]!.key).toBe("/saadi/ghazal/sh1#4");
  });

  it("leaves out my own activity, strangers, and people who do not follow me back", async () => {
    const ali = await h.signUp("ali");
    const stranger = await h.signUp("zed");
    const oneWay = await h.signUp("nima"); // I follow them, they do not follow me
    const fan = await h.signUp("fan"); // they follow me, I do not follow them
    await h.request("/v1/follows/nima", { method: "PUT", token: ali.token });
    await h.request("/v1/follows/ali", { method: "PUT", token: fan.token });
    for (const u of [ali, stranger, oneWay, fan]) {
      await react(u, "like", "/a/b#1");
      await daily(u, true, 1);
    }
    expect((await feed(ali)).items).toEqual([]);
  });

  it("drops a friend's items when we stop being friends, and a like when it is taken back", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await react(sara, "like", "/a/b#1");
    await react(sara, "like", "/a/b#2");
    await react(sara, "like", "/a/b#2", "DELETE");
    expect((await feed(ali)).items.map((i) => i.key)).toEqual(["/a/b#1"]);
    await h.request("/v1/follows/ali", { method: "DELETE", token: sara.token });
    expect((await feed(ali)).items).toEqual([]);
  });

  it("shows daily results only when solved and dailyVisibility is friends (the default)", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const nima = await h.signUp("nima");
    for (const f of [sara, reza, nima]) await befriend(ali, f);
    await daily(sara, true, 1);
    await daily(reza, true, 3);
    await daily(nima, false, 3);
    await h.request("/v1/me/privacy", { method: "PUT", token: reza.token, json: { dailyVisibility: "me" } });
    expect((await feed(ali)).items.map((i) => [i.type, i.user.username])).toEqual([["daily", "sara"]]);
  });

  it("keeps the two switches apart: keptVisibility hides likes and reposts, dailyVisibility hides the daily", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await befriend(ali, sara);
    await befriend(ali, reza);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { dailyVisibility: "me" } });
    await h.request("/v1/me/privacy", { method: "PUT", token: reza.token, json: { keptVisibility: "me" } });
    for (const u of [sara, reza]) {
      await daily(u, true, 1);
      await react(u, "like", "/a/b#1");
      await react(u, "repost", "/a/b#2");
    }
    const items = (await feed(ali)).items.map((i) => `${i.type}:${i.user.username}`).sort();
    expect(items).toEqual(["daily:reza", "like:sara", "repost:sara"]);
    await h.request("/v1/me/privacy", { method: "PUT", token: reza.token, json: { keptVisibility: "friends" } });
    expect((await feed(ali)).items).toHaveLength(5);
  });

  it("pages 30 at a time, without skipping items that share a second", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await befriend(ali, sara);
    await befriend(ali, reza);
    for (let i = 0; i < 70; i++) {
      await react(i % 2 ? sara : reza, i % 3 ? "like" : "repost", `/a/b#${i}`);
      if (i % 5 === 4) tick(); // groups of five share one time
    }
    const one = await feed(ali);
    expect(one.items).toHaveLength(30);
    const two = await feed(ali, one.nextCursor!);
    expect(two.items).toHaveLength(30);
    const three = await feed(ali, two.nextCursor!);
    expect(three.items).toHaveLength(10);
    expect(three.nextCursor).toBeNull();
    const keys = [...one.items, ...two.items, ...three.items].map((i) => i.key);
    expect(new Set(keys).size).toBe(70);
    const times = [...one.items, ...two.items, ...three.items].map((i) => i.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("rejects a malformed cursor", async () => {
    const ali = await h.signUp("ali");
    for (const cursor of ["x", "2026-02-30T00:00:00.000Z|abc", "|abc", "2026-06-01T12:00:00.000Z|"]) {
      expect((await h.request(`/v1/feed?cursor=${encodeURIComponent(cursor)}`, { token: ali.token })).status, cursor).toBe(400);
    }
  });

  it("is deleted with the account: a deleted friend leaves the feed", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await react(sara, "like", "/a/b#1");
    await daily(sara, true, 1);
    await h.request("/v1/me", { method: "DELETE", token: sara.token });
    expect((await feed(ali)).items).toEqual([]);
  });
});
