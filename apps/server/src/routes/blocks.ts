import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { blocks, friendRequests, friendships, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { findByUsername, PAGE, parseTimeCursor, shortPersonSchema, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { usernameSchema } from "../schemas.js";
import { orderedPair } from "../social.js";

const security = [{ bearerAuth: [] }];
const pageSchema = z
  .object({ items: z.array(shortPersonSchema), nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }) })
  .openapi("BlockedPage");

export function blockRoutes(deps: Deps) {
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
  const request = { params: z.object({ username: usernameSchema }) };
  const responses = {
    204: { description: "Done." },
    400: errorResponse("invalid_request: that is yourself."),
    401: errorResponse("Not signed in."),
    403: errorResponse("username_required: set a username first."),
    404: errorResponse("No user with that username."),
    429: errorResponse("Too many requests (120 a minute per user)."),
  };

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/blocks/{username}",
      tags: ["safety"],
      summary: "Block someone",
      description:
        "Idempotent. Removes the friendship and the friend requests between the two. A blocked pair cannot send friend requests, message or share a divan with each other (and cannot invite each other to games), " +
        "and each is hidden from the other's profile lookup (404) and search. The blocked person is not told.",
      security,
      request,
      responses,
    }),
    async (c) => {
      const userId = c.get("userId");
      const other = await target(userId, c.req.valid("param").username);
      await db.transaction(async (tx) => {
        await tx.insert(blocks).values({ blockerId: userId, blockedId: other.id, createdAt: deps.now() }).onConflictDoNothing();
        const { userLow, userHigh } = orderedPair(userId, other.id);
        await tx.delete(friendships).where(and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh)));
        await tx.delete(friendRequests).where(or(and(eq(friendRequests.fromId, userId), eq(friendRequests.toId, other.id)), and(eq(friendRequests.fromId, other.id), eq(friendRequests.toId, userId))));
      });
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/blocks/{username}",
      tags: ["safety"],
      summary: "Unblock someone",
      description: "Idempotent. The friendship and requests removed by the block do not come back.",
      security,
      request,
      responses,
    }),
    async (c) => {
      const userId = c.get("userId");
      const other = await target(userId, c.req.valid("param").username);
      await db.delete(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, other.id)));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/blocks",
      tags: ["safety"],
      summary: "People I blocked, newest first, 50 a page",
      security,
      request: { query: z.object({ cursor: timeCursorSchema.optional() }) },
      responses: {
        200: { description: "A page of people.", content: { "application/json": { schema: pageSchema } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
      },
    }),
    async (c) => {
      const { cursor } = c.req.valid("query");
      const after = cursor ? parseTimeCursor(cursor)! : null;
      const rows = await db
        .select({ id: blocks.blockedId, createdAt: blocks.createdAt, username: users.username, displayName: users.displayName, avatar: users.avatar })
        .from(blocks)
        .innerJoin(users, eq(users.id, blocks.blockedId))
        .where(
          and(
            eq(blocks.blockerId, c.get("userId")),
            isNotNull(users.username),
            after ? or(lt(blocks.createdAt, after.at), and(eq(blocks.createdAt, after.at), sql`${blocks.blockedId} < ${after.id}`)) : undefined,
          ),
        )
        .orderBy(desc(blocks.createdAt), desc(blocks.blockedId))
        .limit(PAGE + 1);
      const items = rows.slice(0, PAGE);
      const last = items.at(-1);
      return c.json(
        {
          items: items.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar })),
          nextCursor: rows.length > PAGE && last ? timeCursor(last.createdAt, last.id) : null,
        },
        200,
      );
    },
  );

  return app;
}
