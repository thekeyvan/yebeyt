import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { reactions } from "../db/schema.js";
import type { Db } from "../db/index.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { coupletKeySchema } from "../schemas.js";

const security = [{ bearerAuth: [] }];
const MAX_KEYS = 50;
const MINE_PAGE = 200;

const kindSchema = z.enum(["like", "repost"]);
const keyQuery = z.object({ key: coupletKeySchema.openapi({ description: "The couplet key; the `#` must be percent-encoded (`%23`)." }) });
const countsSchema = z
  .object({ likes: z.number().int(), reposts: z.number().int(), likedByMe: z.boolean(), repostedByMe: z.boolean() })
  .openapi("ReactionCounts");

const mineSchema = z
  .object({
    items: z.array(z.object({ key: coupletKeySchema, kind: kindSchema, at: z.iso.datetime() })),
    nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }),
  })
  .openapi("MyReactions");

/** The cursor is the last row's "<time>|<kind>|<key>" (a key never holds a bar), so rows of the same time are never skipped. */
function parseMineCursor(cursor: string): { at: Date; kind: "like" | "repost"; key: string } | null {
  const [time, kind, key, ...rest] = cursor.split("|");
  const at = new Date(time ?? "");
  // Re-printing the date must give the same text, which refuses dates that do not exist (30 February).
  if (rest.length > 0 || Number.isNaN(at.getTime()) || at.toISOString() !== time) return null;
  if ((kind !== "like" && kind !== "repost") || !coupletKeySchema.safeParse(key).success) return null;
  return { at, kind, key: key! };
}
const mineCursorSchema = z.string().max(300).refine((v) => parseMineCursor(v) !== null);

/** The keys of a comma list: 1 to 50 couplet keys (a key never holds a comma). Repeats count once. */
function parseKeys(list: string): string[] | null {
  const keys = list.split(",");
  if (keys.length > MAX_KEYS || !keys.every((k) => coupletKeySchema.safeParse(k).success)) return null;
  return [...new Set(keys)];
}
const keysSchema = z
  .string()
  .max(MAX_KEYS * 201)
  .refine((v) => parseKeys(v) !== null)
  .openapi({ description: `Up to ${MAX_KEYS} couplet keys, comma separated (the \`#\` in a key must be percent-encoded).`, example: "/hafez/ghazal/sh3#0,/saadi/ghazal/sh1#4" });

async function countsFor(db: Db, userId: string, keys: string[]) {
  const rows = await db
    .select({
      key: reactions.key,
      kind: reactions.kind,
      n: sql<number>`count(*)::int`,
      mine: sql<boolean>`coalesce(bool_or(${reactions.userId} = ${userId}), false)`,
    })
    .from(reactions)
    .where(inArray(reactions.key, keys))
    .groupBy(reactions.key, reactions.kind);
  const out: Record<string, z.infer<typeof countsSchema>> = {};
  for (const key of keys) out[key] = { likes: 0, reposts: 0, likedByMe: false, repostedByMe: false };
  for (const r of rows) {
    const entry = out[r.key]!;
    if (r.kind === "like") Object.assign(entry, { likes: r.n, likedByMe: r.mine });
    else Object.assign(entry, { reposts: r.n, repostedByMe: r.mine });
  }
  return out;
}

export function reactionRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(120, 60_000, deps.now);
  const request = { params: z.object({ kind: kindSchema }), query: keyQuery };
  const responses = {
    200: { description: "The couplet's counts after the change.", content: { "application/json": { schema: countsSchema } } },
    400: errorResponse("invalid_request: a bad kind or key."),
    401: errorResponse("Not signed in."),
    429: errorResponse("Too many requests (120 a minute per user)."),
  };

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/reactions/{kind}",
      tags: ["reactions"],
      summary: "Like or repost a couplet",
      description: "`kind` is `like` or `repost`. Idempotent. The couplet is the `key` query parameter (no body). A reaction is social by nature: friends see it in their feed. Reposting a couplet is only this reaction.",
      security,
      request,
      responses,
    }),
    async (c) => {
      const userId = c.get("userId");
      if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
      const { key } = c.req.valid("query");
      await db.insert(reactions).values({ userId, key, kind: c.req.valid("param").kind, createdAt: deps.now() }).onConflictDoNothing();
      return c.json((await countsFor(db, userId, [key]))[key]!, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/reactions/{kind}",
      tags: ["reactions"],
      summary: "Take back a like or a repost",
      description: "Idempotent. The couplet is the `key` query parameter (no body).",
      security,
      request,
      responses,
    }),
    async (c) => {
      const userId = c.get("userId");
      if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
      const { key } = c.req.valid("query");
      await db.delete(reactions).where(and(eq(reactions.userId, userId), eq(reactions.key, key), eq(reactions.kind, c.req.valid("param").kind)));
      return c.json((await countsFor(db, userId, [key]))[key]!, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/reactions/counts",
      tags: ["reactions"],
      summary: "Likes and reposts of up to 50 couplets",
      description: "Everyone's reactions are counted, not only friends'. Every asked key is in the answer, with zeros when nobody reacted.",
      security,
      request: { query: z.object({ keys: keysSchema }) },
      responses: {
        200: { description: "Counts by key.", content: { "application/json": { schema: z.record(z.string(), countsSchema).openapi("ReactionCountsByKey") } } },
        400: errorResponse("invalid_request: a bad key, or more than 50."),
        401: errorResponse("Not signed in."),
      },
    }),
    async (c) => c.json(await countsFor(db, c.get("userId"), parseKeys(c.req.valid("query").keys)!), 200),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/reactions",
      tags: ["reactions"],
      summary: "My own likes and reposts",
      description: "Newest first, 200 a page. The phone pulls them when it signs in.",
      security,
      request: { query: z.object({ cursor: mineCursorSchema.optional() }) },
      responses: {
        200: { description: "A page of my reactions.", content: { "application/json": { schema: mineSchema } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
      },
    }),
    async (c) => {
      const given = c.req.valid("query").cursor;
      const cursor = given ? parseMineCursor(given)! : null;
      // Newest first, then kind and key descending as a fixed tie-break ("C" compares bytes, so the order is the same everywhere).
      const tie = sql`(${reactions.kind}::text || '|' || ${reactions.key}) collate "C"`;
      const rows = await db
        .select({ key: reactions.key, kind: reactions.kind, at: reactions.createdAt })
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, c.get("userId")),
            cursor
              ? sql`(${reactions.createdAt} < ${cursor.at.toISOString()}::timestamptz or (${reactions.createdAt} = ${cursor.at.toISOString()}::timestamptz and ${tie} < ${`${cursor.kind}|${cursor.key}`}))`
              : undefined,
          ),
        )
        .orderBy(desc(reactions.createdAt), sql`${tie} desc`)
        .limit(MINE_PAGE + 1);
      const page = rows.slice(0, MINE_PAGE);
      const last = page.at(-1);
      return c.json(
        {
          items: page.map((r) => ({ key: r.key, kind: r.kind, at: r.at.toISOString() })),
          nextCursor: rows.length > MINE_PAGE && last ? `${last.at.toISOString()}|${last.kind}|${last.key}` : null,
        },
        200,
      );
    },
  );

  return app;
}
