import { z } from "@hono/zod-openapi";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { conversationReads, conversations, messages, privacySettings } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { areFriends } from "./people.js";
import { PRIVACY_DEFAULTS } from "./routes/privacy.js";
import { coupletKeySchema } from "./schemas.js";
import { isBlocked, orderedPair } from "./social.js";

export const MESSAGE_MAX = 1000;
export const NOTE_MAX = 200;

type MessageRow = typeof messages.$inferSelect;

export const messageSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    kind: z.enum(["text", "couplet", "system", "game"]),
    fromMe: z.boolean(),
    text: z.string().nullable().openapi({ description: "`text` messages only." }),
    key: coupletKeySchema.nullable().openapi({ description: "`couplet` messages only: the couplet to show." }),
    note: z.string().nullable().openapi({ description: "`couplet` messages only: the optional note that came with it." }),
    payload: z.record(z.string(), z.unknown()).nullable().openapi({ description: "`system` and `game` messages: `{ event, ... }`, e.g. `{ event: \"divan_add\", key }`." }),
    deleted: z.boolean().openapi({ description: "The sender deleted it; text, key, note and payload are then null." }),
    createdAt: z.iso.datetime(),
  })
  .openapi("Message");

export type MessageView = z.infer<typeof messageSchema>;

/** A message as `viewer` sees it. A system line's `by` (the user it came from) becomes `fromMe`. */
export function messageView(row: MessageRow, viewer: string): MessageView {
  const deleted = row.deletedAt !== null;
  const { by, ...payload } = (row.payload ?? {}) as { by?: string } & Record<string, unknown>;
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    fromMe: (row.senderId ?? by) === viewer,
    text: deleted ? null : row.text,
    key: deleted ? null : row.coupletKey,
    note: deleted ? null : row.note,
    payload: deleted || !row.payload ? null : payload,
    deleted,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The conversation if `userId` is one of its two people. `otherId` is the other person. */
export async function findConversation(db: Db, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), or(eq(conversations.userLow, userId), eq(conversations.userHigh, userId))));
  return row ? { id: row.id, otherId: row.userLow === userId ? row.userHigh : row.userLow } : undefined;
}

/** The id of the chat of two people, if they have one. */
export async function findConversationOf(db: Db, a: string, b: string): Promise<string | undefined> {
  const pair = orderedPair(a, b);
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userLow, pair.userLow), eq(conversations.userHigh, pair.userHigh)));
  return row?.id;
}

export async function getOrCreateConversation(db: Db, a: string, b: string): Promise<string> {
  await db.insert(conversations).values(orderedPair(a, b)).onConflictDoNothing();
  return (await findConversationOf(db, a, b))!;
}

/**
 * May `from` write to `to` in this conversation: nobody blocked the other, and either `to` already wrote here (a reply is always fine),
 * or `to` takes messages from everyone, or from friends and `from` is one.
 */
export async function mayMessage(db: Db, from: string, to: string, conversationId?: string): Promise<boolean> {
  if (await isBlocked(db, from, to)) return false;
  if (conversationId) {
    const [reply] = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, to))).limit(1);
    if (reply) return true;
  }
  const [row] = await db.select({ from: privacySettings.messagesFrom }).from(privacySettings).where(eq(privacySettings.userId, to));
  if ((row?.from ?? PRIVACY_DEFAULTS.messagesFrom) === "all") return true;
  return areFriends(db, from, to);
}

/** May `from` start or go on writing to `to` now: the same rule as sending (for a chat that exists, the reply rule too). Never to oneself. */
export async function canMessage(db: Db, from: string, to: string): Promise<boolean> {
  if (from === to) return false;
  return mayMessage(db, from, to, await findConversationOf(db, from, to));
}

/** Of these users, the ones who let others see when they are online (the default). */
export async function showingOnline(db: Db, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const hidden = await db
    .select({ id: privacySettings.userId })
    .from(privacySettings)
    .where(and(inArray(privacySettings.userId, ids), eq(privacySettings.showOnline, false)));
  const hiddenIds = new Set(hidden.map((r) => r.id));
  return new Set(ids.filter((id) => !hiddenIds.has(id)));
}

/**
 * Unread messages of `userId`, by conversation: the other person's messages (not system lines, not deleted) after the last one read.
 * With `ids` only those conversations count; without, every conversation of the user that nobody blocked.
 */
export async function unreadCounts(db: Db, userId: string, ids?: string[]): Promise<Map<string, number>> {
  if (ids && ids.length === 0) return new Map();
  const rows = await db
    .select({ id: messages.conversationId, n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(conversationReads, and(eq(conversationReads.conversationId, messages.conversationId), eq(conversationReads.userId, userId)))
    .where(
      and(
        ids ? inArray(messages.conversationId, ids) : or(eq(conversations.userLow, userId), eq(conversations.userHigh, userId)),
        sql`${messages.senderId} is not null and ${messages.senderId} <> ${userId} and ${messages.deletedAt} is null`,
        sql`(${conversationReads.lastReadMessageId} is null or (${messages.createdAt}, ${messages.id}) > (select r.created_at, r.id from messages r where r.id = ${conversationReads.lastReadMessageId}))`,
        sql`not exists (select 1 from blocks bl where (bl.blocker_id = ${userId} and bl.blocked_id = ${messages.senderId}) or (bl.blocker_id = ${messages.senderId} and bl.blocked_id = ${userId}))`,
      ),
    )
    .groupBy(messages.conversationId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Tells both people of a conversation about a message, each with their own view. */
export function publishMessage(deps: Deps, people: [string, string], row: MessageRow) {
  for (const userId of people) deps.hub.publish(userId, { type: "message", message: messageView(row, userId) });
}
