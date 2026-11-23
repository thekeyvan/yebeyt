import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "./auth/sessions.js";
import { constantTimeEqual } from "./crypto.js";
import { users } from "./db/schema.js";
import type { AppEnv, Deps } from "./deps.js";
import { ApiError } from "./errors.js";

const bearer = (header: string | undefined): string | null => {
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  return m?.[1] ?? null;
};

/** Requires a valid access token for a user that still exists; sets `userId`. */
export const requireUser = (deps: Deps) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = bearer(c.req.header("authorization"));
    if (!token) throw new ApiError(401, "unauthorized");
    const userId = await verifyAccessToken(deps, token);
    const [user] = await deps.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) throw new ApiError(401, "unauthorized");
    c.set("userId", userId);
    await next();
  });

/** Requires `Authorization: Bearer <ADMIN_TOKEN>`. */
export const requireAdmin = (deps: Deps) =>
  createMiddleware(async (c, next) => {
    const token = bearer(c.req.header("authorization"));
    if (!token || !constantTimeEqual(token, deps.config.adminToken)) throw new ApiError(401, "unauthorized");
    await next();
  });
