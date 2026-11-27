import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { progress } from "../db/schema.js";
import type { Db } from "../db/index.js";
import type { Deps } from "../deps.js";
import { errorResponse } from "../errors.js";
import { newRouter } from "../router.js";

const int = z.number().int().min(0).max(2_000_000_000);

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};

const progressSchema = z
  .object({
    points: int,
    streakDays: int,
    streakLastDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isRealDate)
      .nullable()
      .openapi({ example: "2026-06-01" }),
    bestByGame: z.record(z.string().regex(/^[a-z0-9_-]{1,40}$/), int).refine((o) => Object.keys(o).length <= 50),
  })
  .openapi("Progress");

export type Progress = z.infer<typeof progressSchema>;

const security = [{ bearerAuth: [] }];
const okResponse = {
  200: { description: "The stored progress.", content: { "application/json": { schema: progressSchema } } },
  401: errorResponse("Not signed in."),
};

/** The larger value of each field; also used when an empty account is merged into another (src/mergeAccounts.ts). */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const best = { ...a.bestByGame };
  for (const [game, points] of Object.entries(b.bestByGame)) best[game] = Math.max(best[game] ?? 0, points);
  const dates = [a.streakLastDate, b.streakLastDate].filter((d): d is string => d !== null).sort();
  return {
    points: Math.max(a.points, b.points),
    streakDays: Math.max(a.streakDays, b.streakDays),
    streakLastDate: dates.at(-1) ?? null,
    bestByGame: best,
  };
}

const empty: Progress = { points: 0, streakDays: 0, streakLastDate: null, bestByGame: {} };

async function load(db: Db, userId: string): Promise<Progress> {
  const [row] = await db.select().from(progress).where(eq(progress.userId, userId));
  return row
    ? { points: row.points, streakDays: row.streakDays, streakLastDate: row.streakLastDate, bestByGame: row.bestByGame }
    : empty;
}

export function progressRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  app.openapi(
    createRoute({ method: "get", path: "/v1/me/progress", tags: ["me"], summary: "Points, streak and best scores", security, responses: okResponse }),
    async (c) => c.json(await load(db, c.get("userId")), 200),
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/me/progress",
      tags: ["me"],
      summary: "Add progress made as a guest",
      description: "Merged with what is stored, keeping the larger value of each field (and, per game, of each best score).",
      security,
      request: { body: { required: true, content: { "application/json": { schema: progressSchema } } } },
      responses: { ...okResponse, 400: errorResponse("Bad request.") },
    }),
    async (c) => {
      const userId = c.get("userId");
      const incoming = c.req.valid("json");
      const merged = await db.transaction(async (tx) => {
        await tx.insert(progress).values({ userId }).onConflictDoNothing();
        const [row] = await tx.select().from(progress).where(eq(progress.userId, userId)).for("update");
        const next = mergeProgress(
          { points: row!.points, streakDays: row!.streakDays, streakLastDate: row!.streakLastDate, bestByGame: row!.bestByGame },
          incoming,
        );
        await tx.update(progress).set({ ...next, updatedAt: deps.now() }).where(eq(progress.userId, userId));
        return next;
      });
      return c.json(merged, 200);
    },
  );

  return app;
}
