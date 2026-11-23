import { z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { follows, users } from "./db/schema.js";
import { avatarSchema } from "./schemas.js";
import { normalizeUsername } from "./usernames.js";

export const PAGE = 50;

export const personSchema = z
  .object({
    username: z.string(),
    displayName: z.string().nullable(),
    avatar: avatarSchema.nullable(),
    isFriend: z.boolean().openapi({ description: "You follow each other." }),
  })
  .openapi("Person");

export const relationSchema = z
  .object({ isFollowing: z.boolean(), followsYou: z.boolean(), isFriend: z.boolean() })
  .openapi("Relationship");

export const shortPersonSchema = z
  .object({ username: z.string(), displayName: z.string().nullable(), avatar: avatarSchema.nullable() })
  .openapi("PersonShort");

/** The ids of a user's friends (people who follow each other), as a SQL subquery. */
export const friendIdsOf = (userId: string) => sql`(
  select a.followee_id from follows a
  join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
  where a.follower_id = ${userId}
)`;

/** The user with this username (any case), or undefined. */
export async function findByUsername(db: Db, raw: string) {
  const [row] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar })
    .from(users)
    .where(eq(users.username, normalizeUsername(raw)));
  return row;
}

/** How `me` and `other` follow each other. */
export async function relationOf(db: Db, me: string, other: string) {
  const rows = await db
    .select({ follower: follows.followerId })
    .from(follows)
    .where(sql`(${follows.followerId} = ${me} and ${follows.followeeId} = ${other}) or (${follows.followerId} = ${other} and ${follows.followeeId} = ${me})`);
  const isFollowing = rows.some((r) => r.follower === me);
  const followsYou = rows.some((r) => r.follower === other);
  return { isFollowing, followsYou, isFriend: isFollowing && followsYou };
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
