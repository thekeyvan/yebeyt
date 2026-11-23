import { createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";
import { newRouter } from "../router.js";

export function healthRoutes(deps: Deps) {
  const app = newRouter();
  const body = z.object({ status: z.literal("ok") }).openapi("Health");

  app.openapi(
    createRoute({
      method: "get",
      path: "/health",
      tags: ["health"],
      summary: "Is the server up and the database reachable?",
      responses: {
        200: { description: "Up.", content: { "application/json": { schema: body } } },
        503: { description: "The database does not answer.", content: { "application/json": { schema: z.object({ error: z.literal("unavailable") }) } } },
      },
    }),
    async (c) => {
      try {
        await deps.db.execute(sql`select 1`);
      } catch {
        throw new ApiError(503, "unavailable");
      }
      return c.json({ status: "ok" as const }, 200);
    },
  );

  return app;
}
