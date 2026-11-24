import { createRoute, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { leagueMembers, privacySettings, scoreEvents, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { errorResponse } from "../errors.js";
import { DEMOTE_COUNT, leagueOf, nextTierOf, PROMOTE_COUNT } from "../leagues.js";
import { friendIds, PAGE } from "../people.js";
import { newRouter } from "../router.js";
import { weekTotals } from "../scores.js";
import { avatarSchema } from "../schemas.js";
import { weekEnd, weekOf } from "../week.js";

const security = [{ bearerAuth: [] }];
const FRIENDS_MAX = 100;

const rowSchema = z
  .object({
    rank: z.number().int().min(1),
    username: z.string().nullable().openapi({ description: "Null for someone who has not chosen a username yet, and when `hidden`." }),
    displayName: z.string().nullable(),
    avatar: avatarSchema.nullable(),
    points: z.number().int(),
    isMe: z.boolean(),
    hidden: z.boolean().openapi({ description: "League only: a stranger who keeps off the global leaderboard. Show «یه نفر»; username, name and picture are null, the points are real." }),
  })
  .openapi("LeaderboardRow");
const week = z.string().openapi({ example: "2026-W23", description: "The Tehran week, Saturday to Friday." });

const leagueSchema = z
  .object({
    week,
    tier: z.number().int().min(0).max(4).openapi({ description: "0 نوآموز, 1 بیت‌خوان, 2 غزل‌باز, 3 سخن‌دان, 4 استاد سخن." }),
    endsAt: z.iso.datetime().openapi({ description: "When the week ends (Friday midnight in Tehran)." }),
    rows: z.array(rowSchema).openapi({ description: "My league group, best first. Empty until my first score of the week." }),
    promoteCount: z.literal(PROMOTE_COUNT),
    demoteCount: z.literal(DEMOTE_COUNT),
  })
  .openapi("LeagueStandings");
const friendsSchema = z.object({ week, rows: z.array(rowSchema) }).openapi("FriendsStandings");
const globalSchema = z
  .object({
    week,
    rows: z.array(rowSchema),
    me: rowSchema.nullable().openapi({ description: "My own rank, even when I am not on the list (my `inGlobalLeaderboard` is off). Null before my first score of the week." }),
    nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }),
  })
  .openapi("GlobalStandings");

/** "<rank of the last row>_<its points>_<its user id>". */
const cursorPattern = /^(\d{1,7})_(\d{1,9})_([0-9a-f-]{36})$/;
const cursorSchema = z.string().max(80).refine((v) => cursorPattern.test(v) && z.uuid().safeParse(v.split("_")[2]).success);

