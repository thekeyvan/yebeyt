import { z } from "@hono/zod-openapi";
import { and, eq, or, type SQLWrapper, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { friendRequests, friendships, users } from "./db/schema.js";
import { avatarSchema } from "./schemas.js";
import { orderedPair } from "./social.js";
import { normalizeUsername } from "./usernames.js";

export const PAGE = 50;

export const friendshipSchema = z
  .enum(["none", "requested", "incoming", "friends"])
  .openapi("Friendship", { description: "`requested`: I sent them a request and wait. `incoming`: they sent me one. `friends`: we are friends." });
export type Friendship = z.infer<typeof friendshipSchema>;

export const shortPersonSchema = z
  .object({ username: z.string(), displayName: z.string().nullable(), avatar: avatarSchema.nullable() })
  .openapi("PersonShort");

/** The ids of a user's friends, as a SQL subquery. */
export const friendIds = (userId: string) => sql`(
  select case when user_low = ${userId} then user_high else user_low end from friendships
  where user_low = ${userId} or user_high = ${userId}
)`;

/** True when the two are friends. */
export async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const { userLow, userHigh } = orderedPair(a, b);
  const rows = await db.select({ low: friendships.userLow }).from(friendships).where(and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh)));
  return rows.length > 0;
}

/** How `me` and `other` stand: friends, a request either way, or nothing. */
export async function friendshipOf(db: Db, me: string, other: string): Promise<Friendship> {
  if (await areFriends(db, me, other)) return "friends";
  const rows = await db
    .select({ from: friendRequests.fromId })
    .from(friendRequests)
    .where(or(and(eq(friendRequests.fromId, me), eq(friendRequests.toId, other)), and(eq(friendRequests.fromId, other), eq(friendRequests.toId, me))));
  if (rows.some((r) => r.from === me)) return "requested";
  return rows.length > 0 ? "incoming" : "none";
}

/** The same as `friendshipOf`, for a SQL query: `other` is a column of the query. */
export const friendshipSql = (me: string, other: SQLWrapper) => sql<Friendship>`case
  when exists (select 1 from friendships f where (f.user_low = ${me} and f.user_high = ${other}) or (f.user_low = ${other} and f.user_high = ${me})) then 'friends'
  when exists (select 1 from friend_requests r where r.from_id = ${me} and r.to_id = ${other}) then 'requested'
  when exists (select 1 from friend_requests r where r.from_id = ${other} and r.to_id = ${me}) then 'incoming'
  else 'none' end`;

/** The user with this username (any case), or undefined. */
export async function findByUsername(db: Db, raw: string) {
  const [row] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar })
    .from(users)
    .where(eq(users.username, normalizeUsername(raw)));
  return row;
}

/** A page cursor "<time>_<uuid>": the last row's time and id, so rows with the same time are never skipped. */
export const timeCursor = (at: Date, id: string): string => `${at.toISOString()}_${id}`;

export function parseTimeCursor(cursor: string): { at: Date; id: string } | null {
  const parts = cursor.split("_");
  if (parts.length !== 2) return null;
  const at = new Date(parts[0]!);
  // Re-printing the date must give the same text, which refuses dates that do not exist (30 February).
  if (Number.isNaN(at.getTime()) || at.toISOString() !== parts[0]) return null;
  return z.uuid().safeParse(parts[1]).success ? { at, id: parts[1]! } : null;
}

export const timeCursorSchema = z.string().max(100).refine((v) => parseTimeCursor(v) !== null);
