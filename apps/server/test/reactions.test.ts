import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const K1 = "/hafez/ghazal/sh3#0";
const K2 = "/saadi/ghazal/sh1#4";
const react = (token: string, method: "PUT" | "DELETE", kind: string, key: unknown) =>
  h.request(`/v1/reactions/${kind}`, { method, token, json: { key } });
const counts = async (token: string, keys: string[]) => {
  const res = await h.request(`/v1/reactions/counts?keys=${encodeURIComponent(keys.join(","))}`, { token });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, { likes: number; reposts: number; likedByMe: boolean; repostedByMe: boolean }>;
};

describe("reactions", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/reactions/like", { method: "PUT", json: { key: K1 } })).status).toBe(401);
    expect((await h.request("/v1/reactions/like", { method: "DELETE", json: { key: K1 } })).status).toBe(401);
    expect((await h.request(`/v1/reactions/counts?keys=${encodeURIComponent(K1)}`)).status).toBe(401);
  });

  it("likes and reposts a couplet, answering the couplet's counts", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const liked = await react(ali.token, "PUT", "like", K1);
    expect(liked.status).toBe(200);
    expect(await liked.json()).toEqual({ likes: 1, reposts: 0, likedByMe: true, repostedByMe: false });
    await react(sara.token, "PUT", "like", K1);
    const reposted = await react(sara.token, "PUT", "repost", K1);
    expect(await reposted.json()).toEqual({ likes: 2, reposts: 1, likedByMe: true, repostedByMe: true });
    expect(await counts(ali.token, [K1])).toEqual({ [K1]: { likes: 2, reposts: 1, likedByMe: true, repostedByMe: false } });
  });

  it("is idempotent for both PUT and DELETE", async () => {
    const ali = await h.signUp("ali");
    await react(ali.token, "PUT", "like", K1);
    const again = await react(ali.token, "PUT", "like", K1);
    expect(await again.json()).toMatchObject({ likes: 1 });
    const removed = await react(ali.token, "DELETE", "like", K1);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ likes: 0, reposts: 0, likedByMe: false, repostedByMe: false });
    expect((await react(ali.token, "DELETE", "like", K1)).status).toBe(200);
  });

  it("keeps a like and a repost apart", async () => {
    const ali = await h.signUp("ali");
    await react(ali.token, "PUT", "repost", K1);
    await react(ali.token, "DELETE", "like", K1);
    expect(await counts(ali.token, [K1])).toEqual({ [K1]: { likes: 0, reposts: 1, likedByMe: false, repostedByMe: true } });
  });

  it("counts several keys at once, zero for the ones nobody reacted to, and repeats of a key once", async () => {
    const ali = await h.signUp("ali");
    await react(ali.token, "PUT", "like", K1);
    expect(await counts(ali.token, [K1, K2, K1])).toEqual({
      [K1]: { likes: 1, reposts: 0, likedByMe: true, repostedByMe: false },
      [K2]: { likes: 0, reposts: 0, likedByMe: false, repostedByMe: false },
    });
  });

  it("takes up to 50 keys", async () => {
    const ali = await h.signUp("ali");
    const keys = Array.from({ length: 50 }, (_, i) => `/p/q#${i}`);
    expect(Object.keys(await counts(ali.token, keys))).toHaveLength(50);
    const res = await h.request(`/v1/reactions/counts?keys=${encodeURIComponent([...keys, "/p/q#50"].join(","))}`, { token: ali.token });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("rejects bad keys, kinds and bodies", async () => {
    const ali = await h.signUp("ali");
    for (const key of ["", "nope", "/hafez#x", 5, null]) expect((await react(ali.token, "PUT", "like", key)).status, String(key)).toBe(400);
    expect((await react(ali.token, "PUT", "love", K1)).status).toBe(400);
    expect((await h.request("/v1/reactions/like", { method: "PUT", token: ali.token, json: { key: K1, extra: 1 } })).status).toBe(400);
    for (const keys of ["", "nope", `${K1},`, `${K1},bad`]) {
      expect((await h.request(`/v1/reactions/counts?keys=${encodeURIComponent(keys)}`, { token: ali.token })).status, keys).toBe(400);
    }
    expect((await h.request("/v1/reactions/counts", { token: ali.token })).status).toBe(400);
  });

  it("counts everyone's reactions, not only friends'", async () => {
    const ali = await h.signUp("ali");
    for (const name of ["fan1", "fan2", "fan3"]) await react((await h.signUp(name)).token, "PUT", "like", K1);
    expect((await counts(ali.token, [K1]))[K1]).toMatchObject({ likes: 3, likedByMe: false });
  });

  it("limits reactions to 120 a minute per user", async () => {
    const ali = await h.signUp("ali");
    let last = 200;
    for (let i = 0; i < 125; i++) last = (await react(ali.token, "PUT", "like", `/p/q#${i}`)).status;
    expect(last).toBe(429);
  });

  it("is deleted with the account", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await react(ali.token, "PUT", "like", K1);
    await react(sara.token, "PUT", "like", K1);
    await h.request("/v1/me", { method: "DELETE", token: ali.token });
    expect((await counts(sara.token, [K1]))[K1]).toMatchObject({ likes: 1, likedByMe: true });
  });
});
