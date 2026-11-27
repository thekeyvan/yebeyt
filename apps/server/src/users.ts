import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { isUniqueViolation } from "./db/index.js";
import { identities, users } from "./db/schema.js";
import { mergeEmptyAccount } from "./mergeAccounts.js";
import type { UserView } from "./schemas.js";

export type Provider = "apple" | "google";

export async function getUserView(db: Db, id: string): Promise<UserView | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;
  const rows = await db.select({ provider: identities.provider, email: identities.email }).from(identities).where(eq(identities.userId, id)).orderBy(desc(identities.createdAt));
  return {
    email: rows.find((r) => r.email !== null)?.email ?? null, // the newest sign-in method that has one
    newsOptIn: user.newsOptInAt !== null,
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    usernameChangedAt: user.usernameChangedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    providers: rows.map((p) => p.provider).sort(),
  };
}

async function findIdentity(db: Db, provider: Provider, subject: string) {
  const [row] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.provider, provider), eq(identities.subject, subject)));
  return row;
}

/**
 * The user an identity with this email should join: another user's identity has the same one. When several users
 * match (accounts made before linking existed, or two first sign-ins at the same moment), the one with a username wins, then the oldest.
 * `named` keeps only users with a username; `except` leaves one user out. Locks the user it returns (FOR SHARE), so a
 * deletion of that account waits; returns null when it was deleted in the meantime.
 */
async function findMatch(tx: Db, email: string, opts: { named?: boolean; except?: string } = {}): Promise<string | null> {
  const [match] = await tx
    .select({ id: users.id })
    .from(identities)
    .innerJoin(users, eq(users.id, identities.userId))
    .where(
      and(
        eq(identities.email, email),
        opts.named ? isNotNull(users.username) : undefined,
        opts.except ? ne(users.id, opts.except) : undefined,
      ),
    )
    .orderBy(sql`${users.username} is null`, asc(users.createdAt), asc(users.id))
    .limit(1);
  if (!match) return null;
  const [locked] = await tx.select({ id: users.id }).from(users).where(eq(users.id, match.id)).for("share");
  return locked?.id ?? null;
}

/**
 * Finds or creates the user for a provider's account id (`sub`), one account per verified email. We store the id and the
 * verified email (`email`, lower-cased; null when the provider gave none), no name. `appleRefreshToken` (sealed) replaces
 * the stored one when given.
 * - A known identity gets its email updated (never erased by a sign-in without one). When its user has no username
 *   and another user with a username has an identity with the same email, the identity moves there and the empty
 *   user goes (`mergeEmptyAccount`; an account with data beyond the guest carry-over is left alone).
 * - An unknown identity whose email matches a user's identity is added to that user; otherwise it makes a new user.
 * - Two users that both have a username are never merged here.
 * Concurrent first sign-ins of one identity end up on the same user (the unique violation is read back).
 */
export async function upsertUser(
  db: Db,
  provider: Provider,
  subject: string,
  email: string | null,
  appleRefreshToken?: string | null,
): Promise<string> {
  let identity = await findIdentity(db, provider, subject);
  if (!identity) {
    try {
      identity = await db.transaction(async (tx) => {
        const userId = (email ? await findMatch(tx, email) : null) ?? (await tx.insert(users).values({}).returning({ id: users.id }))[0]!.id;
        const [created] = await tx
          .insert(identities)
          .values({ userId, provider, subject, appleRefreshToken: appleRefreshToken ?? null, email })
          .returning();
        return created!;
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      identity = await findIdentity(db, provider, subject);
    }
  }
  if (!identity) throw new Error("identity vanished");
  const changes: Partial<typeof identities.$inferInsert> = {};
  if (appleRefreshToken && identity.appleRefreshToken !== appleRefreshToken) changes.appleRefreshToken = appleRefreshToken;
  if (email && identity.email !== email) changes.email = email;
  if (Object.keys(changes).length > 0) await db.update(identities).set(changes).where(eq(identities.id, identity.id));

  let userId = identity.userId;
  if (email) {
    const [mine] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
    if (mine && mine.username === null) {
      const target = await findMatch(db, email, { named: true, except: userId });
      if (target) userId = await mergeEmptyAccount(db, identity.id, userId, target);
    }
  }
  return userId;
}
