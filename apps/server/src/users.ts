import { and, asc, desc, eq, isNotNull, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
 * The user an identity with this email should join: another user has a linkable identity with the same one (a Google
 * address that is not @gmail.com or a Workspace one never counts, see `emailLinkable`). A user that already has an identity
 * from the same `provider` is skipped: a second Google account with that address (a recycled one) is not the same person.
 * When several users match (accounts made before linking existed), the one with a username wins, then the oldest.
 * `named` keeps only users with a username; `except` leaves one user out. A plain read: callers that act on the answer
 * lock the user inside their own transaction (`lockUser`, and `mergeEmptyAccount`).
 */
async function findMatch(db: Db, email: string, provider: Provider, opts: { named?: boolean; except?: string } = {}): Promise<string | null> {
  const same = alias(identities, "same_provider");
  const [match] = await db
    .select({ id: users.id })
    .from(identities)
    .innerJoin(users, eq(users.id, identities.userId))
    .where(
      and(
        eq(identities.email, email),
        eq(identities.emailLinkable, true),
        notExists(db.select({ one: sql`1` }).from(same).where(and(eq(same.userId, users.id), eq(same.provider, provider)))),
        opts.named ? isNotNull(users.username) : undefined,
        opts.except ? ne(users.id, opts.except) : undefined,
      ),
    )
    .orderBy(sql`${users.username} is null`, asc(users.createdAt), asc(users.id))
    .limit(1);
  return match?.id ?? null;
}

/** Locks a user row until the transaction ends (FOR SHARE), so deleting that account waits; false when it is already gone. */
async function lockUser(tx: Db, id: string): Promise<boolean> {
  const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for("share");
  return row !== undefined;
}

/** The provider's verified email: `linkable` says whether it may join accounts (`VerifiedIdentity.emailLinkable`). */
export type SignInEmail = { address: string; linkable: boolean };

/**
 * Finds or creates the user for a provider's account id (`sub`), one account per verified email. We store the id and the
 * verified email (`email`, lower-cased; none when the provider gave no verified one), no name. `appleRefreshToken`
 * (sealed) replaces the stored one when given.
 * - A known identity gets its email updated (never erased by a sign-in without one). When its user has no username
 *   and another user with a username has a linkable identity with the same email (and none from this provider), the
 *   identity moves there and the empty user goes (`mergeEmptyAccount`; an account with data beyond the guest carry-over
 *   is left alone).
 * - An unknown identity whose linkable email matches a user's identity is added to that user; otherwise it makes a new user.
 *   Two first sign-ins with one email take turns (an advisory lock on the email), so they make one account.
 * - Two users that both have a username are never merged here.
 * Concurrent first sign-ins of one identity end up on the same user (the unique violation is read back).
 */
export async function upsertUser(
  db: Db,
  provider: Provider,
  subject: string,
  email: SignInEmail | null,
  appleRefreshToken?: string | null,
): Promise<string> {
  let identity = await findIdentity(db, provider, subject);
  if (!identity) {
    try {
      identity = await db.transaction(async (tx) => {
        let userId: string | null = null;
        if (email?.linkable) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email.address}))`);
          const match = await findMatch(tx, email.address, provider);
          if (match && (await lockUser(tx, match))) userId = match;
        }
        userId ??= (await tx.insert(users).values({}).returning({ id: users.id }))[0]!.id;
        const [created] = await tx
          .insert(identities)
          .values({ userId, provider, subject, appleRefreshToken: appleRefreshToken ?? null, email: email?.address ?? null, emailLinkable: email?.linkable ?? false })
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
  if (email && (identity.email !== email.address || identity.emailLinkable !== email.linkable)) {
    changes.email = email.address;
    changes.emailLinkable = email.linkable;
  }
  if (Object.keys(changes).length > 0) await db.update(identities).set(changes).where(eq(identities.id, identity.id));

  let userId = identity.userId;
  if (email?.linkable) {
    const [mine] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
    if (mine && mine.username === null) {
      const target = await findMatch(db, email.address, provider, { named: true, except: userId });
      if (target) userId = await mergeEmptyAccount(db, identity.id, userId, target);
    }
  }
  return userId;
}
