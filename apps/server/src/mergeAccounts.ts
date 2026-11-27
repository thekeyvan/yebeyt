import { eq, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import type { Db } from "./db/index.js";
import {
  blocks,
  challengeResults,
  challenges,
  conversationReads,
  conversations,
  dailyResults,
  feedback,
  friendRequests,
  friendships,
  gamePlayers,
  identities,
  leagueMembers,
  messages,
  privacySettings,
  progress,
  reactions,
  scoreEvents,
  sessions,
  sharedDivanItems,
  sharedDivanLikes,
  sharedDivans,
  userTiers,
  users,
} from "./db/schema.js";
import { mergeProgress } from "./routes/progress.js";

/**
 * Moving an account's sign-in methods into another account when the first one is "empty": it has no username and holds
 * nothing but what a person does before the username step (the guest carry-over: progress, divan; maybe privacy settings,
 * a name and a face). What is carried over:
 * - identities (all of them, with their sealed Apple tokens), so account deletion still revokes them at Apple;
 * - progress, merged with the larger value of each field (as `PUT /v1/me/progress`);
 * - divan items, the later time of each key wins (as `PUT /v1/me/divan`);
 * - feedback reports (a signed-in person's reports belong to their account, so they follow it);
 * - privacy settings, only when the other account has none (its own choice stands); display name and avatar likewise.
 * Sessions go with the empty account (its refresh tokens stop working: the person signs in again and lands on the real one).
 *
 * Anything else that points at a user (scores, games, friends, chats, challenges, reactions, leagues, …) makes the
 * account not empty: nothing is merged and both accounts stay. `test/email-linking.test.ts` checks that these lists
 * name every table with a foreign key to users, so a new table cannot be forgotten.
 */
export const MERGED_TABLES = ["identities", "sessions", "progress", "divan_items", "privacy_settings", "feedback"];

const blockers: [PgTable, PgColumn[]][] = [
  [friendships, [friendships.userLow, friendships.userHigh]],
  [friendRequests, [friendRequests.fromId, friendRequests.toId]],
  [scoreEvents, [scoreEvents.userId]],
  [dailyResults, [dailyResults.userId]],
  [leagueMembers, [leagueMembers.userId]],
  [userTiers, [userTiers.userId]],
  [reactions, [reactions.userId]],
  [blocks, [blocks.blockerId, blocks.blockedId]],
  [conversations, [conversations.userLow, conversations.userHigh]],
  [messages, [messages.senderId]],
  [conversationReads, [conversationReads.userId]],
  [sharedDivans, [sharedDivans.userLow, sharedDivans.userHigh]],
  [sharedDivanItems, [sharedDivanItems.addedBy]],
  [sharedDivanLikes, [sharedDivanLikes.userId]],
  [gamePlayers, [gamePlayers.userId]],
  [challenges, [challenges.creatorId]],
  [challengeResults, [challengeResults.userId]],
];
export const BLOCKING_TABLES = blockers.map(([table]) => getTableName(table));

/** Rows that point at the user with "on delete set null" and cannot exist for an account with no username (reports, games, mosh moves need a username or a game player row first). */
export const IGNORED_TABLES = ["reports", "games", "mosh_moves"];

async function hasRows(tx: Db, userId: string): Promise<boolean> {
  for (const [table, columns] of blockers) {
    const [row] = await tx
      .select({ one: sql<number>`1` })
      .from(table)
      .where(or(...columns.map((c) => eq(c, userId))) as SQL)
      .limit(1);
    if (row) return true;
  }
  return false;
}

/**
 * Moves everything of `fromId` into `toId` and deletes `fromId`, when `fromId` is still empty and `toId` has a username.
 * Runs in one transaction. Returns the user the identity belongs to afterwards (`toId` when merged, else where it is).
 * The empty user is locked first, so two sign-ins of its identities take turns: the second finds it gone.
 */
export async function mergeEmptyAccount(db: Db, identityId: string, fromId: string, toId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [from] = await tx.select({ username: users.username, displayName: users.displayName, avatar: users.avatar }).from(users).where(eq(users.id, fromId)).for("update");
    if (!from) {
      const [moved] = await tx.select({ userId: identities.userId }).from(identities).where(eq(identities.id, identityId));
      return moved?.userId ?? fromId;
    }
    const [current] = await tx.select({ userId: identities.userId }).from(identities).where(eq(identities.id, identityId));
    if (current && current.userId !== fromId) return current.userId;
    // A share lock: a deletion of the target waits for this merge, and merges into one target do not wait for each other.
    const [to] = await tx.select({ username: users.username, displayName: users.displayName, avatar: users.avatar }).from(users).where(eq(users.id, toId)).for("share");
    if (from.username !== null || !to?.username || (await hasRows(tx, fromId))) return fromId;
    // One account never gets two sign-in methods of the same provider (a recycled address is not the same person).
    const providers = async (id: string) => (await tx.select({ p: identities.provider }).from(identities).where(eq(identities.userId, id))).map((r) => r.p);
    const theirs = new Set(await providers(toId));
    if ((await providers(fromId)).some((p) => theirs.has(p))) return fromId;

    const [fromProgress] = await tx.select().from(progress).where(eq(progress.userId, fromId));
    if (fromProgress) {
      await tx.insert(progress).values({ userId: toId }).onConflictDoNothing();
      const [row] = await tx.select().from(progress).where(eq(progress.userId, toId)).for("update");
      const next = mergeProgress(
        { points: row!.points, streakDays: row!.streakDays, streakLastDate: row!.streakLastDate, bestByGame: row!.bestByGame },
        { points: fromProgress.points, streakDays: fromProgress.streakDays, streakLastDate: fromProgress.streakLastDate, bestByGame: fromProgress.bestByGame },
      );
      await tx.update(progress).set({ ...next, updatedAt: sql`now()` }).where(eq(progress.userId, toId));
    }
    await tx.execute(sql`
      insert into divan_items (user_id, key, kept_at, removed_at)
      select ${toId}, key, kept_at, removed_at from divan_items where user_id = ${fromId}
      on conflict (user_id, key) do update set
        kept_at = greatest(divan_items.kept_at, excluded.kept_at),
        removed_at = greatest(divan_items.removed_at, excluded.removed_at)`);
    const [theirPrivacy] = await tx.select({ id: privacySettings.userId }).from(privacySettings).where(eq(privacySettings.userId, toId));
    if (!theirPrivacy) await tx.update(privacySettings).set({ userId: toId }).where(eq(privacySettings.userId, fromId));
    await tx
      .update(users)
      .set({ displayName: to.displayName ?? from.displayName, avatar: to.avatar ?? from.avatar })
      .where(eq(users.id, toId));

    await tx.update(feedback).set({ userId: toId }).where(eq(feedback.userId, fromId));
    await tx.update(identities).set({ userId: toId }).where(eq(identities.userId, fromId));
    await tx.delete(sessions).where(eq(sessions.userId, fromId)); // revoked: its refresh tokens are gone, its access tokens fail because the user is
    await tx.delete(users).where(eq(users.id, fromId)); // the rest of its rows (progress, divan, privacy) cascade
    return toId;
  });
}
