import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull, lt, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { follows, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { findByUsername, PAGE, parseTimeCursor, personSchema, relationOf, relationSchema, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { isBlocked } from "../social.js";
import { usernameSchema } from "../schemas.js";

const security = [{ bearerAuth: [] }];
const pageSchema = z
  .object({ items: z.array(personSchema), nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }) })
  .openapi("PeoplePage");

type Direction = "following" | "followers" | "friends";
const lists: { direction: Direction; summary: string; description: string }[] = [
  { direction: "following", summary: "People I follow, newest first, 50 a page", description: "`isFriend` is true when they follow me back." },
  { direction: "followers", summary: "People who follow me, newest first, 50 a page", description: "`isFriend` is true when I follow them back. People with no username yet are left out." },
  { direction: "friends", summary: "My friends (we follow each other), 50 a page", description: "Ordered by when I followed them, newest first. `isFriend` is always true." },
];

export function followRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(120, 60_000, deps.now);

  const target = async (userId: string, username: string) => {
    if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
    const other = await findByUsername(db, username);
    if (!other) throw new ApiError(404, "not_found");
    if (other.id === userId) throw new ApiError(400, "invalid_request");
    return other;
  };
  const params = z.object({ username: usernameSchema });
  const responses = {
    200: { description: "How we follow each other now.", content: { "application/json": { schema: relationSchema } } },
    400: errorResponse("invalid_request: that is yourself."),
    401: errorResponse("Not signed in."),
    404: errorResponse("No user with that username."),
    429: errorResponse("Too many requests (120 a minute per user)."),
  };

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/follows/{username}",
      tags: ["friends"],
      summary: "Follow someone",
      description: "Idempotent. You need a username of your own (403 username_required). Two people who follow each other are friends. If either of you blocked the other, the person is not found (404).",
      security,
      request: { params },
      responses: { ...responses, 403: errorResponse("username_required: set a username first.") },
    }),
    async (c) => {
      const userId = c.get("userId");
      const other = await target(userId, c.req.valid("param").username);
      const [me] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
      if (!me?.username) throw new ApiError(403, "username_required");
      if (await isBlocked(db, userId, other.id)) throw new ApiError(404, "not_found");
      await db.insert(follows).values({ followerId: userId, followeeId: other.id, createdAt: deps.now() }).onConflictDoNothing();
      return c.json(await relationOf(db, userId, other.id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/follows/{username}",
      tags: ["friends"],
      summary: "Stop following someone",
      description: "Idempotent.",
      security,
      request: { params },
      responses,
    }),
    async (c) => {
      const userId = c.get("userId");
      const other = await target(userId, c.req.valid("param").username);
      await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, other.id)));
      return c.json(await relationOf(db, userId, other.id), 200);
    },
  );

  const rev = alias(follows, "rev");
  async function page(me: string, direction: Direction, cursor: string | undefined) {
    const other = direction === "followers" ? follows.followerId : follows.followeeId;
    const mine = direction === "followers" ? follows.followeeId : follows.followerId;
    // The edge back: from them to me when I follow them, from me to them when they follow me.
    const back: SQL =
      direction === "followers"
        ? and(eq(rev.followerId, me), eq(rev.followeeId, other))!
        : and(eq(rev.followerId, other), eq(rev.followeeId, me))!;
    const after = cursor ? parseTimeCursor(cursor)! : null;
    const rows = await db
      .select({ id: other, createdAt: follows.createdAt, username: users.username, displayName: users.displayName, avatar: users.avatar, isFriend: sql<boolean>`${rev.followerId} is not null` })
      .from(follows)
      .innerJoin(users, eq(users.id, other))
      .leftJoin(rev, back)
      .where(
        and(
          eq(mine, me),
          isNotNull(users.username),
          direction === "friends" ? isNotNull(rev.followerId) : undefined,
          after ? or(lt(follows.createdAt, after.at), and(eq(follows.createdAt, after.at), lt(other, after.id))) : undefined,
        ),
      )
      .orderBy(desc(follows.createdAt), desc(other))
      .limit(PAGE + 1);
    const items = rows.slice(0, PAGE);
    const last = items.at(-1);
    return {
      items: items.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar, isFriend: r.isFriend })),
      nextCursor: rows.length > PAGE && last ? timeCursor(last.createdAt, last.id) : null,
    };
  }

  for (const { direction, summary, description } of lists) {
    app.openapi(
      createRoute({
        method: "get",
        path: `/v1/me/${direction}`,
        tags: ["friends"],
        summary,
        description,
        security,
        request: { query: z.object({ cursor: timeCursorSchema.optional() }) },
        responses: {
          200: { description: "A page of people.", content: { "application/json": { schema: pageSchema } } },
          400: errorResponse("A malformed cursor."),
          401: errorResponse("Not signed in."),
        },
      }),
      async (c) => c.json(await page(c.get("userId"), direction, c.req.valid("query").cursor), 200),
    );
  }

  return app;
}
