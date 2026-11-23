import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { leagueClosures, leagueGroups, leagueMembers, scoreEvents, userTiers, users } from "../src/db/schema.js";
import { closeWeek } from "../src/leagues.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const WEEK = "2026-W23"; // 30 May to 5 June 2026, Tehran; the harness clock is 1 June
const NEXT_WEEK = "2026-W24";
const minutes = (n: number) => new Date(h.clock.time.getTime() + n * 60_000).toISOString();
const score = (token: string, points: number) =>
  h.request("/v1/scores", { method: "POST", token, json: { roundId: randomUUID(), game: "poet", points, playedAt: minutes(-1) } });
const allowGlobal = (token: string) => h.request("/v1/me/privacy", { method: "PUT", token, json: { inGlobalLeaderboard: true } });
const league = async (token: string) => {
  const res = await h.request("/v1/leaderboard/league", { token });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    week: string;
    tier: number;
    endsAt: string;
    rows: { rank: number; username: string | null; displayName: string | null; avatar: unknown; points: number; isMe: boolean; hidden: boolean }[];
    promoteCount: number;
    demoteCount: number;
  };
};

/** Users straight in the database, with a league group of their own (no sign-in needed). */
async function seedGroup(week: string, tier: number, members: { name: string; points: number; lastAt?: string }[]) {
  const [group] = await h.db.insert(leagueGroups).values({ week, tier, memberCount: members.length }).returning({ id: leagueGroups.id });
  const ids: Record<string, string> = {};
  for (const m of members) {
    const [u] = await h.db.insert(users).values({ username: m.name }).returning({ id: users.id });
    ids[m.name] = u!.id;
    await h.db.insert(leagueMembers).values({ groupId: group!.id, userId: u!.id, week });
    await h.db.insert(scoreEvents).values({
      id: randomUUID(), userId: u!.id, game: "poet", points: m.points, playedAt: new Date(m.lastAt ?? "2026-06-01T10:00:00Z"), week, createdAt: new Date(m.lastAt ?? "2026-06-01T10:00:00Z"),
    });
  }
  return { groupId: group!.id, ids };
}
const tiersByName = async (ids: Record<string, string>) => {
  const rows = await h.db.select().from(userTiers);
  const byId = new Map(rows.map((r) => [r.userId, r.tier]));
  return Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, byId.get(id)]));
};

