import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { messages, sharedDivanItems, sharedDivanLikes, sharedDivans, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { getOrCreateConversation, NOTE_MAX, publishMessage } from "../messaging.js";
import { areFriends, findByUsername, PAGE, parseTimeCursor, shortPersonSchema, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { coupletKeySchema, usernameSchema } from "../schemas.js";
import { isBlocked, notBlockedWith, orderedPair } from "../social.js";

const security = [{ bearerAuth: [] }];
const idParam = z.object({ id: z.uuid() });
const itemParams = z.object({ id: z.uuid(), itemId: z.uuid() });
const cursorSchema = z.object({ cursor: timeCursorSchema.optional() });
const nextCursor = z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." });

const countsSchema = z
  .object({ total: z.number().int(), mine: z.number().int().openapi({ description: "Added by me." }), theirs: z.number().int().openapi({ description: "Added by them." }) })
  .openapi("SharedDivanCounts");
const divanSchema = z.object({ id: z.uuid(), other: shortPersonSchema, counts: countsSchema }).openapi("SharedDivan");
const divanPage = z.object({ items: z.array(divanSchema), nextCursor }).openapi("SharedDivanPage");
const itemSchema = z
  .object({
    id: z.uuid(),
    key: coupletKeySchema,
    note: z.string().nullable(),
    addedByMe: z.boolean(),
    createdAt: z.iso.datetime(),
    likedByMe: z.boolean(),
    likedByThem: z.boolean(),
  })
  .openapi("SharedDivanItem");
const itemPage = z.object({ items: z.array(itemSchema), nextCursor, counts: countsSchema }).openapi("SharedDivanItemPage");

type Item = typeof sharedDivanItems.$inferSelect;
const itemView = (row: Item, viewer: string, likes = { mine: false, theirs: false }): z.infer<typeof itemSchema> => ({
  id: row.id,
  key: row.key,
  note: row.note,
  addedByMe: row.addedBy === viewer,
  createdAt: row.createdAt.toISOString(),
  likedByMe: likes.mine,
  likedByThem: likes.theirs,
});

export function sharedDivanRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(60, 60_000, deps.now);

  /** The divan if I am one of its two people and nobody blocked the other; otherwise it does not exist. */
  const member = async (id: string, me: string) => {
    const [row] = await db
      .select()
      .from(sharedDivans)
      .where(and(eq(sharedDivans.id, id), or(eq(sharedDivans.userLow, me), eq(sharedDivans.userHigh, me))));
    const otherId = row && (row.userLow === me ? row.userHigh : row.userLow);
    if (!row || !otherId || (await isBlocked(db, me, otherId))) throw new ApiError(404, "not_found");
    return { id: row.id, otherId };
  };

  const countsOf = async (divanIds: string[], me: string) => {
    const rows = divanIds.length
      ? await db
          .select({ id: sharedDivanItems.divanId, total: sql<number>`count(*)::int`, mine: sql<number>`(count(*) filter (where ${sharedDivanItems.addedBy} = ${me}))::int` })
          .from(sharedDivanItems)
          .where(inArray(sharedDivanItems.divanId, divanIds))
          .groupBy(sharedDivanItems.divanId)
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return (id: string) => {
      const r = byId.get(id);
      return { total: r?.total ?? 0, mine: r?.mine ?? 0, theirs: (r?.total ?? 0) - (r?.mine ?? 0) };
    };
  };

  const likesOf = async (itemId: string, me: string) => {
    const rows = await db.select({ userId: sharedDivanLikes.userId }).from(sharedDivanLikes).where(eq(sharedDivanLikes.itemId, itemId));
    return { mine: rows.some((r) => r.userId === me), theirs: rows.some((r) => r.userId !== me) };
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/shared-divans",
      tags: ["shared divan"],
      summary: "Open the divan I share with a friend (made if it does not exist)",
      description: "Only between friends (403 forbidden otherwise). If either of us blocked the other, the person is not found (404).",
      security,
      request: { body: { required: true, content: { "application/json": { schema: z.object({ username: usernameSchema }).openapi("OpenSharedDivanRequest") } } } },
      responses: {
        200: { description: "The divan.", content: { "application/json": { schema: divanSchema } } },
        400: errorResponse("invalid_request: that is yourself."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required, or forbidden: we are not friends."),
        404: errorResponse("No user with that username, or one of us blocked the other."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await findByUsername(db, c.req.valid("json").username);
      if (!other || (await isBlocked(db, me, other.id))) throw new ApiError(404, "not_found");
      if (other.id === me) throw new ApiError(400, "invalid_request");
      if (!(await areFriends(db, me, other.id))) throw new ApiError(403, "forbidden");
      const pair = orderedPair(me, other.id);
      await db.insert(sharedDivans).values({ ...pair, createdAt: deps.now() }).onConflictDoNothing();
      const [divan] = await db.select({ id: sharedDivans.id }).from(sharedDivans).where(and(eq(sharedDivans.userLow, pair.userLow), eq(sharedDivans.userHigh, pair.userHigh)));
      const counts = (await countsOf([divan!.id], me))(divan!.id);
      return c.json({ id: divan!.id, other: { username: other.username!, displayName: other.displayName, avatar: other.avatar }, counts }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/shared-divans",
      tags: ["shared divan"],
      summary: "My shared divans with their counts, newest first, 50 a page",
      description: "Not including divans with someone blocked either way.",
      security,
      request: { query: cursorSchema },
      responses: {
        200: { description: "A page of divans.", content: { "application/json": { schema: divanPage } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { cursor } = c.req.valid("query");
      const after = cursor ? parseTimeCursor(cursor)! : null;
      const otherId = sql`case when ${sharedDivans.userLow} = ${me} then ${sharedDivans.userHigh} else ${sharedDivans.userLow} end`;
      const rows = await db
        .select({ id: sharedDivans.id, createdAt: sharedDivans.createdAt, username: users.username, displayName: users.displayName, avatar: users.avatar })
        .from(sharedDivans)
        .innerJoin(users, sql`${users.id} = ${otherId}`)
        .where(
          and(
            or(eq(sharedDivans.userLow, me), eq(sharedDivans.userHigh, me)),
            notBlockedWith(me, users.id),
            after ? or(lt(sharedDivans.createdAt, after.at), and(eq(sharedDivans.createdAt, after.at), lt(sharedDivans.id, after.id))) : undefined,
          ),
        )
        .orderBy(desc(sharedDivans.createdAt), desc(sharedDivans.id))
        .limit(PAGE + 1);
      const page = rows.slice(0, PAGE);
      const counts = await countsOf(page.map((r) => r.id), me);
      const last = page.at(-1);
      return c.json(
        {
          items: page.map((r) => ({ id: r.id, other: { username: r.username!, displayName: r.displayName, avatar: r.avatar }, counts: counts(r.id) })),
          nextCursor: rows.length > PAGE && last ? timeCursor(last.createdAt, last.id) : null,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/shared-divans/{id}/items",
      tags: ["shared divan"],
      summary: "The couplets of a shared divan, newest first, 50 a page",
      description: "`by` keeps the ones added by me (`me`), by them (`them`) or all (default). `counts` always count the whole divan. Stays readable if we stop being friends.",
      security,
      request: { params: idParam, query: cursorSchema.extend({ by: z.enum(["me", "them", "all"]).default("all") }) },
      responses: {
        200: { description: "A page of couplets.", content: { "application/json": { schema: itemPage } } },
        400: errorResponse("A malformed id, cursor or `by`."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
        404: errorResponse("No such divan, or I am not in it, or one of us blocked the other."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const divan = await member(c.req.valid("param").id, me);
      const { cursor, by } = c.req.valid("query");
      const after = cursor ? parseTimeCursor(cursor)! : null;
      const rows = await db
        .select({
          item: sharedDivanItems,
          likedByMe: sql<boolean>`exists (select 1 from shared_divan_likes l where l.item_id = ${sharedDivanItems.id} and l.user_id = ${me})`,
          likedByThem: sql<boolean>`exists (select 1 from shared_divan_likes l where l.item_id = ${sharedDivanItems.id} and l.user_id <> ${me})`,
        })
        .from(sharedDivanItems)
        .where(
          and(
            eq(sharedDivanItems.divanId, divan.id),
            by === "me" ? eq(sharedDivanItems.addedBy, me) : by === "them" ? eq(sharedDivanItems.addedBy, divan.otherId) : undefined,
            after ? or(lt(sharedDivanItems.createdAt, after.at), and(eq(sharedDivanItems.createdAt, after.at), lt(sharedDivanItems.id, after.id))) : undefined,
          ),
        )
        .orderBy(desc(sharedDivanItems.createdAt), desc(sharedDivanItems.id))
        .limit(PAGE + 1);
      const page = rows.slice(0, PAGE);
      const last = page.at(-1);
      return c.json(
        {
          items: page.map((r) => itemView(r.item, me, { mine: r.likedByMe, theirs: r.likedByThem })),
          nextCursor: rows.length > PAGE && last ? timeCursor(last.item.createdAt, last.item.id) : null,
          counts: (await countsOf([divan.id], me))(divan.id),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/shared-divans/{id}/items",
      tags: ["shared divan"],
      summary: "Add a couplet",
      description:
        "Only while we are friends. Puts a system line `{ event: \"divan_add\", key }` in our chat (made if there is none; it ignores «بهم پیام بده» because we are friends), " +
        "and both of us get live `message` and `divan` events. Adding a couplet that is already there answers 200 with the item that is there, and adds nothing. 60 a minute per user.",
      security,
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: z.object({ key: coupletKeySchema, note: z.string().trim().min(1).max(NOTE_MAX).optional() }).openapi("AddSharedDivanItemRequest") } } } },
      responses: {
        200: { description: "Already in the divan.", content: { "application/json": { schema: itemSchema } } },
        201: { description: "Added.", content: { "application/json": { schema: itemSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required, or forbidden: we are not friends any more."),
        404: errorResponse("No such divan, or I am not in it, or one of us blocked the other."),
        429: errorResponse("Too many requests (60 a minute per user)."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      if (!limiter.take(me)) throw new ApiError(429, "rate_limited");
      const divan = await member(c.req.valid("param").id, me);
      if (!(await areFriends(db, me, divan.otherId))) throw new ApiError(403, "forbidden");
      const { key, note } = c.req.valid("json");
      const [row] = await db
        .insert(sharedDivanItems)
        .values({ divanId: divan.id, key, addedBy: me, note: note ?? null, createdAt: deps.now() })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        const [existing] = await db.select().from(sharedDivanItems).where(and(eq(sharedDivanItems.divanId, divan.id), eq(sharedDivanItems.key, key)));
        return c.json(itemView(existing!, me, await likesOf(existing!.id, me)), 200);
      }
      const conversationId = await getOrCreateConversation(db, me, divan.otherId);
      const [line] = await db
        .insert(messages)
        .values({ conversationId, senderId: null, kind: "system", payload: { event: "divan_add", key, by: me }, createdAt: deps.now() })
        .returning();
      publishMessage(deps, [me, divan.otherId], line!);
      for (const viewer of [me, divan.otherId]) deps.hub.publish(viewer, { type: "divan", sharedDivanId: divan.id, item: itemView(row, viewer) });
      return c.json(itemView(row, me), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/shared-divans/{id}/items/{itemId}",
      tags: ["shared divan"],
      summary: "Remove a couplet I added",
      description: "Only the person who added it. Its likes go with it.",
      security,
      request: { params: itemParams },
      responses: {
        204: { description: "Removed." },
        400: errorResponse("A malformed id."),
        401: errorResponse("Not signed in."),
        403: errorResponse("forbidden: they added it; or username_required."),
        404: errorResponse("No such divan or couplet, or I am not in it."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { id, itemId } = c.req.valid("param");
      const divan = await member(id, me);
      const [row] = await db.select().from(sharedDivanItems).where(and(eq(sharedDivanItems.id, itemId), eq(sharedDivanItems.divanId, divan.id)));
      if (!row) throw new ApiError(404, "not_found");
      if (row.addedBy !== me) throw new ApiError(403, "forbidden");
      await db.delete(sharedDivanItems).where(eq(sharedDivanItems.id, itemId));
      return c.body(null, 204);
    },
  );

  const likeResponses = {
    200: { description: "The couplet with the likes now.", content: { "application/json": { schema: itemSchema } } },
    400: errorResponse("A malformed id."),
    401: errorResponse("Not signed in."),
    403: errorResponse("username_required: set a username first."),
    404: errorResponse("No such divan or couplet, or I am not in it."),
  };
  for (const method of ["put", "delete"] as const) {
    app.openapi(
      createRoute({
        method,
        path: "/v1/shared-divans/{id}/items/{itemId}/like",
        tags: ["shared divan"],
        summary: method === "put" ? "Like a couplet of the shared divan" : "Take back my like",
        description: "Idempotent. Either of the two people may like any couplet in it.",
        security,
        request: { params: itemParams },
        responses: likeResponses,
      }),
      async (c) => {
        const me = c.get("userId");
        const { id, itemId } = c.req.valid("param");
        const divan = await member(id, me);
        const [row] = await db.select().from(sharedDivanItems).where(and(eq(sharedDivanItems.id, itemId), eq(sharedDivanItems.divanId, divan.id)));
        if (!row) throw new ApiError(404, "not_found");
        if (method === "put") await db.insert(sharedDivanLikes).values({ itemId, userId: me }).onConflictDoNothing();
        else await db.delete(sharedDivanLikes).where(and(eq(sharedDivanLikes.itemId, itemId), eq(sharedDivanLikes.userId, me)));
        return c.json(itemView(row, me, await likesOf(itemId, me)), 200);
      },
    );
  }

  return app;
}
