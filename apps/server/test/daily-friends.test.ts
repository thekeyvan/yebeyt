import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type User = { token: string; username: string };
const befriend = async (a: User, b: User) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
const daily = (u: User, solved: boolean, tries: number, date = "2026-06-01") =>
  h.request("/v1/daily", { method: "POST", token: u.token, json: { date, solved, tries } });
const friendsOf = async (u: User, date = "2026-06-01") => {
  const res = await h.request(`/v1/daily/${date}/friends`, { token: u.token });
  expect(res.status).toBe(200);
  return (await res.json()) as { solvedCount: number; friends: { username: string; displayName: string | null; solved: boolean; tries: number }[] };
};

describe("GET /v1/daily/{date}/friends", () => {
  it("requires sign-in and a real date", async () => {
    expect((await h.request("/v1/daily/2026-06-01/friends")).status).toBe(401);
    const ali = await h.signUp("ali");
    expect((await h.request("/v1/daily/2026-02-30/friends", { token: ali.token })).status).toBe(400);
    expect((await h.request("/v1/daily/today/friends", { token: ali.token })).status).toBe(400);
  });

  it("lists friends' results, solved first then fewer tries, with the solved count", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const reza = await h.signUp("reza");
    const nima = await h.signUp("nima");
    const lost = await h.signUp("lost");
    for (const f of [sara, reza, nima, lost]) await befriend(ali, f);
    await daily(sara, true, 3);
    await daily(reza, true, 1);
    await daily(lost, false, 3);
    await daily(ali, true, 1); // me: not in the list

    const result = await friendsOf(ali);
    expect(result.solvedCount).toBe(2);
    expect(result.friends).toEqual([
      { username: "reza", displayName: null, avatar: null, solved: true, tries: 1 },
      { username: "sara", displayName: "سارا", avatar: null, solved: true, tries: 3 },
      { username: "lost", displayName: null, avatar: null, solved: false, tries: 3 },
    ]);
  });

  it("is empty when no friend played, and other days are separate", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await daily(sara, true, 2, "2026-05-31");
    expect(await friendsOf(ali)).toEqual({ solvedCount: 0, friends: [] });
    expect((await friendsOf(ali, "2026-05-31")).solvedCount).toBe(1);
  });

  it("leaves out people I follow who do not follow me back, and people who follow me only", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await h.request("/v1/follows/sara", { method: "PUT", token: ali.token });
    await h.request("/v1/follows/ali", { method: "PUT", token: reza.token });
    await daily(sara, true, 1);
    await daily(reza, true, 1);
    expect(await friendsOf(ali)).toEqual({ solvedCount: 0, friends: [] });
  });

  it("respects dailyVisibility: a friend who keeps it to themselves is not listed or counted", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await befriend(ali, sara);
    await befriend(ali, reza);
    await daily(sara, true, 1);
    await daily(reza, true, 2);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { dailyVisibility: "me" } });
    expect((await friendsOf(ali)).friends.map((f) => f.username)).toEqual(["reza"]);
    expect((await friendsOf(ali)).solvedCount).toBe(1);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { dailyVisibility: "friends" } });
    expect((await friendsOf(ali)).solvedCount).toBe(2);
  });
});