export function leaderboardRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const responses = (schema: z.ZodType, description: string) => ({
    200: { description, content: { "application/json": { schema } } },
    401: errorResponse("Not signed in."),
  });

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/leaderboard/league",
      tags: ["leaderboard"],
      summary: "My league this week",
      description:
        "Groups of up to 30 people of one tier. A stranger in the group who is not on the global list is `hidden`: no username, name or picture (the app shows «یه نفر»), but their points and rank are real; friends and people on the global list show normally. The first score of a week puts me in a group of the tier I earned last week (tier 0 to begin with). " +
        "At the week's end the top 5 move up a tier and the bottom 5 down (ties go to the earlier last score). Before my first score of the week `rows` is empty and `tier` is the one I will start in.",
      security,
      responses: responses(leagueSchema, "The standings."),
    }),
    async (c) => {
      const userId = c.get("userId");
      const now = deps.now();
      const current = weekOf(now);
      const mine = await leagueOf(db, userId, current);
      let rows: z.infer<typeof rowSchema>[] = [];
      if (mine) {
        const totals = weekTotals(db, current, sql`${scoreEvents.userId} in (select user_id from league_members where group_id = ${mine.groupId})`);
        const points = sql<number>`coalesce(${totals.points}, 0)`;
        // A stranger who is not on the global list shows as «یه نفر»: the points count, the person stays unnamed.
        const hidden = sql<boolean>`(${users.id} <> ${userId} and not coalesce(${privacySettings.inGlobalLeaderboard}, false) and ${users.id} not in ${friendIds(userId)})`;
        const found = await db
          .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar, points, hidden })
          .from(leagueMembers)
          .innerJoin(users, eq(users.id, leagueMembers.userId))
          .leftJoin(privacySettings, eq(privacySettings.userId, leagueMembers.userId))
          .leftJoin(totals, eq(totals.userId, leagueMembers.userId))
          .where(eq(leagueMembers.groupId, mine.groupId))
          .orderBy(desc(points), asc(totals.lastAt), asc(users.id));
        rows = found.map((r, i) => ({
          rank: i + 1,
          username: r.hidden ? null : r.username,
          displayName: r.hidden ? null : r.displayName,
          avatar: r.hidden ? null : r.avatar,
          points: r.points,
          isMe: r.id === userId,
          hidden: r.hidden,
        }));
      }
      return c.json(
        {
          week: current,
          tier: mine?.tier ?? (await nextTierOf(db, userId)),
          endsAt: weekEnd(current).toISOString(),
          rows,
          promoteCount: PROMOTE_COUNT,
          demoteCount: DEMOTE_COUNT,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/leaderboard/friends",
      tags: ["leaderboard"],
      summary: "This week's points: me and my friends",
      description: "Friends with no score are listed with 0. Best first, then by username; up to 100.",
      security,
      responses: responses(friendsSchema, "The standings."),
    }),
    async (c) => {
      const userId = c.get("userId");
      const current = weekOf(deps.now());
      const circle = sql`(${users.id} = ${userId} or (${users.id} in ${friendIds(userId)} and not ${users.isHouse}))`;
      const totals = weekTotals(db, current, sql`(${scoreEvents.userId} = ${userId} or ${scoreEvents.userId} in ${friendIds(userId)})`);
      const points = sql<number>`coalesce(${totals.points}, 0)`;
      const found = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar, points })
        .from(users)
        .leftJoin(totals, eq(totals.userId, users.id))
        .where(circle)
        .orderBy(desc(points), asc(users.username), asc(users.id))
        .limit(FRIENDS_MAX);
      const rows = found.map((r, i) => ({ rank: i + 1, username: r.username, displayName: r.displayName, avatar: r.avatar, points: r.points, isMe: r.id === userId, hidden: false }));
      return c.json({ week: current, rows }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/leaderboard/global",
      tags: ["leaderboard"],
      summary: "This week's points: everyone who allows it",
      description:
        "People with `inGlobalLeaderboard` on (and a username) who scored this week, best first (ties by user id), 50 a page. `me` is my own rank among them, " +
        "also when I am hidden; null before my first score of the week.",
      security,
      request: { query: z.object({ cursor: cursorSchema.optional() }) },
      responses: { ...responses(globalSchema, "A page of the standings."), 400: errorResponse("A malformed cursor.") },
    }),
    async (c) => {
      const userId = c.get("userId");
      const current = weekOf(deps.now());
      const cursor = c.req.valid("query").cursor?.split("_");
      const after = cursor ? { rank: Number(cursor[0]), points: Number(cursor[1]), id: cursor[2]! } : null;

      const allowed = sql`${scoreEvents.userId} in (select user_id from ${privacySettings} where ${privacySettings.inGlobalLeaderboard})`;
      const totals = weekTotals(db, current, allowed);
      const found = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar, points: totals.points })
        .from(totals)
        .innerJoin(users, eq(users.id, totals.userId))
        .where(
          and(
            isNotNull(users.username),
            after ? or(sql`${totals.points} < ${after.points}`, and(sql`${totals.points} = ${after.points}`, sql`${users.id} > ${after.id}`)) : undefined,
          ),
        )
        .orderBy(desc(totals.points), asc(users.id))
        .limit(PAGE + 1);
      const first = after?.rank ?? 0;
      const page = found.slice(0, PAGE);
      const toRow = (r: (typeof found)[number], rank: number) => ({ rank, username: r.username, displayName: r.displayName, avatar: r.avatar, points: r.points, isMe: r.id === userId, hidden: false });
      const rows = page.map((r, i) => toRow(r, first + i + 1));
      const last = page.at(-1);

      const [mineRow] = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar, points: sql<number>`sum(${scoreEvents.points})::int` })
        .from(scoreEvents)
        .innerJoin(users, eq(users.id, scoreEvents.userId))
        .where(and(eq(scoreEvents.userId, userId), eq(scoreEvents.week, current)))
        .groupBy(users.id);
      let me = null;
      if (mineRow) {
        const [ahead] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(totals)
          .innerJoin(users, eq(users.id, totals.userId))
          .where(and(isNotNull(users.username), or(sql`${totals.points} > ${mineRow.points}`, and(sql`${totals.points} = ${mineRow.points}`, sql`${users.id} < ${userId}`))));
        me = toRow(mineRow, ahead!.n + 1);
      }
      return c.json({ week: current, rows, me, nextCursor: found.length > PAGE && last ? `${first + page.length}_${last.points}_${last.id}` : null }, 200);
    },
  );

  return app;
}
