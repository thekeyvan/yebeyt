import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { leagueClosures, leagueGroups, leagueMembers, userTiers } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { weekTotals } from "./scores.js";
import { weekOf } from "./week.js";

export const TOP_TIER = 4; // tiers 0 (نوآموز) to 4 (استاد سخن)
export const GROUP_SIZE = 30;
export const PROMOTE_COUNT = 5;
export const DEMOTE_COUNT = 5;

/** The tier a user plays in next: the result of the last week closed for them, else 0. */
export async function nextTierOf(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ tier: userTiers.tier }).from(userTiers).where(eq(userTiers.userId, userId));
  return row?.tier ?? 0;
}

/** The league group a user is in for a week, if they have scored in it. */
export async function leagueOf(db: Db, userId: string, week: string) {
  const [row] = await db
    .select({ groupId: leagueMembers.groupId, tier: leagueGroups.tier })
    .from(leagueMembers)
    .innerJoin(leagueGroups, eq(leagueGroups.id, leagueMembers.groupId))
    .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.week, week)));
  return row;
}

/**
 * Puts a user in a league group for the week, if they are not in one yet. Call it inside the transaction that saves their first score.
 * The group is one of their tier with room (under 30), made if there is none. Joins of one week and tier take the same advisory lock,
 * so two of them can never fill the same last place. (`memberCount` does not go down when an account is deleted, which only leaves a group a little emptier.)
 */
export async function joinLeague(tx: Db, userId: string, week: string): Promise<void> {
  if (await leagueOf(tx, userId, week)) return;
  const tier = await nextTierOf(tx, userId);
  await tx.execute(sql`select pg_advisory_xact_lock(1, hashtext(${`${week}:${tier}`}))`);
  if (await leagueOf(tx, userId, week)) return; // the same user's other request got here first
  const [open] = await tx
    .select({ id: leagueGroups.id })
    .from(leagueGroups)
    .where(and(eq(leagueGroups.week, week), eq(leagueGroups.tier, tier), lt(leagueGroups.memberCount, GROUP_SIZE)))
    .orderBy(asc(leagueGroups.createdAt), asc(leagueGroups.id))
    .limit(1);
  const groupId = open?.id ?? (await tx.insert(leagueGroups).values({ week, tier }).returning({ id: leagueGroups.id }))[0]!.id;
  await tx.insert(leagueMembers).values({ groupId, userId, week });
  await tx.update(leagueGroups).set({ memberCount: sql`${leagueGroups.memberCount} + 1` }).where(eq(leagueGroups.id, groupId));
}

/**
 * Closes a week: in each league group the top 5 by points move up a tier and the bottom 5 of the rest move down (tiers stay within
 * 0–4), the others stay; the result is stored in `user_tiers` for the next week. Ties go to the earlier last score (the time the server
 * got it), then to the user id. In a group of 10 or fewer nobody is both: the top 5 go up first, the rest of the bottom go down.
 * Safe to repeat and to run in parallel: it takes an advisory lock and does nothing for a week already closed.
 */
export async function closeWeek(db: Db, week: string, at: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(2, 0)`);
    const [done] = await tx.select({ week: leagueClosures.week }).from(leagueClosures).where(eq(leagueClosures.week, week));
    if (done) return;

    const totals = weekTotals(tx, week);
    const points = sql<number>`coalesce(${totals.points}, 0)`;
    const members = await tx
      .select({ groupId: leagueMembers.groupId, userId: leagueMembers.userId, tier: leagueGroups.tier })
      .from(leagueMembers)
      .innerJoin(leagueGroups, eq(leagueGroups.id, leagueMembers.groupId))
      .leftJoin(totals, eq(totals.userId, leagueMembers.userId))
      .where(eq(leagueGroups.week, week))
      .orderBy(asc(leagueMembers.groupId), desc(points), asc(totals.lastAt), asc(leagueMembers.userId));

    const next: { userId: string; tier: number; fromWeek: string }[] = [];
    for (let start = 0; start < members.length; ) {
      let end = start;
      while (end < members.length && members[end]!.groupId === members[start]!.groupId) end++;
      const size = end - start;
      const promoted = Math.min(PROMOTE_COUNT, size);
      const demotedFrom = size - Math.min(DEMOTE_COUNT, size - promoted);
      for (let i = 0; i < size; i++) {
        const m = members[start + i]!;
        const shift = i < promoted ? 1 : i >= demotedFrom ? -1 : 0;
        next.push({ userId: m.userId, tier: Math.min(TOP_TIER, Math.max(0, m.tier + shift)), fromWeek: week });
      }
      start = end;
    }
    for (let i = 0; i < next.length; i += 1000) {
      await tx
        .insert(userTiers)
        .values(next.slice(i, i + 1000))
        .onConflictDoUpdate({ target: userTiers.userId, set: { tier: sql`excluded.tier`, fromWeek: sql`excluded.from_week` } });
    }
    await tx.insert(leagueClosures).values({ week, closedAt: at });
  });
}

/**
 * Closes the weeks that ended, lazily: the first request in a new week finds every earlier week that has league groups and no closure
 * and closes them oldest first. After that, requests of the same week skip the check (in memory; another server instance
 * just repeats it once and finds nothing to do).
 */
export function createWeekCloser(deps: Deps) {
  let checkedFor: string | undefined;
  let running: Promise<void> | undefined;
  return async (): Promise<void> => {
    const current = weekOf(deps.now());
    if (checkedFor === current) return;
    running ??= (async () => {
      const open = await deps.db
        .selectDistinct({ week: leagueGroups.week })
        .from(leagueGroups)
        .leftJoin(leagueClosures, eq(leagueClosures.week, leagueGroups.week))
        .where(and(lt(leagueGroups.week, current), isNull(leagueClosures.week)))
        .orderBy(asc(leagueGroups.week));
      for (const { week } of open) await closeWeek(deps.db, week, deps.now());
      checkedFor = current;
    })().finally(() => {
      running = undefined;
    });
    await running;
  };
}
