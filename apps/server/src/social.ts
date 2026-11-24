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

/**
 * Takes the lock of a pair for this transaction, so requests, acceptances and blocks between the two run one at a time,
 * and says whether either has blocked the other (read after the lock, so a block that just happened is seen).
 */
export async function lockPair(tx: Db, a: string, b: string): Promise<{ blocked: boolean }> {
  const { userLow, userHigh } = orderedPair(a, b);
  await tx.execute(sql`select pg_advisory_xact_lock(3, hashtext(${`${userLow}:${userHigh}`}))`);
  return { blocked: await isBlocked(tx, a, b) };
}

/** A condition: nobody between `me` and the user in `other` has blocked the other. */
export const notBlockedWith = (me: string, other: SQLWrapper): SQL =>
  sql`not exists (select 1 from blocks bl where (bl.blocker_id = ${me} and bl.blocked_id = ${other}) or (bl.blocker_id = ${other} and bl.blocked_id = ${me}))`;
