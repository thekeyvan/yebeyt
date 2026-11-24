import { and, eq, or, sql } from "drizzle-orm";
import { conversations, privacySettings, users } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { notBlockedWith } from "./social.js";

/**
 * Tells the people the user chats with (a chat that has a message, nobody blocked) that they went online or offline.
 * Nothing is sent when the user hides it («آنلاین» off), unless `evenIfHidden`: the offline event sent when they turn it off.
 */
export async function announcePresence(deps: Deps, userId: string, online: boolean, evenIfHidden = false) {
  const { db } = deps;
  if (!evenIfHidden) {
    const [hidden] = await db.select({ id: privacySettings.userId }).from(privacySettings).where(and(eq(privacySettings.userId, userId), eq(privacySettings.showOnline, false)));
    if (hidden) return;
  }
  const [me] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
  const otherId = sql<string>`case when ${conversations.userLow} = ${userId} then ${conversations.userHigh} else ${conversations.userLow} end`;
  const watchers = await db
    .select({ id: otherId })
    .from(conversations)
    .where(
      and(
        or(eq(conversations.userLow, userId), eq(conversations.userHigh, userId)),
        sql`exists (select 1 from messages m where m.conversation_id = ${conversations.id})`,
        notBlockedWith(userId, otherId),
      ),
    );
  for (const { id } of watchers) deps.hub.publish(id, { type: "presence", username: me!.username, online });
}
