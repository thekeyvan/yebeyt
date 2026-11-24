import { createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { isCode, normalizeCode } from "../codes.js";
import { games, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { findByUsername, shortPersonSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { usernameSchema } from "../schemas.js";

const noAuth: Record<string, string[]> = {};
const publicUserSchema = shortPersonSchema.openapi("PublicUser");
const publicGameSchema = z
  .object({ kind: z.enum(["mosh", "duel"]), creator: shortPersonSchema, status: z.literal("waiting") })
  .openapi("PublicGame");

/** What the link pages on yebeyt.com show before anyone signs in: the least that names the person who sent the link. */
export function publicRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  // One bucket for the whole server: the callers are anonymous.
  const lookups = createRateLimiter(1200, 60_000, deps.now);
  const limited = errorResponse("rate_limited: 1200 lookups a minute for the whole server, both endpoints together.");

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/public/users/{username}",
      tags: ["public"],
      summary: "Who an invite link is from, for yebeyt.com/i/<username>",
      description: "No account needed. Only the username, the display name and the face.",
      security: [noAuth],
      request: { params: z.object({ username: usernameSchema }) },
      responses: {
        200: { description: "The person.", content: { "application/json": { schema: publicUserSchema } } },
        404: errorResponse("No such username."),
        429: limited,
      },
    }),
    async (c) => {
      if (!lookups.take("public")) throw new ApiError(429, "rate_limited");
      const person = await findByUsername(db, c.req.valid("param").username);
      if (!person) throw new ApiError(404, "not_found");
      return c.json({ username: person.username!, displayName: person.displayName, avatar: person.avatar }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/public/games/{code}",
      tags: ["public"],
      summary: "Who a game link is from, for yebeyt.com/g/<code>",
      description: "No account needed. Only a game that still waits for its second player; the code is read in any case, with O as 0 and I or L as 1.",
      security: [noAuth],
      request: { params: z.object({ code: z.string().max(10).refine(isCode) }) },
      responses: {
        200: { description: "The kind of game and who made it.", content: { "application/json": { schema: publicGameSchema } } },
        400: errorResponse("invalid_request: not a game code."),
        404: errorResponse("No waiting game with this code."),
        429: limited,
      },
    }),
    async (c) => {
      if (!lookups.take("public")) throw new ApiError(429, "rate_limited");
      const [row] = await db
        .select({ kind: games.kind, username: users.username, displayName: users.displayName, avatar: users.avatar })
        .from(games)
        .innerJoin(users, eq(users.id, games.createdBy))
        .where(and(eq(games.code, normalizeCode(c.req.valid("param").code)), eq(games.status, "waiting")));
      if (!row) throw new ApiError(404, "not_found");
      return c.json({ kind: row.kind, creator: { username: row.username!, displayName: row.displayName, avatar: row.avatar }, status: "waiting" as const }, 200);
    },
  );

  return app;
}
