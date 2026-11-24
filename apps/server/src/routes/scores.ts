import { createRoute, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { dailyResults, privacySettings, scoreEvents, SOLO_GAMES, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { joinLeague, leagueOf, nextTierOf } from "../leagues.js";
import { friendIds, shortPersonSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { GAME_CAPS, streakOf, totalPointsOf, weekPointsOf } from "../scores.js";
import { isRealDate, tehranDate, weekOf } from "../week.js";

const security = [{ bearerAuth: [] }];
const HOUR_MS = 3_600_000;
const FUTURE_SLACK_MS = 5 * 60_000;
const FRIENDS_MAX = 100;

const dateSchema = z.string().refine(isRealDate).openapi({ example: "2026-06-01", description: "A Tehran calendar day, yyyy-mm-dd." });

const scoreBodySchema = z
  .strictObject({
    roundId: z.uuid().openapi({ description: "Made by the phone for each round; sending it again does not count twice." }),
    game: z.enum(SOLO_GAMES),
    points: z.number().int().min(0).max(100_000),
    playedAt: z.iso.datetime({ offset: true }),
  })
  .openapi("ScoreRequest");
const scoreResultSchema = z.object({ week: z.string().openapi({ example: "2026-W23" }), weekPoints: z.number().int() }).openapi("ScoreResult");

const dailyBodySchema = z
  .strictObject({ date: dateSchema, solved: z.boolean(), tries: z.number().int().min(1).max(3) })
  .openapi("DailyRequest");
const dailyResultSchema = z.object({ date: dateSchema, solved: z.boolean(), tries: z.number().int() }).openapi("DailyResult");
const dailyFriendsSchema = z
  .object({
    solvedCount: z.number().int(),
    friends: z.array(shortPersonSchema.extend({ solved: z.boolean(), tries: z.number().int() }).openapi("DailyFriend")),
  })
  .openapi("DailyFriends");

const statsSchema = z
  .object({
    totalPoints: z.number().int(),
    weekPoints: z.number().int(),
    streakDays: z.number().int(),
    league: z.object({ tier: z.number().int().min(0).max(4) }).openapi({ description: "This week's tier; before the first score of the week, the tier the user will start in." }),
  })
  .openapi("Stats");

export function scoreRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(120, 60_000, deps.now);
  const limit = (userId: string) => {
    if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
  };
  const limits = {
    401: errorResponse("Not signed in."),
    429: errorResponse("Too many requests (120 a minute per user)."),
  };

  /** A round that is already stored: its result when it is this user's, 409 when another user's. */
  const stored = async (userId: string, roundId: string) => {
    const [row] = await db.select({ userId: scoreEvents.userId, week: scoreEvents.week }).from(scoreEvents).where(eq(scoreEvents.id, roundId));
    if (!row) return null;
    if (row.userId !== userId) throw new ApiError(409, "conflict");
    return { week: row.week, weekPoints: await weekPointsOf(db, userId, row.week) };
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/scores",
      tags: ["scores"],
      summary: "Report a finished round",
      description:
        "Idempotent on `roundId` (the same user sending it again gets the stored result and nothing is added; another user's round id is 409 `conflict`). " +
        "`daily` counts once per user per Tehran day (of `playedAt`) and `onboarding` once per user ever: a second round of either, with a new `roundId`, is 409 `conflict`. " +
        "`points` over the game's cap is 400 `points_too_high` (daily 100, jigsaw 320, poet, second and book 440, match 50, listen 100, onboarding 50). " +
        "`playedAt` must be within the last 48 hours and at most 5 minutes ahead (400 `bad_timestamp`). The round counts for the Tehran week the server receives it in, " +
        "and the first score of a week puts the user in a league group.",
      security,
      request: { body: { required: true, content: { "application/json": { schema: scoreBodySchema } } } },
      responses: {
        200: { description: "The week and the user's points this week.", content: { "application/json": { schema: scoreResultSchema } } },
        400: errorResponse("invalid_request, points_too_high or bad_timestamp."),
        409: errorResponse("conflict: the round id belongs to another user, or a daily / onboarding round already counted."),
        ...limits,
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      limit(userId);
      const body = c.req.valid("json");
      const known = await stored(userId, body.roundId);
      if (known) return c.json(known, 200);

      if (body.points > GAME_CAPS[body.game]) throw new ApiError(400, "points_too_high");
      const now = deps.now();
      const playedAt = new Date(body.playedAt);
      if (playedAt.getTime() < now.getTime() - 48 * HOUR_MS || playedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) throw new ApiError(400, "bad_timestamp");

      const week = weekOf(now);
      const added = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(scoreEvents)
          .values({ id: body.roundId, userId, game: body.game, points: body.points, playedAt, week, day: body.game === "daily" ? tehranDate(playedAt) : null, createdAt: now })
          .onConflictDoNothing()
          .returning({ id: scoreEvents.id });
        if (inserted.length === 0) return false; // the same round arrived twice at once, or the daily of that day / the onboarding round is already in
        await joinLeague(tx, userId, week);
        return true;
      });
      if (!added) {
        const same = await stored(userId, body.roundId);
        if (!same) throw new ApiError(409, "conflict"); // another round of a game that counts once
        return c.json(same, 200);
      }
      return c.json({ week, weekPoints: await weekPointsOf(db, userId, week) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/daily",
      tags: ["scores"],
      summary: "Report the daily puzzle's result",
      description:
        "One result per Tehran day, kept first-write-wins: sending the day again changes nothing and answers the stored result. " +
        "`date` may be from 48 hours ago (by Tehran date) up to today (400 `bad_timestamp`). `tries` is 1 to 3, also when not solved. The points go in `/v1/scores`.",
      security,
      request: { body: { required: true, content: { "application/json": { schema: dailyBodySchema } } } },
      responses: {
        200: { description: "The stored result.", content: { "application/json": { schema: dailyResultSchema } } },
        400: errorResponse("invalid_request or bad_timestamp."),
        ...limits,
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      limit(userId);
      const body = c.req.valid("json");
      const now = deps.now();
      if (body.date > tehranDate(now) || body.date < tehranDate(new Date(now.getTime() - 48 * HOUR_MS))) throw new ApiError(400, "bad_timestamp");
      await db.insert(dailyResults).values({ userId, date: body.date, solved: body.solved, tries: body.tries, createdAt: now }).onConflictDoNothing();
      const [row] = await db
        .select({ date: dailyResults.date, solved: dailyResults.solved, tries: dailyResults.tries })
        .from(dailyResults)
        .where(and(eq(dailyResults.userId, userId), eq(dailyResults.date, body.date)));
      return c.json(row!, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/daily/{date}/friends",
      tags: ["scores"],
      summary: "How my friends did in a day's puzzle",
      description:
        "Friends who reported that day, solved first, then by fewer tries, up to 100. A friend whose `dailyVisibility` is `me` is left out, " +
        "and not counted. `solvedCount` is how many of the listed friends solved it.",
      security,
      request: { params: z.object({ date: dateSchema }) },
      responses: {
        200: { description: "The friends' results.", content: { "application/json": { schema: dailyFriendsSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Not signed in."),
      },
    }),
    async (c) => {
      const { date } = c.req.valid("param");
      const rows = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          solved: dailyResults.solved,
          tries: dailyResults.tries,
          solvedCount: sql<number>`(count(*) filter (where ${dailyResults.solved}) over ())::int`,
        })
        .from(dailyResults)
        .innerJoin(users, eq(users.id, dailyResults.userId))
        .leftJoin(privacySettings, eq(privacySettings.userId, dailyResults.userId))
        .where(
          and(
            eq(dailyResults.date, date),
            sql`${dailyResults.userId} in ${friendIds(c.get("userId"))}`,
            sql`coalesce(${privacySettings.dailyVisibility}, 'friends') <> 'me'`,
          ),
        )
        .orderBy(desc(dailyResults.solved), asc(dailyResults.tries), asc(users.username))
        .limit(FRIENDS_MAX);
      return c.json(
        {
          solvedCount: rows[0]?.solvedCount ?? 0,
          friends: rows.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar, solved: r.solved, tries: r.tries })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/stats",
      tags: ["scores"],
      summary: "My points, streak and league",
      description:
        "`totalPoints` and `weekPoints` come from the reported rounds. `streakDays` counts the days in a row the daily puzzle was solved (reported results, Tehran dates), " +
        "ending today or yesterday; it stays until the day after the missed one ends.",
      security,
      responses: { 200: { description: "The stats.", content: { "application/json": { schema: statsSchema } } }, 401: errorResponse("Not signed in.") },
    }),
    async (c) => {
      const userId = c.get("userId");
      const now = deps.now();
      const week = weekOf(now);
      const [totalPoints, weekPoints, streakDays, league] = await Promise.all([
        totalPointsOf(db, userId),
        weekPointsOf(db, userId, week),
        streakOf(db, userId, tehranDate(now)),
        leagueOf(db, userId, week),
      ]);
      return c.json({ totalPoints, weekPoints, streakDays, league: { tier: league?.tier ?? (await nextTierOf(db, userId)) } }, 200);
    },
  );

  return app;
}
