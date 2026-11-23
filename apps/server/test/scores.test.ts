import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const minutes = (n: number) => new Date(h.clock.time.getTime() + n * 60_000).toISOString();
const postScore = (token: string, body: Record<string, unknown>) =>
  h.request("/v1/scores", { method: "POST", token, json: { roundId: randomUUID(), game: "poet", points: 100, playedAt: minutes(-1), ...body } });
const postDaily = (token: string, body: Record<string, unknown>) => h.request("/v1/daily", { method: "POST", token, json: { date: "2026-06-01", solved: true, tries: 1, ...body } });
const stats = async (token: string) => (await h.request("/v1/me/stats", { token })).json();

describe("POST /v1/scores", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/scores", { method: "POST", json: {} })).status).toBe(401);
    expect((await h.request("/v1/me/stats")).status).toBe(401);
  });

  it("records a round and answers the week's points", async () => {
    const ali = await h.signUp("ali");
    const res = await postScore(ali.token, { points: 120 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ week: "2026-W23", weekPoints: 120 });
    expect(await (await postScore(ali.token, { points: 30 })).json()).toEqual({ week: "2026-W23", weekPoints: 150 });
  });

  it("counts a round id once for the same user, and answers the same", async () => {
    const ali = await h.signUp("ali");
    const roundId = randomUUID();
    await postScore(ali.token, { roundId, points: 100 });
    const again = await postScore(ali.token, { roundId, points: 100 });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ week: "2026-W23", weekPoints: 100 });
    // A retry that arrives late is still just a retry.
    h.clock.time = new Date(h.clock.time.getTime() + 3 * 24 * 3_600_000);
    const token = (await h.signIn("g-ali")).accessToken;
    expect((await postScore(token, { roundId, points: 100, playedAt: "2026-06-01T11:00:00Z" })).status).toBe(200);
    expect((await stats(token)).totalPoints).toBe(100);
  });

  it("refuses a round id that another user already used", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const roundId = randomUUID();
    await postScore(ali.token, { roundId });
    const res = await postScore(sara.token, { roundId });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict" });
    expect((await stats(sara.token)).totalPoints).toBe(0);
  });

  it("caps points per game", async () => {
    const ali = await h.signUp("ali");
    const caps = { daily: 100, jigsaw: 320, poet: 440, second: 440, book: 440, match: 50, listen: 100, onboarding: 50 };
    for (const [game, cap] of Object.entries(caps)) {
      expect((await postScore(ali.token, { game, points: cap })).status, `${game} at the cap`).toBe(200);
      const over = await postScore(ali.token, { game, points: cap + 1 });
      expect(over.status, `${game} over the cap`).toBe(400);
      expect(await over.json()).toEqual({ error: "points_too_high" });
    }
    expect((await stats(ali.token)).totalPoints).toBe(Object.values(caps).reduce((a, b) => a + b, 0));
  });

  it("accepts 0 points and rejects bad bodies", async () => {
    const ali = await h.signUp("ali");
    expect((await postScore(ali.token, { points: 0 })).status).toBe(200);
    for (const bad of [{ points: -1 }, { points: 1.5 }, { points: "10" }, { game: "chess" }, { roundId: "nope" }, { playedAt: "yesterday" }, { extra: 1 }]) {
      const res = await postScore(ali.token, bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });

  it("takes rounds played in the last 48 hours and at most 5 minutes ahead", async () => {
    const ali = await h.signUp("ali");
    expect((await postScore(ali.token, { playedAt: minutes(-47 * 60) })).status).toBe(200);
    expect((await postScore(ali.token, { playedAt: minutes(4) })).status).toBe(200);
    for (const playedAt of [minutes(-48 * 60 - 1), minutes(6)]) {
      const res = await postScore(ali.token, { playedAt });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_timestamp" });
    }
  });

  it("counts the daily once per user per Tehran day, and onboarding once ever", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const roundId = randomUUID();
    expect((await postScore(ali.token, { roundId, game: "daily", points: 100 })).status).toBe(200);
    // The same round again is a retry, not a second daily.
    expect(await (await postScore(ali.token, { roundId, game: "daily", points: 100 })).json()).toEqual({ week: "2026-W23", weekPoints: 100 });
    const second = await postScore(ali.token, { game: "daily", points: 40 });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "conflict" });
    // Yesterday's daily (Tehran) is another day; another user's today is another user.
    expect((await postScore(ali.token, { game: "daily", points: 70, playedAt: minutes(-24 * 60) })).status).toBe(200);
    expect((await postScore(sara.token, { game: "daily", points: 70 })).status).toBe(200);
    expect((await stats(ali.token)).totalPoints).toBe(170);

    expect((await postScore(ali.token, { game: "onboarding", points: 50 })).status).toBe(200);
    expect((await postScore(ali.token, { game: "onboarding", points: 10 })).status).toBe(409);
    h.clock.time = new Date(h.clock.time.getTime() + 40 * 24 * 3_600_000); // weeks later: still once
    const later = (await h.signIn("g-ali")).accessToken;
    expect((await postScore(later, { game: "onboarding", points: 10 })).status).toBe(409);
    const saraLater = (await h.signIn("g-sara")).accessToken;
    expect((await postScore(saraLater, { game: "onboarding", points: 10 })).status).toBe(200);
    expect((await stats(later)).totalPoints).toBe(220);
  });

  it("splits the daily by Tehran midnight (20:30 UTC), not UTC midnight", async () => {
    await h.signUp("ali");
    h.clock.time = new Date("2026-06-01T21:00:00Z"); // 00:30 on 2 June in Tehran
    const token = (await h.signIn("g-ali")).accessToken;
    expect((await postScore(token, { game: "daily", points: 50, playedAt: "2026-06-01T20:29:00Z" })).status).toBe(200); // 1 June
    expect((await postScore(token, { game: "daily", points: 50, playedAt: "2026-06-01T20:31:00Z" })).status).toBe(200); // 2 June
    expect((await postScore(token, { game: "daily", points: 50, playedAt: "2026-06-01T20:40:00Z" })).status).toBe(409);
    expect((await postScore(token, { game: "daily", points: 50, playedAt: "2026-06-01T10:00:00Z" })).status).toBe(409); // 1 June again
  });

  it("limits how fast one user may report (120 a minute)", async () => {
    const ali = await h.signUp("ali");
    let last = 200;
    for (let i = 0; i < 125; i++) last = (await postScore(ali.token, { points: 1 })).status;
    expect(last).toBe(429);
  });
});

