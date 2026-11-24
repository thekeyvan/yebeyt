import { and, eq, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { blocks } from "./db/schema.js";

/** The two ids of a pair in the order the tables keep them (`user_low` < `user_high`). */
export const orderedPair = (a: string, b: string) => (a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a });

/** True when either of the two has blocked the other. */
export async function isBlocked(db: Db, a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ blocker: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}

/** A condition: nobody between `me` and the user in `other` has blocked the other. */
export const notBlockedWith = (me: string, other: SQLWrapper): SQL =>
  sql`not exists (select 1 from blocks bl where (bl.blocker_id = ${me} and bl.blocked_id = ${other}) or (bl.blocker_id = ${other} and bl.blocked_id = ${me}))`;
