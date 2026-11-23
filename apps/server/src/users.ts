import { and, eq } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { isUniqueViolation } from "./db/index.js";
import { identities, users } from "./db/schema.js";
import type { UserView } from "./schemas.js";

export type Provider = "apple" | "google";

export async function getUserView(db: Db, id: string): Promise<UserView | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;
  const providers = await db.select({ provider: identities.provider }).from(identities).where(eq(identities.userId, id));
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    usernameChangedAt: user.usernameChangedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    providers: providers.map((p) => p.provider).sort(),
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
 * Finds or creates the user for a provider's account id (`sub`). We store the id only:
 * no email and no name. `appleRefreshToken` (sealed) replaces the stored one when given.
 */
export async function upsertUser(db: Db, provider: Provider, subject: string, appleRefreshToken?: string | null): Promise<string> {
  let identity = await findIdentity(db, provider, subject);
  if (!identity) {
    try {
      identity = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({}).returning({ id: users.id });
        const [created] = await tx
          .insert(identities)
          .values({ userId: user!.id, provider, subject, appleRefreshToken: appleRefreshToken ?? null })
          .returning();
        return created!;
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      identity = await findIdentity(db, provider, subject);
    }
  }
  if (!identity) throw new Error("identity vanished");
  if (appleRefreshToken && identity.appleRefreshToken !== appleRefreshToken) {
    await db.update(identities).set({ appleRefreshToken }).where(eq(identities.id, identity.id));
  }
  return identity.userId;
}
