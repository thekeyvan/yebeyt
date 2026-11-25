import { createRoute, z } from "@hono/zod-openapi";
import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import { friendships, privacySettings, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { leagueOf } from "../leagues.js";
import { canMessage } from "../messaging.js";
import { canPlaySchema, findByUsername, friendshipOf, friendshipSchema, friendshipSql, shortPersonSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { isBlocked, notBlockedWith } from "../social.js";
import { weekPointsOf } from "../scores.js";
import { usernameSchema } from "../schemas.js";
import { normalizeUsername } from "../usernames.js";
import { weekOf } from "../week.js";

const security = [{ bearerAuth: [] }];
const SEARCH_MIN = 2;
const SEARCH_MAX_RESULTS = 20;

const profileSchema = shortPersonSchema
  .extend({
    friendsCount: z.number().int(),
    friendship: friendshipSchema,
    isFriend: z.boolean().openapi({ description: "`friendship` is `friends`." }),
    canMessage: z.boolean().openapi({ description: "I may write to them now: nobody blocked the other, and their «بهم پیام بده» lets me (or they already wrote to me in our chat). Never for myself." }),
    league: z.object({ tier: z.number().int().min(0).max(4) }).nullable().openapi({ description: "This week's tier; null before their first score of the week, and for a stranger who keeps off the global leaderboard (same rule as `weekPoints`)." }),
    weekPoints: z.number().int().nullable().openapi({ description: "Only for a friend, for yourself, or someone who allows the global leaderboard; else null." }),
  })
  .openapi("PublicProfile");

const foundSchema = shortPersonSchema.extend({ canPlay: canPlaySchema, friendship: friendshipSchema, isFriend: z.boolean() }).openapi("FoundPerson");
const searchSchema = z.object({ items: z.array(foundSchema).max(SEARCH_MAX_RESULTS) }).openapi("UserSearch");

/** Escapes `\`, `%` and `_` so the text matches itself in a LIKE pattern (`_` is a valid username character). */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export function peopleRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const searchLimiter = createRateLimiter(60, 60_000, deps.now);

  // Registered before the profile route, so "search" is never taken for a username (it is a reserved name).
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/users/search",
      tags: ["friends"],
      summary: "Find people by the start of their username",
      description: `Case-insensitive prefix match on the username, at least ${SEARCH_MIN} characters, up to ${SEARCH_MAX_RESULTS} results in alphabetical order, never including me or anyone who blocked me or whom I blocked. 60 searches a minute per user.`,
      security,
      request: { query: z.object({ q: z.string().max(100) }) },
      responses: {
        200: { description: "The people found.", content: { "application/json": { schema: searchSchema } } },
        400: errorResponse(`invalid_request: shorter than ${SEARCH_MIN} characters after trimming.`),
        401: errorResponse("Not signed in."),
        429: errorResponse("Too many searches (60 a minute per user)."),
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      if (!searchLimiter.take(userId)) throw new ApiError(429, "rate_limited");
      const q = normalizeUsername(c.req.valid("query").q);
      if ([...q].length < SEARCH_MIN) throw new ApiError(400, "invalid_request");
      const rows = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          isHouse: users.isHouse,
          friendship: friendshipSql(userId, users.id),
        })
        .from(users)
        .where(and(sql`${users.username} like ${`${likeEscape(q)}%`}`, ne(users.id, userId), notBlockedWith(userId, users.id)))
        .orderBy(asc(users.username))
        .limit(SEARCH_MAX_RESULTS);
      return c.json(
        { items: rows.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar, canPlay: !r.isHouse, friendship: r.friendship, isFriend: r.friendship === "friends" })) },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/users/{username}",
      tags: ["friends"],
      summary: "A person's public profile",
      description:
        "Name, avatar, how many friends they have, whether we are friends or a request is open (`friendship`). Their league tier and points this week are given only to a friend, to themselves " +
        "and when they allow the global leaderboard.",
      security,
      request: { params: z.object({ username: usernameSchema }) },
      responses: {
        200: { description: "The profile.", content: { "application/json": { schema: profileSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Not signed in."),
        404: errorResponse("No user with that username, or one of us blocked the other."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const person = await findByUsername(db, c.req.valid("param").username);
      if (!person || (await isBlocked(db, me, person.id))) throw new ApiError(404, "not_found");
      const week = weekOf(deps.now());
      const [friendship, [privacy], [count], league, mayWrite] = await Promise.all([
        friendshipOf(db, me, person.id),
        db.select({ inGlobal: privacySettings.inGlobalLeaderboard }).from(privacySettings).where(eq(privacySettings.userId, person.id)),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(friendships)
          .where(or(eq(friendships.userLow, person.id), eq(friendships.userHigh, person.id))),
        leagueOf(db, person.id, week),
        canMessage(db, me, person.id),
      ]);
      // Tier and points follow one rule: a friend, yourself, or someone who allows the global leaderboard.
      const sharesPoints = friendship === "friends" || person.id === me || privacy?.inGlobal === true;
      return c.json(
        {
          username: person.username!,
          displayName: person.displayName,
          avatar: person.avatar,
          friendsCount: person.isHouse ? 0 : count!.n, // «یه بیت» is everyone's friend, so its count says nothing
          friendship,
          isFriend: friendship === "friends",
          canMessage: mayWrite,
          league: league && sharesPoints ? { tier: league.tier } : null,
          weekPoints: sharesPoints ? await weekPointsOf(db, person.id, week) : null,
        },
        200,
      );
    },
  );

  return app;
}