describe("POST /v1/daily", () => {
  it("records the result for a Tehran day and keeps the first one", async () => {
    const ali = await h.signUp("ali");
    const first = await postDaily(ali.token, { solved: true, tries: 2 });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ date: "2026-06-01", solved: true, tries: 2 });
    const second = await postDaily(ali.token, { solved: false, tries: 3 });
    expect(await second.json()).toEqual({ date: "2026-06-01", solved: true, tries: 2 });
  });

  it("takes the Tehran days from 48 hours ago up to today, and no future day", async () => {
    await h.signUp("ali");
    h.clock.time = new Date("2026-06-01T21:00:00Z"); // 00:30 on 2 June in Tehran
    const token = (await h.signIn("g-ali")).accessToken;
    expect((await postDaily(token, { date: "2026-06-02" })).status).toBe(200);
    expect((await postDaily(token, { date: "2026-05-31" })).status).toBe(200);
    for (const date of ["2026-06-03", "2026-05-30"]) {
      const res = await postDaily(token, { date });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_timestamp" });
    }
  });

  it("rejects bad bodies", async () => {
    const ali = await h.signUp("ali");
    for (const bad of [{ date: "2026-02-30" }, { date: "06/01/2026" }, { tries: 0 }, { tries: 4 }, { tries: 1.5 }, { solved: "yes" }]) {
      const res = await postDaily(ali.token, bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    expect((await h.request("/v1/daily", { method: "POST", json: {} })).status).toBe(401);
  });
});

describe("GET /v1/me/stats", () => {
  it("starts empty", async () => {
    const ali = await h.signUp("ali");
    expect(await stats(ali.token)).toEqual({ totalPoints: 0, weekPoints: 0, streakDays: 0, league: { tier: 0 } });
  });

  it("adds up all points, and this week's apart", async () => {
    const ali = await h.signUp("ali");
    await postScore(ali.token, { points: 100 });
    await postScore(ali.token, { points: 40 });
    h.clock.time = new Date("2026-06-07T12:00:00Z"); // the next Saturday-to-Friday week
    const token = (await h.signIn("g-ali")).accessToken;
    await postScore(token, { points: 25, playedAt: "2026-06-07T11:59:00Z" });
    // Alone in last week's league, so in the top 5: promoted.
    expect(await stats(token)).toEqual({ totalPoints: 165, weekPoints: 25, streakDays: 0, league: { tier: 1 } });
  });

  it("counts solved days in a row ending today or yesterday (Tehran days)", async () => {
    const ali = await h.signUp("ali");
    const day = (n: number) => new Date(Date.UTC(2026, 5, 1 + n)).toISOString().slice(0, 10);
    const give = (date: string, solved = true) =>
      h.db.execute(sql`insert into daily_results (user_id, date, solved, tries) values (${ali.id}::uuid, ${date}::date, ${solved}, 1)`);
    // 28 May and 30 May to 1 June solved, 29 May not: the streak is 3 on 1 June.
    for (const n of [-4, -2, -1, 0]) await give(day(n));
    await give(day(-3), false);
    expect((await stats(ali.token)).streakDays).toBe(3);

    // Without today's puzzle the streak still stands until the day ends.
    h.clock.time = new Date("2026-06-02T12:00:00Z");
    const t2 = (await h.signIn("g-ali")).accessToken;
    expect((await stats(t2)).streakDays).toBe(3);
    // A missed day breaks it.
    h.clock.time = new Date("2026-06-03T12:00:00Z");
    const t3 = (await h.signIn("g-ali")).accessToken;
    expect((await stats(t3)).streakDays).toBe(0);
  });

  it("never lets a future day count", async () => {
    const ali = await h.signUp("ali");
    await h.db.execute(sql`insert into daily_results (user_id, date, solved, tries) values (${ali.id}::uuid, '2026-06-02', true, 1)`);
    expect((await stats(ali.token)).streakDays).toBe(0);
  });
});