describe("joining a league", () => {
  it("puts a user in a group of tier 0 on their first score of the week, and shows the standings", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    await allowGlobal(sara.token);
    const before = await league(ali.token);
    expect(before).toMatchObject({ week: WEEK, tier: 0, rows: [], promoteCount: 5, demoteCount: 5, endsAt: "2026-06-05T20:30:00.000Z" });

    await score(ali.token, 100);
    await score(sara.token, 150);
    await score(ali.token, 20);
    const board = await league(ali.token);
    expect(board.tier).toBe(0);
    expect(board.rows).toEqual([
      { rank: 1, username: "sara", displayName: "سارا", avatar: null, points: 150, isMe: false, hidden: false },
      { rank: 2, username: "ali", displayName: null, avatar: null, points: 120, isMe: true, hidden: false },
    ]);
    const members = await h.db.select().from(leagueMembers);
    expect(members).toHaveLength(2);
    expect(new Set(members.map((m) => m.groupId)).size).toBe(1);
  });

  it("shows strangers who keep off the global list as hidden: points and rank, no name", async () => {
    const ali = await h.signUp("ali");
    const friend = await h.signUp("friend", { displayName: "دوست" });
    const open = await h.signUp("open");
    const stranger = await h.signUp("stranger", { displayName: "غریبه" });
    const oneWay = await h.signUp("oneway"); // follows me only: still a stranger
    await h.request("/v1/follows/friend", { method: "PUT", token: ali.token });
    await h.request("/v1/follows/ali", { method: "PUT", token: friend.token });
    await h.request("/v1/follows/ali", { method: "PUT", token: oneWay.token });
    await allowGlobal(open.token);
    await h.request("/v1/me/avatar", { method: "PUT", token: stranger.token, json: { face: "f1", eyes: "e1", hair: "h1", mouth: "m1", accessory: "a1", background: "b1" } });
    for (const [u, points] of [[ali, 10], [friend, 20], [open, 30], [stranger, 40], [oneWay, 50]] as const) await score(u.token, points);

    const rows = (await league(ali.token)).rows;
    expect(rows).toEqual([
      { rank: 1, username: null, displayName: null, avatar: null, points: 50, isMe: false, hidden: true },
      { rank: 2, username: null, displayName: null, avatar: null, points: 40, isMe: false, hidden: true },
      { rank: 3, username: "open", displayName: null, avatar: null, points: 30, isMe: false, hidden: false },
      { rank: 4, username: "friend", displayName: "دوست", avatar: null, points: 20, isMe: false, hidden: false },
      { rank: 5, username: "ali", displayName: null, avatar: null, points: 10, isMe: true, hidden: false },
    ]);
    // I am hidden to the stranger, who sees me as «یه نفر» too (I keep off the list), and sees themselves.
    const theirs = (await league(stranger.token)).rows;
    expect(theirs.find((r) => r.points === 10)).toMatchObject({ username: null, hidden: true });
    expect(theirs.find((r) => r.points === 40)).toMatchObject({ username: "stranger", displayName: "غریبه", isMe: true, hidden: false });
  });

  it("breaks ties by the earlier last score", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await allowGlobal(sara.token);
    await score(ali.token, 50);
    h.clock.time = new Date(h.clock.time.getTime() + 60_000);
    await score(sara.token, 50);
    const rows = (await league(ali.token)).rows;
    expect(rows.map((r) => r.username)).toEqual(["ali", "sara"]);
  });

  it("only requires sign-in", async () => {
    expect((await h.request("/v1/leaderboard/league")).status).toBe(401);
  });

  it("starts a new group when 30 are in, and never puts a user in two", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 65; i++) ids.push((await h.signUp(`user${String(i).padStart(2, "0")}`)).token);
    for (const token of ids) await score(token, 10);
    for (const token of ids.slice(0, 5)) await score(token, 10); // again: no second membership
    const groups = await h.db.select().from(leagueGroups).where(eq(leagueGroups.week, WEEK));
    expect(groups.map((g) => g.memberCount).sort((a, b) => a - b)).toEqual([5, 30, 30]);
    expect(groups.every((g) => g.tier === 0)).toBe(true);
    const members = await h.db.select().from(leagueMembers);
    expect(new Set(members.map((m) => m.userId)).size).toBe(65);
    expect((await league(ids[40]!)).rows).toHaveLength(30);
  });

  it("is safe when many users score at the same moment", async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 70; i++) tokens.push((await h.signUp(`racer${i}`)).token);
    const results = await Promise.all(tokens.map((t) => score(t, 10)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const sizes = await h.db
      .select({ n: sql<number>`count(*)::int`, count: leagueGroups.memberCount })
      .from(leagueMembers)
      .innerJoin(leagueGroups, eq(leagueGroups.id, leagueMembers.groupId))
      .groupBy(leagueGroups.id, leagueGroups.memberCount);
    expect(sizes.every((s) => s.n === s.count && s.n <= 30)).toBe(true);
    expect(sizes.reduce((a, s) => a + s.n, 0)).toBe(70);
    // The same user's rounds arriving together still make one membership.
    const [first] = tokens;
    await Promise.all([score(first!, 5), score(first!, 5), score(first!, 5)]);
    expect(await h.db.select().from(leagueMembers)).toHaveLength(70);
  });
});

describe("closeWeek", () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => `u${String(i + 1).padStart(2, "0")}`);

  it("moves the top 5 up and the bottom 5 down, and leaves the middle", async () => {
    const { ids } = await seedGroup(WEEK, 2, names(12).map((name, i) => ({ name, points: 1200 - i * 100 })));
    await closeWeek(h.db, WEEK, h.clock.time);
    const t = await tiersByName(ids);
    expect(names(12).map((n) => t[n])).toEqual([3, 3, 3, 3, 3, 2, 2, 1, 1, 1, 1, 1]);
    expect(await h.db.select().from(leagueClosures)).toHaveLength(1);
  });

  it("keeps tiers within 0 to 4", async () => {
    const low = await seedGroup(WEEK, 0, names(12).map((name, i) => ({ name: `low${name}`, points: 1200 - i * 100 })));
    const high = await seedGroup(WEEK, 4, names(12).map((name, i) => ({ name: `high${name}`, points: 1200 - i * 100 })));
    await closeWeek(h.db, WEEK, h.clock.time);
    const lowTiers = Object.values(await tiersByName(low.ids));
    const highTiers = Object.values(await tiersByName(high.ids));
    expect(lowTiers).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(highTiers).toEqual([4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3]);
  });

  it("breaks ties by the earlier last score, then lets the later one fall", async () => {
    const group = names(11).map((name) => ({ name, points: 100, lastAt: `2026-06-01T10:${name.slice(1)}:00Z` }));
    const { ids } = await seedGroup(WEEK, 1, group);
    await closeWeek(h.db, WEEK, h.clock.time);
    const t = await tiersByName(ids);
    // u01..u05 were first to 100 points: up; u07..u11 last: down; u06 stays.
    expect(names(11).map((n) => t[n])).toEqual([2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0]);
  });

  it("in a small group nobody is both promoted and demoted", async () => {
    const { ids } = await seedGroup(WEEK, 1, names(7).map((name, i) => ({ name, points: 700 - i * 100 })));
    await closeWeek(h.db, WEEK, h.clock.time);
    const t = await tiersByName(ids);
    expect(names(7).map((n) => t[n])).toEqual([2, 2, 2, 2, 2, 0, 0]);
    const alone = await seedGroup(WEEK, 1, [{ name: "lonely", points: 5 }]);
    await h.db.delete(leagueClosures);
    await closeWeek(h.db, WEEK, h.clock.time);
    expect((await tiersByName(alone.ids)).lonely).toBe(2);
  });

  it("is repeatable: a second run changes nothing", async () => {
    const { ids } = await seedGroup(WEEK, 2, names(12).map((name, i) => ({ name, points: 1200 - i * 100 })));
    await closeWeek(h.db, WEEK, h.clock.time);
    await closeWeek(h.db, WEEK, h.clock.time);
    await Promise.all([closeWeek(h.db, WEEK, h.clock.time), closeWeek(h.db, WEEK, h.clock.time)]);
    const t = await tiersByName(ids);
    expect(t.u01).toBe(3);
    expect(t.u12).toBe(1);
    expect((await h.db.select().from(userTiers)).every((r) => r.fromWeek === WEEK)).toBe(true);
  });

  it("only counts points of that week", async () => {
    const { ids } = await seedGroup(WEEK, 2, names(12).map((name, i) => ({ name, points: 1200 - i * 100 })));
    // A huge score in another week must not lift the last user.
    await h.db.insert(scoreEvents).values({ id: randomUUID(), userId: ids.u12!, game: "poet", points: 400, playedAt: new Date(), week: NEXT_WEEK });
    await closeWeek(h.db, WEEK, h.clock.time);
    expect((await tiersByName(ids)).u12).toBe(1);
  });
});

