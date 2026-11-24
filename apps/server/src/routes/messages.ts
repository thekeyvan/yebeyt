import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { isUniqueViolation } from "../db/index.js";
import { conversationReads, conversations, messages, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { findConversation, MESSAGE_MAX, mayMessage, messageSchema, messageView, NOTE_MAX, publishMessage } from "../messaging.js";
import { PAGE, parseTimeCursor, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { isBlocked } from "../social.js";
import { coupletKeySchema } from "../schemas.js";

const security = [{ bearerAuth: [] }];
const idParam = z.object({ id: z.uuid() });
const clientId = z.uuid().openapi({ description: "Made by the phone for each message; sending it again returns the same message, so a retry never doubles it." });

const sendSchema = z
  .discriminatedUnion("kind", [
    z.object({ clientId, kind: z.literal("text"), text: z.string().trim().min(1).max(MESSAGE_MAX) }),
    z.object({ clientId, kind: z.literal("couplet"), key: coupletKeySchema, note: z.string().trim().min(1).max(NOTE_MAX).optional() }),
  ])
  .openapi("SendMessageRequest");

const pageSchema = z
  .object({
    items: z.array(messageSchema),
    nextBefore: z.string().nullable().openapi({ description: "Pass as `before` for older messages; null at the start of the chat." }),
    otherReadMessageId: z.uuid().nullable().openapi({ description: "The last message the other person has read («دیده شد» up to it); null if none." }),
  })
  .openapi("MessagePage");

export function messageRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(30, 60_000, deps.now);

  /** The conversation of a member; for anyone else, and for a blocked pair, it does not exist. */
  const member = async (id: string, userId: string) => {
    const conversation = await findConversation(db, id, userId);
    if (!conversation || (await isBlocked(db, userId, conversation.otherId))) throw new ApiError(404, "not_found");
    return conversation;
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/conversations/{id}/messages",
      tags: ["messages"],
      summary: "Messages of a chat, newest first",
      description: "Only for the two people of the chat. 50 at most per page (`limit`); `before` is the `nextBefore` of the previous page.",
      security,
      request: { params: idParam, query: z.object({ before: timeCursorSchema.optional(), limit: z.coerce.number().int().min(1).max(PAGE).default(PAGE) }) },
      responses: {
        200: { description: "A page of messages.", content: { "application/json": { schema: pageSchema } } },
        400: errorResponse("A malformed id, cursor or limit."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
        404: errorResponse("No such chat, or I am not in it, or one of us blocked the other."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const conversation = await member(c.req.valid("param").id, me);
      const { before, limit } = c.req.valid("query");
      const after = before ? parseTimeCursor(before)! : null;
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            after ? or(lt(messages.createdAt, after.at), and(eq(messages.createdAt, after.at), lt(messages.id, after.id))) : undefined,
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      const [read] = await db
        .select({ id: conversationReads.lastReadMessageId })
        .from(conversationReads)
        .where(and(eq(conversationReads.conversationId, conversation.id), eq(conversationReads.userId, conversation.otherId)));
      return c.json(
        {
          items: items.map((m) => messageView(m, me)),
          nextBefore: rows.length > limit && last ? timeCursor(last.createdAt, last.id) : null,
          otherReadMessageId: read?.id ?? null,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/conversations/{id}/messages",
      tags: ["messages"],
      summary: "Send a text or a couplet",
      description:
        "`kind` is `text` (`text`, 1–1000 characters) or `couplet` (`key` and an optional `note` of up to 200). Idempotent per sender and `clientId`: a repeat answers 200 with the first message. " +
        "Blocks and «بهم پیام بده» are checked on every send (403 messages_closed); answering a person who already wrote in the chat is always allowed, unless blocked. 30 messages a minute per user. Both people get a live `message` event.",
      security,
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: sendSchema } } } },
      responses: {
        200: { description: "This client id was already sent; the first message.", content: { "application/json": { schema: messageSchema } } },
        201: { description: "Sent.", content: { "application/json": { schema: messageSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required, or messages_closed: blocked, or they do not take messages from me."),
        404: errorResponse("No such chat, or I am not in it."),
        409: errorResponse("conflict: the client id was used for a message in another chat."),
        429: errorResponse("Too many messages (30 a minute per user)."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      if (!limiter.take(me)) throw new ApiError(429, "rate_limited");
      const conversation = await findConversation(db, c.req.valid("param").id, me);
      if (!conversation) throw new ApiError(404, "not_found");
      const body = c.req.valid("json");
      const existing = async () => {
        const [row] = await db.select().from(messages).where(and(eq(messages.senderId, me), eq(messages.clientId, body.clientId)));
        if (row && row.conversationId !== conversation.id) throw new ApiError(409, "conflict");
        return row;
      };
      const before = await existing();
      if (before) return c.json(messageView(before, me), 200);
      if (!(await mayMessage(db, me, conversation.otherId, conversation.id))) throw new ApiError(403, "messages_closed");
      let row;
      try {
        [row] = await db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId: me,
            kind: body.kind,
            text: body.kind === "text" ? body.text : null,
            coupletKey: body.kind === "couplet" ? body.key : null,
            note: body.kind === "couplet" ? (body.note ?? null) : null,
            clientId: body.clientId,
            createdAt: deps.now(),
          })
          .returning();
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        return c.json(messageView((await existing())!, me), 200);
      }
      publishMessage(deps, [me, conversation.otherId], row!);
      return c.json(messageView(row!, me), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/conversations/{id}/read",
      tags: ["messages"],
      summary: "Mark a chat as read up to a message",
      description: "Never moves backwards. The other person gets a live `read` event (with my username) when the mark moved, which is their «دیده شد».",
      security,
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: z.object({ messageId: z.uuid() }).openapi("MarkReadRequest") } } } },
      responses: {
        204: { description: "Done." },
        400: errorResponse("Bad request."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
        404: errorResponse("No such chat, or I am not in it, or the message is not in it."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const conversation = await member(c.req.valid("param").id, me);
      const { messageId } = c.req.valid("json");
      const [message] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversation.id)));
      if (!message) throw new ApiError(404, "not_found");
      // The mark only advances: the update applies when the new message is later than the one marked now.
      const values = { lastReadMessageId: message.id, lastReadAt: deps.now() };
      const advanced = await db
        .insert(conversationReads)
        .values({ conversationId: conversation.id, userId: me, ...values })
        .onConflictDoUpdate({
          target: [conversationReads.conversationId, conversationReads.userId],
          set: values,
          setWhere: sql`(select (r.created_at, r.id) from messages r where r.id = ${conversationReads.lastReadMessageId}) < (${message.createdAt.toISOString()}::timestamptz, ${message.id}::uuid)`,
        })
        .returning({ id: conversationReads.lastReadMessageId });
      if (advanced.length > 0) {
        const [reader] = await db.select({ username: users.username }).from(users).where(eq(users.id, me));
        deps.hub.publish(conversation.otherId, { type: "read", conversationId: conversation.id, username: reader!.username, messageId: message.id });
      }
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/messages/{id}",
      tags: ["messages"],
      summary: "Delete a message I sent",
      description: "Idempotent. The message stays in the chat as «deleted»; its text, couplet and note are removed. System lines cannot be deleted. Both people get a live `deleted` event.",
      security,
      request: { params: idParam },
      responses: {
        204: { description: "Deleted." },
        400: errorResponse("A malformed id."),
        401: errorResponse("Not signed in."),
        403: errorResponse("forbidden: not my message."),
        404: errorResponse("No such message, or I am not in its chat."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const [row] = await db
        .select({ message: messages, otherId: sql<string>`case when ${conversations.userLow} = ${me} then ${conversations.userHigh} else ${conversations.userLow} end` })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(and(eq(messages.id, c.req.valid("param").id), or(eq(conversations.userLow, me), eq(conversations.userHigh, me))));
      if (!row) throw new ApiError(404, "not_found");
      if (row.message.senderId !== me) throw new ApiError(403, "forbidden");
      if (!row.message.deletedAt) {
        await db.update(messages).set({ deletedAt: deps.now(), text: null, coupletKey: null, note: null, payload: null }).where(eq(messages.id, row.message.id));
        const event = { type: "deleted", conversationId: row.message.conversationId, messageId: row.message.id } as const;
        deps.hub.publish(me, event);
        deps.hub.publish(row.otherId, event);
      }
      return c.body(null, 204);
    },
  );

  return app;
}
