import { createRoute, z } from "@hono/zod-openapi";
import { and, inArray, or, type SQL, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { dailyResults, reactions, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { errorResponse } from "../errors.js";
import { friendIdsOf, shortPersonSchema } from "../people.js";
import { newRouter } from "../router.js";
import { coupletKeySchema } from "../schemas.js";

const security = [{ bearerAuth: [] }];
const FEED_PAGE = 30;

const itemSchema = z
  .object({
    type: z.enum(["like", "repost", "daily"]),
    user: shortPersonSchema,
    key: coupletKeySchema.optional().openapi({ description: "The couplet, for a like or a repost." }),
    date: z.string().optional().openapi({ example: "2026-06-01", description: "The Tehran day, for a daily result." }),
    tries: z.number().int().optional().openapi({ description: "Tries it took, for a daily result." }),
    at: z.iso.datetime(),
  })
  .openapi("FeedItem");
const feedSchema = z
  .object({ items: z.array(itemSchema), nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }) })
  .openapi("Feed");

/** The cursor is the last item's "<time>|<tie>", where `tie` tells apart items of the same time (user, kind and key or date). */
function parseCursor(cursor: string): { at: Date; tie: string } | null {
  const bar = cursor.indexOf("|");
  if (bar < 0) return null;
  const time = cursor.slice(0, bar);
  const at = new Date(time);
  const tie = cursor.slice(bar + 1);
  // Re-printing the date must give the same text, which refuses dates that do not exist (30 February).
  if (Number.isNaN(at.getTime()) || at.toISOString() !== time || tie.length === 0) return null;
  return { at, tie };
}
const cursorSchema = z.string().max(400).refine((v) => parseCursor(v) !== null);

export function feedRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/feed",
      tags: ["feed"],
      summary: "What my friends did: the home «دوستات» feed",
      description:
        "Newest first, 30 a page, from friends only (people who follow each other). Likes and reposts are always shown, since they are social by nature. " +
        "A friend's solved daily puzzle is shown only when their `dailyVisibility` is `friends`. Taking back a like, or ending the friendship, removes the item.",
      security,
      request: { query: z.object({ cursor: cursorSchema.optional() }) },
      responses: {
        200: { description: "A page of items.", content: { "application/json": { schema: feedSchema } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const given = c.req.valid("query").cursor;
      const cursor = given ? parseCursor(given)! : null;
      const friends = friendIdsOf(me);

      // Both kinds of item come out as the same columns. `tie` is compared as bytes ("C"), so the order is the same everywhere.
      const tieOf = (expr: SQL) => sql<string>`(${expr}) collate "C"`;
      const reactionTie = tieOf(sql`${reactions.userId}::text || ':' || ${reactions.kind} || ':' || ${reactions.key}`);
      const dailyTie = tieOf(sql`${dailyResults.userId}::text || ':daily:' || ${dailyResults.date}::text`);
      const before = (at: SQL, tie: SQL) =>
        cursor ? or(sql`${at} < ${cursor.at.toISOString()}::timestamptz`, and(sql`${at} = ${cursor.at.toISOString()}::timestamptz`, sql`${tie} < ${cursor.tie}`)) : undefined;

      const fromReactions = db
        .select({
          kind: sql<string>`${reactions.kind}::text`.as("kind"),
          userId: sql<string>`${reactions.userId}`.as("user_id"),
          key: sql<string | null>`${reactions.key}::text`.as("key"),
          date: sql<string | null>`null::text`.as("date"),
          tries: sql<number | null>`null::int`.as("tries"),
          happenedAt: sql<Date>`${reactions.createdAt}`.mapWith(reactions.createdAt).as("happened_at"),
          tie: reactionTie.as("tie"),
        })
        .from(reactions)
        .where(and(sql`${reactions.userId} in ${friends}`, before(sql`${reactions.createdAt}`, reactionTie)));
      const fromDaily = db
        .select({
          kind: sql<string>`'daily'::text`.as("kind"),
          userId: sql<string>`${dailyResults.userId}`.as("user_id"),
          key: sql<string | null>`null::text`.as("key"),
          date: sql<string | null>`${dailyResults.date}::text`.as("date"),
          tries: sql<number | null>`${dailyResults.tries}::int`.as("tries"),
          happenedAt: sql<Date>`${dailyResults.createdAt}`.mapWith(dailyResults.createdAt).as("happened_at"),
          tie: dailyTie.as("tie"),
        })
        .from(dailyResults)
        .where(
          and(
            sql`${dailyResults.solved}`,
            sql`${dailyResults.userId} in ${friends}`,
            sql`not exists (select 1 from privacy_settings p where p.user_id = ${dailyResults.userId} and p.daily_visibility = 'me')`,
            before(sql`${dailyResults.createdAt}`, dailyTie),
          ),
        );
      const rows = await unionAll(fromReactions, fromDaily)
        .orderBy(sql`happened_at desc, tie desc`)
        .limit(FEED_PAGE + 1);

      const page = rows.slice(0, FEED_PAGE);
      const people = page.length
        ? await db
            .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar })
            .from(users)
            .where(inArray(users.id, [...new Set(page.map((r) => r.userId))]))
        : [];
      const byId = new Map(people.map((p) => [p.id, { username: p.username!, displayName: p.displayName, avatar: p.avatar }]));
      const last = page.at(-1);
      return c.json(
        {
          items: page.map((r) => ({
            type: r.kind as "like" | "repost" | "daily",
            user: byId.get(r.userId)!,
            ...(r.key ? { key: r.key } : {}),
            ...(r.date ? { date: r.date } : {}),
            ...(r.tries ? { tries: r.tries } : {}),
            at: r.happenedAt.toISOString(),
          })),
          nextCursor: rows.length > FEED_PAGE && last ? `${last.happenedAt.toISOString()}|${last.tie}` : null,
        },
        200,
      );
    },
  );

  return app;
}