describe("the lazy close at the start of a week", () => {
  it("closes last week on the first request of the new one, once, and places users by it", async () => {
    const people = await Promise.all(Array.from({ length: 12 }, (_, i) => h.signUp(`p${String(i + 1).padStart(2, "0")}`)));
    for (const [i, person] of people.entries()) await score(person.token, 440 - i * 30);
    expect(await h.db.select().from(leagueClosures)).toHaveLength(0);

    h.clock.time = new Date("2026-06-06T20:30:00Z"); // Saturday 00:00 in Tehran: week 24
    const top = (await h.signIn("g-p01")).accessToken;
    const bottom = (await h.signIn("g-p12")).accessToken;
    const middle = (await h.signIn("g-p06")).accessToken;
    expect((await (await h.request("/v1/me/stats", { token: top })).json()).league).toEqual({ tier: 1 });
    expect((await h.db.select().from(leagueClosures)).map((c) => c.week)).toEqual([WEEK]);
    expect((await (await h.request("/v1/me/stats", { token: bottom })).json()).league).toEqual({ tier: 0 }); // bottom of tier 0 stays at 0
    expect((await (await h.request("/v1/me/stats", { token: middle })).json()).league).toEqual({ tier: 0 });

    // Scoring in the new week lands the top user in a tier 1 group, apart from tier 0.
    await h.request("/v1/scores", { method: "POST", token: top, json: { roundId: randomUUID(), game: "poet", points: 10, playedAt: "2026-06-06T20:29:00Z" } });
    await h.request("/v1/scores", { method: "POST", token: bottom, json: { roundId: randomUUID(), game: "poet", points: 10, playedAt: "2026-06-06T20:29:00Z" } });
    const groups = await h.db.select().from(leagueGroups).where(eq(leagueGroups.week, NEXT_WEEK));
    expect(groups.map((g) => g.tier).sort()).toEqual([0, 1]);
    expect((await league(top)).tier).toBe(1);
    expect((await league(top)).week).toBe(NEXT_WEEK);
    expect(await h.db.select().from(leagueClosures)).toHaveLength(1);
  });

  it("closes several missed weeks in order", async () => {
    const ali = await h.signUp("ali");
    await score(ali.token, 100); // week 23: alone, promoted to 1
    // Written straight in: ali scored in week 24 as well, but no request came in during it.
    const [row] = await h.db.select({ id: users.id }).from(users).where(eq(users.username, "ali"));
    const [g] = await h.db.insert(leagueGroups).values({ week: NEXT_WEEK, tier: 3, memberCount: 1 }).returning({ id: leagueGroups.id });
    await h.db.insert(leagueMembers).values({ groupId: g!.id, userId: row!.id, week: NEXT_WEEK });
    h.clock.time = new Date("2026-06-13T21:00:00Z"); // week 25
    const token = (await h.signIn("g-ali")).accessToken;
    expect((await (await h.request("/v1/me/stats", { token })).json()).league).toEqual({ tier: 4 });
    expect((await h.db.select().from(leagueClosures)).map((c) => c.week).sort()).toEqual([WEEK, NEXT_WEEK]);
    expect((await h.db.select().from(userTiers))[0]).toMatchObject({ tier: 4, fromWeek: NEXT_WEEK });
  });
});
