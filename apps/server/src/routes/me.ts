import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, isNotNull } from "drizzle-orm";
import { revokeAppleToken } from "../auth/apple.js";
import { isUniqueViolation } from "../db/index.js";
import { identities, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { newRouter } from "../router.js";
import { userSchema, usernameSchema } from "../schemas.js";
import { normalizeUsername, USERNAME_CHANGE_DAYS, usernameProblem } from "../usernames.js";
import { getUserView } from "../users.js";

const security = [{ bearerAuth: [] }];
const DAY_MS = 24 * 60 * 60 * 1000;

export function meRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me",
      tags: ["me"],
      summary: "The signed-in user",
      security,
      responses: {
        200: { description: "The user.", content: { "application/json": { schema: userSchema } } },
        401: errorResponse("Not signed in."),
      },
    }),
    async (c) => c.json((await getUserView(db, c.get("userId")))!, 200),
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/me",
      tags: ["me"],
      summary: "Delete the account and everything stored for it",
      description: "Revokes the Apple token when there is one. If Apple cannot be reached the account is kept (502) so the call can be repeated.",
      security,
      responses: {
        204: { description: "Deleted." },
        401: errorResponse("Not signed in."),
        502: errorResponse("Apple could not be reached; nothing was deleted."),
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const apple = await db
        .select({ token: identities.appleRefreshToken })
        .from(identities)
        .where(and(eq(identities.userId, userId), isNotNull(identities.appleRefreshToken)));
      for (const { token } of apple) if (token) await revokeAppleToken(deps, token);
      await db.delete(users).where(eq(users.id, userId)); // sessions, identities and progress go with it
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/me/username",
      tags: ["me"],
      summary: "Set or change the username",
      description: `Free the first time; later changes only ${USERNAME_CHANGE_DAYS} days after the last one.`,
      security,
      request: { body: { required: true, content: { "application/json": { schema: z.object({ username: usernameSchema }).openapi("SetUsernameRequest") } } } },
      responses: {
        200: { description: "The user with the new username.", content: { "application/json": { schema: userSchema } } },
        400: errorResponse("The name breaks the rules (username_too_short, username_too_long, username_bad_chars, username_reserved)."),
        401: errorResponse("Not signed in."),
        409: errorResponse("username_taken, or username_change_too_soon with `allowedAt`."),
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const username = normalizeUsername(c.req.valid("json").username);
      const problem = usernameProblem(username);
      if (problem) throw new ApiError(400, `username_${problem}`);

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (user!.username === username) return c.json((await getUserView(db, userId))!, 200);
      if (user!.username !== null && user!.usernameChangedAt) {
        const allowedAt = new Date(user!.usernameChangedAt.getTime() + USERNAME_CHANGE_DAYS * DAY_MS);
        if (deps.now() < allowedAt) throw new ApiError(409, "username_change_too_soon", { allowedAt: allowedAt.toISOString() });
      }
      try {
        await db.update(users).set({ username, usernameChangedAt: deps.now() }).where(eq(users.id, userId));
      } catch (e) {
        if (isUniqueViolation(e)) throw new ApiError(409, "username_taken");
        throw e;
      }
      return c.json((await getUserView(db, userId))!, 200);
    },
  );

  return app;
}
