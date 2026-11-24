import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversations, messages, REPORT_REASONS, reports, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { requireAdmin } from "../middleware.js";
import { findByUsername, PAGE, parseTimeCursor, timeCursor, timeCursorSchema } from "../people.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { usernameSchema } from "../schemas.js";

const reasonSchema = z.enum(REPORT_REASONS);
const bodySchema = z
  .object({
    username: usernameSchema.openapi({ description: "The person reported." }),
    messageId: z.uuid().optional().openapi({ description: "One of their messages in a chat I am in." }),
    reason: reasonSchema,
    note: z.string().max(500).optional(),
  })
  .openapi("ReportRequest");

const itemSchema = z
  .object({
    id: z.uuid(),
    reporter: z.string().nullable().openapi({ description: "Null after the reporter deleted their account." }),
    target: z.string().nullable().openapi({ description: "Null after the reported person deleted their account." }),
    reason: reasonSchema,
    note: z.string().nullable(),
    message: z
      .object({ id: z.uuid().nullable().openapi({ description: "Null once the message is gone for good (its sender deleted their account)." }), kind: z.enum(["text", "couplet", "system", "game"]), text: z.string().nullable(), key: z.string().nullable(), note: z.string().nullable(), deleted: z.boolean() })
      .nullable()
      .openapi({ description: "The reported message as it was when reported; null when the report is of the person. `deleted` is true when it has been deleted since." }),
    createdAt: z.iso.datetime(),
  })
  .openapi("AdminReport");
const listSchema = z
  .object({ items: z.array(itemSchema), nextBefore: z.string().nullable().openapi({ description: "Pass as `before` for the next page; null on the last page." }) })
  .openapi("AdminReportList");

export function reportRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const limiter = createRateLimiter(10, 60_000, deps.now);
  app.use("/v1/admin/reports", requireAdmin(deps));

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/reports",
      tags: ["safety"],
      summary: "Report a person or one of their messages",
      description: "For abuse or spam. A report is read by the team; the reported person is not told. 10 reports a minute per user.",
      security: [{ bearerAuth: [] }],
      request: { body: { required: true, content: { "application/json": { schema: bodySchema } } } },
      responses: {
        204: { description: "Reported." },
        400: errorResponse("invalid_request: a bad body, or that is yourself."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required: set a username first."),
        404: errorResponse("No such user, or no such message of theirs in a chat I am in."),
        429: errorResponse("Too many reports (10 a minute per user)."),
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
      const { username, messageId, reason, note } = c.req.valid("json");
      const person = await findByUsername(db, username);
      if (!person) throw new ApiError(404, "not_found");
      if (person.id === userId) throw new ApiError(400, "invalid_request");
      let copy = {};
      if (messageId) {
        const [found] = await db
          .select({ kind: messages.kind, text: messages.text, key: messages.coupletKey, note: messages.note, deleted: messages.deletedAt })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .where(and(eq(messages.id, messageId), eq(messages.senderId, person.id), or(eq(conversations.userLow, userId), eq(conversations.userHigh, userId))));
        if (!found) throw new ApiError(404, "not_found");
        copy = { messageKind: found.kind, messageText: found.text, messageKey: found.key, messageNote: found.note };
      }
      await db.insert(reports).values({ reporterId: userId, targetUserId: person.id, messageId: messageId ?? null, ...copy, reason, note: note ?? null, createdAt: deps.now() });
      return c.body(null, 204);
    },
  );

  const reporter = alias(users, "reporter");
  const target = alias(users, "target");
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/admin/reports",
      tags: ["admin"],
      summary: "Reports, newest first, 50 a page",
      security: [{ adminAuth: [] }],
      request: { query: z.object({ before: timeCursorSchema.optional().openapi({ description: "The `nextBefore` of the previous page." }) }) },
      responses: {
        200: { description: "A page of reports.", content: { "application/json": { schema: listSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Wrong or missing admin token."),
      },
    }),
    async (c) => {
      const { before } = c.req.valid("query");
      const after = before ? parseTimeCursor(before)! : null;
      const rows = await db
        .select({ r: reports, reporter: reporter.username, target: target.username, m: messages })
        .from(reports)
        .leftJoin(reporter, eq(reporter.id, reports.reporterId))
        .leftJoin(target, eq(target.id, reports.targetUserId))
        .leftJoin(messages, eq(messages.id, reports.messageId))
        .where(after ? or(lt(reports.createdAt, after.at), and(eq(reports.createdAt, after.at), lt(reports.id, after.id))) : undefined)
        .orderBy(desc(reports.createdAt), desc(reports.id))
        .limit(PAGE + 1);
      const page = rows.slice(0, PAGE);
      const last = page.at(-1);
      return c.json(
        {
          items: page.map(({ r, reporter: from, target: to, m }) => ({
            id: r.id,
            reporter: from,
            target: to,
            reason: r.reason,
            note: r.note,
            message: r.messageKind
              ? { id: r.messageId, kind: r.messageKind, text: r.messageText, key: r.messageKey, note: r.messageNote, deleted: m === null || m.deletedAt !== null }
              : null,
            createdAt: r.createdAt.toISOString(),
          })),
          nextBefore: rows.length > PAGE && last ? timeCursor(last.r.createdAt, last.r.id) : null,
        },
        200,
      );
    },
  );

  return app;
}
