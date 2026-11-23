import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type Row = { rank: number; username: string | null; points: number; isMe: boolean };
const score = (token: string, points: number) =>
  h.request("/v1/scores", { method: "POST", token, json: { roundId: randomUUID(), game: "poet", points, playedAt: h.clock.time.toISOString() } });
const befriend = async (a: { token: string; username: string }, b: { token: string; username: string }) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
const friends = async (token: string) => {
  const res = await h.request("/v1/leaderboard/friends", { token });
  expect(res.status).toBe(200);
  return (await res.json()) as { week: string; rows: Row[] };
};
const global = async (token: string, cursor?: string) => {
  const res = await h.request(`/v1/leaderboard/global${cursor ? `?cursor=${cursor}` : ""}`, { token });
  expect(res.status).toBe(200);
  return (await res.json()) as { week: string; rows: Row[]; me: Row | null; nextCursor: string | null };
};
const allowGlobal = (token: string, on = true) => h.request("/v1/me/privacy", { method: "PUT", token, json: { inGlobalLeaderboard: on } });

describe("friends leaderboard", () => {
  it("ranks me and my friends by this week's points, friends with none included", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const stranger = await h.signUp("zed");
    const oneWay = await h.signUp("nima");
    await befriend(ali, sara);
    await befriend(ali, reza);
    await h.request("/v1/follows/ali", { method: "PUT", token: oneWay.token }); // follows me, I do not follow back
    await score(ali.token, 100);
    await score(sara.token, 300);
    await score(stranger.token, 900);
    await score(oneWay.token, 800);

    const board = await friends(ali.token);
    expect(board.week).toBe("2026-W23");
    expect(board.rows).toEqual([
      { rank: 1, username: "sara", displayName: null, avatar: null, points: 300, isMe: false },
      { rank: 2, username: "ali", displayName: null, avatar: null, points: 100, isMe: true },
      { rank: 3, username: "reza", displayName: null, avatar: null, points: 0, isMe: false },
    ]);
  });

  it("shows only me when I have no friends, and needs sign-in", async () => {
    const ali = await h.signUp("ali");
    expect((await friends(ali.token)).rows).toEqual([{ rank: 1, username: "ali", displayName: null, avatar: null, points: 0, isMe: true }]);
    expect((await h.request("/v1/leaderboard/friends")).status).toBe(401);
  });

  it("counts only this week", async () => {
    const ali = await h.signUp("ali");
    await score(ali.token, 100);
    h.clock.time = new Date("2026-06-07T12:00:00Z");
    const token = (await h.signIn("g-ali")).accessToken;
    expect((await friends(token)).rows[0]!.points).toBe(0);
  });
});

describe("global leaderboard", () => {
  it("lists only people who allow it, with my own rank even when I am hidden", async () => {
    const ali = await h.signUp("ali"); // hidden (the default)
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await allowGlobal(sara.token);
    await allowGlobal(reza.token);
    await score(ali.token, 200);
    await score(sara.token, 300);
    await score(reza.token, 100);

    const board = await global(ali.token);
    expect(board.rows.map((r) => [r.rank, r.username, r.points, r.isMe])).toEqual([
      [1, "sara", 300, false],
      [2, "reza", 100, false],
    ]);
    expect(board.me).toMatchObject({ rank: 2, username: "ali", points: 200, isMe: true }); // between sara and reza
    expect(board.nextCursor).toBeNull();

    await allowGlobal(ali.token);
    const open = await global(ali.token);
    expect(open.rows.map((r) => r.username)).toEqual(["sara", "ali", "reza"]);
    expect(open.me).toMatchObject({ rank: 2, isMe: true });
    await allowGlobal(ali.token, false);
    expect((await global(sara.token)).rows.map((r) => r.username)).toEqual(["sara", "reza"]);
  });

  it("leaves out people with no score this week, and answers me: null before my first score", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await allowGlobal(sara.token);
    expect(await global(ali.token)).toMatchObject({ rows: [], me: null, nextCursor: null });
    await score(sara.token, 10);
    expect((await global(ali.token)).rows).toHaveLength(1);
  });

  it("pages 50 at a time with ranks that continue", async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 53; i++) tokens.push((await h.signUp(`gl${String(i).padStart(2, "0")}`)).token);
    for (const [i, token] of tokens.entries()) {
      await allowGlobal(token);
      await score(token, 400 - i * 5); // all different
    }
    const one = await global(tokens[0]!);
    expect(one.rows).toHaveLength(50);
    expect(one.rows[0]).toMatchObject({ rank: 1, username: "gl00", points: 400 });
    expect(one.rows[49]!.rank).toBe(50);
    expect(one.nextCursor).not.toBeNull();
    const two = await global(tokens[0]!, one.nextCursor!);
    expect(two.rows.map((r) => [r.rank, r.username])).toEqual([[51, "gl50"], [52, "gl51"], [53, "gl52"]]);
    expect(two.nextCursor).toBeNull();
    expect(two.me).toMatchObject({ rank: 1, username: "gl00" });
  });

  it("keeps ties in a fixed order across pages (no one is skipped or repeated)", async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 55; i++) tokens.push((await h.signUp(`tie${String(i).padStart(2, "0")}`)).token);
    for (const token of tokens) {
      await allowGlobal(token);
      await score(token, 40);
    }
    const one = await global(tokens[0]!);
    const two = await global(tokens[0]!, one.nextCursor!);
    const names = [...one.rows, ...two.rows].map((r) => r.username);
    expect(new Set(names).size).toBe(55);
    expect(two.rows[0]!.rank).toBe(51);
  });

  it("rejects a malformed cursor and needs sign-in", async () => {
    const ali = await h.signUp("ali");
    for (const cursor of ["x", "1_2_3", "1_2_00000000-0000-4000-8000-00000000000z"]) {
      expect((await h.request(`/v1/leaderboard/global?cursor=${cursor}`, { token: ali.token })).status).toBe(400);
    }
    expect((await h.request("/v1/leaderboard/global")).status).toBe(401);
  });
});
