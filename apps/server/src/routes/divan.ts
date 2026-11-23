import { createRoute, z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { divanItems } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { newRouter } from "../router.js";

const MAX_ITEMS = 2000;
const MAX_ROWS = 20_000; // kept and removed couplets per user
const MAX_BODY = 1024 * 1024; // 2000 items with long keys and two timestamps each stay under this
const FUTURE_SLACK_MS = 5 * 60 * 1000;

const keySchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^\/[a-z0-9_\-/]+#\d{1,5}$/)
  .openapi({ example: "/hafez/ghazal/sh3#0", description: "<poemPath>#<coupletIndex>" });
const time = z.iso.datetime({ offset: true }).nullish();

const itemSchema = z
  .object({ key: keySchema, keptAt: z.iso.datetime().nullable(), removedAt: z.iso.datetime().nullable() })
  .openapi("DivanItem");
const stateSchema = z.object({ items: z.array(itemSchema) }).openapi("Divan");
const putSchema = z
  .object({
    items: z
      .array(z.strictObject({ key: keySchema, keptAt: time, removedAt: time }))
      .max(MAX_ITEMS),
  })
  .openapi("DivanSyncRequest");

const security = [{ bearerAuth: [] }];
const okResponse = {
  200: { description: "Every item stored for the user.", content: { "application/json": { schema: stateSchema } } },
  401: errorResponse("Not signed in."),
};

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

export function divanRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  const load = async (userId: string) => {
    const rows = await db.select().from(divanItems).where(eq(divanItems.userId, userId)).orderBy(sql`${divanItems.key} collate "C"`);
    return { items: rows.map((r) => ({ key: r.key, keptAt: r.keptAt?.toISOString() ?? null, removedAt: r.removedAt?.toISOString() ?? null })) };
  };

  app.openapi(
    createRoute({ method: "get", path: "/v1/me/divan", tags: ["me"], summary: "The divan: kept and removed couplets", security, responses: okResponse }),
    async (c) => c.json(await load(c.get("userId")), 200),
  );

  app.use("/v1/me/divan", async (c, next) =>
    c.req.method === "PUT" ? bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: "payload_too_large" as const }, 413) })(c, next) : next(),
  );
  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/me/divan",
      tags: ["me"],
      summary: "Merge the phone's divan into the stored one",
      description: `Up to ${MAX_ITEMS} items per request and ${MAX_ROWS} per user. Items with no timestamp are ignored. Per key the later keptAt and the later removedAt win, so a couplet is kept when keptAt is after removedAt. Repeating a request changes nothing. A timestamp more than 5 minutes ahead of the server's clock is refused (bad_timestamp). Answers the full merged state.`,
      security,
      request: { body: { required: true, content: { "application/json": { schema: putSchema } } } },
      responses: {
        ...okResponse,
        400: errorResponse("invalid_request, or bad_timestamp for a time too far ahead."),
        413: errorResponse("payload_too_large (body over 1 MB), or divan_full (the user would have more than 20 000 items)."),
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const limit = deps.now().getTime() + FUTURE_SLACK_MS;
      const byKey = new Map<string, { keptAt: Date | null; removedAt: Date | null }>();
      for (const item of c.req.valid("json").items) {
        const keptAt = item.keptAt ? new Date(item.keptAt) : null;
        const removedAt = item.removedAt ? new Date(item.removedAt) : null;
        if (!keptAt && !removedAt) continue;
        if ((keptAt && keptAt.getTime() > limit) || (removedAt && removedAt.getTime() > limit)) throw new ApiError(400, "bad_timestamp");
        const seen = byKey.get(item.key);
        byKey.set(item.key, { keptAt: later(seen?.keptAt ?? null, keptAt), removedAt: later(seen?.removedAt ?? null, removedAt) });
      }
      if (byKey.size > 0) {
        // Every request takes its row locks in the same (key) order, so two parallel syncs cannot deadlock.
        const rows = [...byKey].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, t]) => ({ userId, key, ...t }));
        await db.transaction(async (tx) => {
          await tx
            .insert(divanItems)
            .values(rows)
            .onConflictDoUpdate({
              target: [divanItems.userId, divanItems.key],
              // greatest() ignores NULL, so a missing time never erases a stored one.
              set: {
                keptAt: sql`greatest(${divanItems.keptAt}, excluded.kept_at)`,
                removedAt: sql`greatest(${divanItems.removedAt}, excluded.removed_at)`,
              },
            });
          const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(divanItems).where(eq(divanItems.userId, userId));
          if (count!.n > MAX_ROWS) throw new ApiError(413, "divan_full"); // rolls the whole request back
        });
      }
      return c.json(await load(userId), 200);
    },
  );

  return app;
}
