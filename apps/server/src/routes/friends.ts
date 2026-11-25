import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, lt, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { friendRequests, friendships, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { areFriends, canPlaySchema, findByUsername, friendshipSchema, PAGE, parseTimeCursor, shortPersonSchema, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { usernameSchema } from "../schemas.js";
import { lockPair, orderedPair } from "../social.js";

const security = [{ bearerAuth: [] }];
const cursorDescription = "Pass as `cursor` for the next page; null on the last page.";
const stateSchema = z.object({ friendship: friendshipSchema }).openapi("FriendshipState");
const friendsPageSchema = z.object({ items: z.array(shortPersonSchema.extend({ canPlay: canPlaySchema })), nextCursor: z.string().nullable().openapi({ description: cursorDescription }) }).openapi("FriendsPage");
const requestsPageSchema = z
  .object({
    items: z.array(shortPersonSchema.extend({ createdAt: z.iso.datetime().openapi({ description: "When the request was sent." }) })),
    nextCursor: z.string().nullable().openapi({ description: cursorDescription }),
  })
  .openapi("FriendRequestsPage");

export const REQUESTS_PER_HOUR = 30;

export function friendRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(120, 60_000, deps.now);
  const newRequests = createRateLimiter(REQUESTS_PER_HOUR, 3_600_000, deps.now);

  const target = async (userId: string, username: string) => {
    if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
    const other = await findByUsername(db, username);
    if (!other) throw new ApiError(404, "not_found");
    if (other.id === userId) throw new ApiError(400, "invalid_request");
    return other;
  };
  const person = async (userId: string) => {
    const [row] = await db.select({ username: users.username, displayName: users.displayName, avatar: users.avatar }).from(users).where(eq(users.id, userId));
    return { username: row!.username!, displayName: row!.displayName, avatar: row!.avatar };
  };
  /** Takes the request away in both directions and makes the friendship. */
  const makeFriends = async (tx: Db, a: string, b: string) => {
    await tx.delete(friendRequests).where(or(and(eq(friendRequests.fromId, a), eq(friendRequests.toId, b)), and(eq(friendRequests.fromId, b), eq(friendRequests.toId, a))));
    await tx.insert(friendships).values({ ...orderedPair(a, b), createdAt: deps.now() }).onConflictDoNothing();
  };
  const requestFrom = async (tx: Db, from: string, to: string) =>
    (await tx.select({ at: friendRequests.createdAt }).from(friendRequests).where(and(eq(friendRequests.fromId, from), eq(friendRequests.toId, to)))).length > 0;

  const params = z.object({ username: usernameSchema });
  const common = {
    401: errorResponse("Not signed in."),
    403: errorResponse("username_required: set a username first."),
    404: errorResponse("No user with that username."),
    429: errorResponse("Too many requests (120 a minute per user)."),
  };
  const yourself = errorResponse("invalid_request: that is yourself.");

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/friend-requests/{username}",
      tags: ["friends"],
      summary: "Ask someone to be friends",
      description:
        "Idempotent: asking again changes nothing. If they already asked me, this accepts and we are friends; if we are friends, nothing happens. " +
        "The built-in demo friend «یه بیت» (username `yebeyt`) accepts at once: I get a live `friend.accepted` from it, and the answer is `friends`. " +
        "The receiver gets a live `friend.request` (and the sender of a request I accept, `friend.accepted`). If either of us blocked the other, the person is not found (404). " +
        `A user may send ${REQUESTS_PER_HOUR} new requests an hour (429 rate_limited); repeats and acceptances do not count.`,
      security,
      request: { params },
      responses: {
        200: { description: "Where we stand now: `requested`, or `friends` when it was accepted or we already were.", content: { "application/json": { schema: stateSchema } } },
        400: yourself,
        ...common,
        429: errorResponse("rate_limited: 120 calls a minute, or 30 new requests an hour, per user."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await target(me, c.req.valid("param").username);
      const outcome = await db.transaction(async (tx) => {
        if ((await lockPair(tx, me, other.id)).blocked) throw new ApiError(404, "not_found");
        if (await areFriends(tx, me, other.id)) return "friends" as const;
        if (await requestFrom(tx, other.id, me)) {
          await makeFriends(tx, me, other.id);
          return "accepted" as const;
        }
        if (other.isHouse) {
          await makeFriends(tx, me, other.id); // «یه بیت» accepts at once, the same way an accept does
          return "accepted_by_house" as const;
        }
        if (await requestFrom(tx, me, other.id)) return "requested" as const;
        if (!newRequests.fits(me, 1)) throw new ApiError(429, "rate_limited");
        await tx.insert(friendRequests).values({ fromId: me, toId: other.id, createdAt: deps.now() });
        newRequests.spend(me, 1);
        return "sent" as const;
      });
      if (outcome === "sent") deps.hub.publish(other.id, { type: "friend.request", from: await person(me) });
      if (outcome === "accepted") deps.hub.publish(other.id, { type: "friend.accepted", from: await person(me) });
      if (outcome === "accepted_by_house") deps.hub.publish(me, { type: "friend.accepted", from: await person(other.id) });
      return c.json({ friendship: outcome === "sent" || outcome === "requested" ? ("requested" as const) : ("friends" as const) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/friend-requests/{username}",
      tags: ["friends"],
      summary: "Cancel the request I sent",
      description: "Idempotent, silent. Does nothing to a request they sent me or to a friendship.",
      security,
      request: { params },
      responses: { 204: { description: "Done." }, 400: yourself, ...common },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await target(me, c.req.valid("param").username);
      await db.delete(friendRequests).where(and(eq(friendRequests.fromId, me), eq(friendRequests.toId, other.id)));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/friend-requests/{username}/accept",
      tags: ["friends"],
      summary: "Accept the request they sent me",
      description: "We are friends now, and they get a live `friend.accepted`. Idempotent: 200 when we are already friends. 404 when they sent no request (or one of us blocked the other).",
      security,
      request: { params },
      responses: {
        200: { description: "`friends`.", content: { "application/json": { schema: stateSchema } } },
        400: yourself,
        ...common,
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await target(me, c.req.valid("param").username);
      const accepted = await db.transaction(async (tx) => {
        if ((await lockPair(tx, me, other.id)).blocked) throw new ApiError(404, "not_found");
        if (await areFriends(tx, me, other.id)) return false;
        if (!(await requestFrom(tx, other.id, me))) throw new ApiError(404, "not_found");
        await makeFriends(tx, me, other.id);
        return true;
      });
      if (accepted) deps.hub.publish(other.id, { type: "friend.accepted", from: await person(me) });
      return c.json({ friendship: "friends" as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/friend-requests/{username}/reject",
      tags: ["friends"],
      summary: "Reject the request they sent me",
      description: "Silent: the request just goes away, the sender is not told and may send a new one at once. Idempotent.",
      security,
      request: { params },
      responses: { 204: { description: "Done." }, 400: yourself, ...common },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await target(me, c.req.valid("param").username);
      await db.delete(friendRequests).where(and(eq(friendRequests.fromId, other.id), eq(friendRequests.toId, me)));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/friends/{username}",
      tags: ["friends"],
      summary: "Stop being friends",
      description: "Idempotent and silent: they are not told, and either of us may send a new request.",
      security,
      request: { params },
      responses: { 204: { description: "Done." }, 400: yourself, ...common },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await target(me, c.req.valid("param").username);
      const { userLow, userHigh } = orderedPair(me, other.id);
      await db.delete(friendships).where(and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh)));
      return c.body(null, 204);
    },
  );

  /** A page of people tied to me by rows of one table, newest first: `other` is the person's id in the row, `mine` says the row is mine. */
  async function page(table: typeof friendships | typeof friendRequests, other: SQL<string>, mine: SQL | undefined, cursor: string | undefined) {
    const createdAt = table.createdAt;
    const after = cursor ? parseTimeCursor(cursor)! : null;
    const rows = await db
      .select({ id: other, createdAt: sql<Date>`${createdAt}`.mapWith(createdAt), username: users.username, displayName: users.displayName, avatar: users.avatar, isHouse: users.isHouse })
      .from(table)
      .innerJoin(users, sql`${users.id} = ${other}`)
      .where(and(mine, after ? or(lt(createdAt, after.at), and(eq(createdAt, after.at), sql`${other} < ${after.id}::uuid`)) : undefined))
      .orderBy(desc(createdAt), desc(other))
      .limit(PAGE + 1);
    const items = rows.slice(0, PAGE);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > PAGE && last ? timeCursor(last.createdAt, last.id) : null };
  }
  const query = z.object({ cursor: timeCursorSchema.optional() });

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/friends",
      tags: ["friends"],
      summary: "My friends, 50 a page",
      description: "Ordered by when we became friends, newest first.",
      security,
      request: { query },
      responses: {
        200: { description: "A page of friends.", content: { "application/json": { schema: friendsPageSchema } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = sql<string>`case when ${friendships.userLow} = ${me} then ${friendships.userHigh} else ${friendships.userLow} end`;
      const { items, nextCursor } = await page(friendships, other, or(eq(friendships.userLow, me), eq(friendships.userHigh, me)), c.req.valid("query").cursor);
      return c.json({ items: items.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar, canPlay: !r.isHouse })), nextCursor }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/friend-requests",
      tags: ["friends"],
      summary: "Friend requests I received or sent, newest first, 50 a page",
      description: "`direction=incoming` are the people who asked me (answer with accept or reject); `outgoing` are the people I asked (cancel with DELETE).",
      security,
      request: { query: query.extend({ direction: z.enum(["incoming", "outgoing"]) }) },
      responses: {
        200: { description: "A page of requests.", content: { "application/json": { schema: requestsPageSchema } } },
        400: errorResponse("A malformed cursor, or no `direction`."),
        401: common[401],
        403: common[403],
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { direction, cursor } = c.req.valid("query");
      const [other, mine] = direction === "incoming" ? [friendRequests.fromId, friendRequests.toId] : [friendRequests.toId, friendRequests.fromId];
      const { items, nextCursor } = await page(friendRequests, sql<string>`${other}`, eq(mine, me), cursor);
      return c.json({ items: items.map((r) => ({ username: r.username!, displayName: r.displayName, avatar: r.avatar, createdAt: r.createdAt.toISOString() })), nextCursor }, 200);
    },
  );

  return app;
}
