import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it } from "vitest";
import { closeWeek } from "../src/leagues.js";
import { dailyResults, friendRequests, friendships, leagueMembers, reactions, scoreEvents, userTiers } from "../src/db/schema.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

describe("DELETE /v1/me with social data", () => {
  it("removes friendships, friend requests, scores, daily results, league places, tiers and reactions, and nothing of anyone else", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    await h.befriend(ali, sara);
    await h.befriend(ali, reza);
    await h.request("/v1/friend-requests/ali", { method: "POST", token: (await h.signUp("nima")).token });
    await h.request("/v1/friend-requests/sara", { method: "POST", token: ali.token }); // a friend already: nothing
    for (const u of [ali, sara]) {
      await h.request("/v1/scores", { method: "POST", token: u.token, json: { roundId: randomUUID(), game: "poet", points: 50, playedAt: h.clock.time.toISOString() } });
      await h.request("/v1/daily", { method: "POST", token: u.token, json: { date: "2026-06-01", solved: true, tries: 1 } });
      await h.request("/v1/reactions/like?key=%2Fa%2Fb%231", { method: "PUT", token: u.token });
      await h.request("/v1/reactions/repost?key=%2Fa%2Fb%231", { method: "PUT", token: u.token });
    }
    await closeWeek(h.db, "2026-W23", h.clock.time); // gives both a tier

    expect((await h.request("/v1/me", { method: "DELETE", token: ali.token })).status).toBe(204);

    const left = async (table: PgTable, column: AnyPgColumn, id: string) => (await h.db.select().from(table).where(eq(column, id))).length;
    expect(await left(friendships, friendships.userLow, ali.id)).toBe(0);
    expect(await left(friendships, friendships.userHigh, ali.id)).toBe(0);
    expect(await left(friendRequests, friendRequests.toId, ali.id)).toBe(0);
    expect(await left(scoreEvents, scoreEvents.userId, ali.id)).toBe(0);
    expect(await left(dailyResults, dailyResults.userId, ali.id)).toBe(0);
    expect(await left(leagueMembers, leagueMembers.userId, ali.id)).toBe(0);
    expect(await left(userTiers, userTiers.userId, ali.id)).toBe(0);
    expect(await left(reactions, reactions.userId, ali.id)).toBe(0);

    // Sara keeps hers (but has no friends now).
    expect(await left(friendships, friendships.userLow, sara.id)).toBe(0);
    expect(await left(friendships, friendships.userHigh, sara.id)).toBe(0);
    expect(await left(scoreEvents, scoreEvents.userId, sara.id)).toBe(1);
    expect(await left(dailyResults, dailyResults.userId, sara.id)).toBe(1);
    expect(await left(leagueMembers, leagueMembers.userId, sara.id)).toBe(1);
    expect(await left(userTiers, userTiers.userId, sara.id)).toBe(1);
    expect(await left(reactions, reactions.userId, sara.id)).toBe(2);
    const board = await h.request("/v1/leaderboard/league", { token: sara.token });
    expect(((await board.json()) as { rows: unknown[] }).rows).toHaveLength(1);
  });
});
