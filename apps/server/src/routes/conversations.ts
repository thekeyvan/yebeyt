import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversations, messages, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { getOrCreateConversation, mayMessage, messageView, showingOnline, unreadCounts } from "../messaging.js";
import { findByUsername, PAGE, parseTimeCursor, shortPersonSchema, timeCursor, timeCursorSchema } from "../people.js";
import { newRouter } from "../router.js";
import { isBlocked, notBlockedWith } from "../social.js";
import { usernameSchema } from "../schemas.js";

const security = [{ bearerAuth: [] }];
const otherSchema = shortPersonSchema
  .extend({ online: z.boolean().nullable().openapi({ description: "Connected right now; null when they do not let others see it («آنلاین» off)." }) })
  .openapi("ChatPerson");
const opened = z.object({ id: z.uuid(), other: otherSchema }).openapi("Conversation");
const lastSchema = z
  .object({
    kind: z.enum(["text", "couplet", "system", "game"]),
    text: z.string().nullable(),
    key: z.string().nullable().openapi({ description: "A couplet message's couplet key; the app shows its first hemistich." }),
    note: z.string().nullable(),
    deleted: z.boolean(),
    at: z.iso.datetime(),
    fromMe: z.boolean(),
  })
  .openapi("ConversationLast");
const itemSchema = z.object({ id: z.uuid(), other: otherSchema, last: lastSchema, unread: z.number().int() }).openapi("ConversationListItem");
const pageSchema = z
  .object({ items: z.array(itemSchema), nextCursor: z.string().nullable().openapi({ description: "Pass as `cursor` for the next page; null on the last page." }) })
  .openapi("ConversationPage");

export function conversationRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/conversations",
      tags: ["messages"],
      summary: "Open the chat with someone (made if it does not exist)",
      description:
        "Allowed when the other person takes messages from everyone («بهم پیام بده: همه»), or from friends and we are friends; otherwise 403 messages_closed. " +
        "If either of us blocked the other, the person is not found (404). The chat shows in the list once it has a message.",
      security,
      request: { body: { required: true, content: { "application/json": { schema: z.object({ username: usernameSchema }).openapi("OpenConversationRequest") } } } },
      responses: {
        200: { description: "The chat.", content: { "application/json": { schema: opened } } },
        400: errorResponse("invalid_request: that is yourself."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required, or messages_closed: they do not take messages from me."),
        404: errorResponse("No user with that username, or one of us blocked the other."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const other = await findByUsername(db, c.req.valid("json").username);
      if (!other || (await isBlocked(db, me, other.id))) throw new ApiError(404, "not_found");
      if (other.id === me) throw new ApiError(400, "invalid_request");
      if (!(await mayMessage(db, me, other.id))) throw new ApiError(403, "messages_closed");
      const id = await getOrCreateConversation(db, me, other.id);
      const online = (await showingOnline(db, [other.id])).has(other.id) ? deps.hub.isOnline(other.id) : null;
      return c.json({ id, other: { username: other.username!, displayName: other.displayName, avatar: other.avatar, online } }, 200);
    },
  );

  const lastMessage = alias(messages, "last_message");
  const otherUser = alias(users, "other_user");
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/conversations",
      tags: ["messages"],
      summary: "My chats with the latest message and the unread count, newest first, 50 a page",
      description: "Only chats with at least one message, and not with someone blocked either way.",
      security,
      request: { query: z.object({ cursor: timeCursorSchema.optional() }) },
      responses: {
        200: { description: "A page of chats.", content: { "application/json": { schema: pageSchema } } },
        400: errorResponse("A malformed cursor."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { cursor } = c.req.valid("query");
      const after = cursor ? parseTimeCursor(cursor)! : null;
      const otherId = sql`case when ${conversations.userLow} = ${me} then ${conversations.userHigh} else ${conversations.userLow} end`;
      const latest = db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .as("latest");
      const rows = await db
        .select({
          id: conversations.id,
          otherId: otherUser.id,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatar: otherUser.avatar,
          last: lastMessage,
        })
        .from(conversations)
        .innerJoinLateral(latest, sql`true`)
        .innerJoin(lastMessage, eq(lastMessage.id, latest.id))
        .innerJoin(otherUser, sql`${otherUser.id} = ${otherId}`)
        .where(
          and(
            or(eq(conversations.userLow, me), eq(conversations.userHigh, me)),
            notBlockedWith(me, otherUser.id),
            after ? sql`(${lastMessage.createdAt}, ${conversations.id}) < (${after.at.toISOString()}::timestamptz, ${after.id}::uuid)` : undefined,
          ),
        )
        .orderBy(desc(lastMessage.createdAt), desc(conversations.id))
        .limit(PAGE + 1);
      const page = rows.slice(0, PAGE);
      const [unread, visible] = await Promise.all([
        unreadCounts(db, me, page.map((r) => r.id)),
        showingOnline(db, page.map((r) => r.otherId)),
      ]);
      const last = page.at(-1);
      return c.json(
        {
          items: page.map((r) => {
            const m = messageView(r.last, me);
            return {
              id: r.id,
              other: { username: r.username!, displayName: r.displayName, avatar: r.avatar, online: visible.has(r.otherId) ? deps.hub.isOnline(r.otherId) : null },
              last: { kind: m.kind, text: m.text, key: m.key, note: m.note, deleted: m.deleted, at: m.createdAt, fromMe: m.fromMe },
              unread: unread.get(r.id) ?? 0,
            };
          }),
          nextCursor: rows.length > PAGE && last ? timeCursor(last.last.createdAt, last.id) : null,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/unread",
      tags: ["messages"],
      summary: "How many unread messages I have, for the tab badge",
      description: "The other people's messages after the last one I read, in all chats that nobody blocked. System lines and deleted messages do not count.",
      security,
      responses: {
        200: { description: "The total.", content: { "application/json": { schema: z.object({ total: z.number().int() }).openapi("Unread") } } },
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
      },
    }),
    async (c) => {
      const counts = await unreadCounts(db, c.get("userId"));
      return c.json({ total: [...counts.values()].reduce((a, b) => a + b, 0) }, 200);
    },
  );

  return app;
}
