import { and, eq, lte, type SQL, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { dailyResults, type Game, scoreEvents } from "./db/schema.js";

/** The most one round of a game can score (from the games' own rules); anything above is refused. */
export const GAME_CAPS: Record<Game, number> = {
  daily: 100,
  jigsaw: 20 * 10 + 120,
  poet: 10 * 44,
  second: 10 * 44,
  book: 10 * 44,
  match: 50,
  listen: 100,
  onboarding: 50,
};

/** The points and last score time of some users in one week: one aggregate over the (week, user) index. `who` limits the users. */
export const weekTotals = (db: Db, week: string, who?: SQL) =>
  db
    .select({
      userId: scoreEvents.userId,
      points: sql<number>`sum(${scoreEvents.points})::int`.as("points"),
      lastAt: sql<Date>`max(${scoreEvents.createdAt})`.mapWith(scoreEvents.createdAt).as("last_at"),
    })
    .from(scoreEvents)
    .where(and(eq(scoreEvents.week, week), who))
    .groupBy(scoreEvents.userId)
    .as("totals");

export async function weekPointsOf(db: Db, userId: string, week: string): Promise<number> {
  const [row] = await db
    .select({ points: sql<number>`coalesce(sum(${scoreEvents.points}), 0)::int` })
    .from(scoreEvents)
    .where(and(eq(scoreEvents.userId, userId), eq(scoreEvents.week, week)));
  return row!.points;
}

export async function totalPointsOf(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ points: sql<number>`coalesce(sum(${scoreEvents.points}), 0)::int` })
    .from(scoreEvents)
    .where(eq(scoreEvents.userId, userId));
  return row!.points;
}

const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Days in a row the daily puzzle was solved, ending today or yesterday (Tehran dates; `today` is yyyy-mm-dd). */
export async function streakOf(db: Db, userId: string, today: string): Promise<number> {
  const rows = await db
    .select({ date: dailyResults.date })
    .from(dailyResults)
    .where(and(eq(dailyResults.userId, userId), eq(dailyResults.solved, true), lte(dailyResults.date, today)))
    .orderBy(sql`${dailyResults.date} desc`);
  let expected = rows[0]?.date === today ? today : dayBefore(today);
  let streak = 0;
  for (const { date } of rows) {
    if (date !== expected) break;
    streak++;
    expected = dayBefore(expected);
  }
  return streak;
}
