import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import { feedback, feedbackAttachments, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { requireAdmin } from "../middleware.js";
import { newRouter } from "../router.js";

const PAGE = 50;
const security = [{ adminAuth: [] }];
const binary = z.string().openapi({ format: "binary" });
const kinds = ["screenshot", "recording"] as const;
const types = ["bug", "annoyed", "idea", "game", "liked"] as const;

const itemSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(types),
    text: z.string().nullable(),
    frequency: z.enum(["always", "sometimes", "once"]).nullable(),
    game: z.object({ name: z.string().optional(), how: z.string(), players: z.enum(["solo", "friends", "both"]) }).nullable(),
    screen: z.string().nullable(),
    technical: z.record(z.string(), z.unknown()).nullable(),
    appVersion: z.string(),
    deviceModel: z.string(),
    osVersion: z.string(),
    username: z.string().nullable().openapi({ description: "Null for guests, for users with no username yet, and after the account is deleted." }),
    createdAt: z.iso.datetime(),
    attachments: z.array(z.object({ kind: z.enum(kinds), contentType: z.string(), size: z.number().int() })),
  })
  .openapi("AdminFeedbackItem");

const listSchema = z
  .object({ items: z.array(itemSchema), nextBefore: z.string().nullable().openapi({ description: "Pass as `before` for the next page; null on the last page." }) })
  .openapi("AdminFeedbackList");

/** The cursor is the last row's "<createdAt>_<id>", so reports sent in the same millisecond are never skipped. */
const splitCursor = (cursor: string) => {
  const [at = "", id = ""] = cursor.split("_");
  return { at: new Date(at), isoOk: /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at), id };
};
const cursorSchema = z.string().refine((v) => {
  const { at, isoOk, id } = splitCursor(v);
  return isoOk && !Number.isNaN(at.getTime()) && z.uuid().safeParse(id).success;
});

export function feedbackAdminRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  app.use("/v1/admin/feedback", requireAdmin(deps));
  app.use("/v1/admin/feedback/*", requireAdmin(deps));

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/admin/feedback",
      tags: ["admin"],
      summary: "Reports, newest first, 50 a page",
      security,
      request: {
        query: z.object({
          type: z.enum(types).optional(),
          before: cursorSchema.optional().openapi({ description: "The `nextBefore` of the previous page." }),
        }),
      },
      responses: {
        200: { description: "A page of reports.", content: { "application/json": { schema: listSchema } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Wrong or missing admin token."),
      },
    }),
    async (c) => {
      const { type, before } = c.req.valid("query");
      const conditions: (SQL | undefined)[] = [type ? eq(feedback.type, type) : undefined];
      if (before) {
        const { at, id } = splitCursor(before);
        conditions.push(or(lt(feedback.createdAt, at), and(eq(feedback.createdAt, at), lt(feedback.id, id))));
      }
      const rows = await db
        .select({ f: feedback, username: users.username })
        .from(feedback)
        .leftJoin(users, eq(users.id, feedback.userId))
        .where(and(...conditions))
        .orderBy(desc(feedback.createdAt), desc(feedback.id))
        .limit(PAGE + 1);
      const page = rows.slice(0, PAGE);
      const files = page.length
        ? await db
            .select({ feedbackId: feedbackAttachments.feedbackId, kind: feedbackAttachments.kind, contentType: feedbackAttachments.contentType, size: feedbackAttachments.size })
            .from(feedbackAttachments)
            .where(inArray(feedbackAttachments.feedbackId, page.map((r) => r.f.id)))
            .orderBy(feedbackAttachments.kind)
        : [];
      const last = page.at(-1);
      return c.json(
        {
          items: page.map(({ f, username }) => ({
            id: f.id,
            type: f.type,
            text: f.text,
            frequency: f.frequency,
            game: f.game,
            screen: f.screen,
            technical: f.technical,
            appVersion: f.appVersion,
            deviceModel: f.deviceModel,
            osVersion: f.osVersion,
            username,
            createdAt: f.createdAt.toISOString(),
            attachments: files.filter((a) => a.feedbackId === f.id).map(({ kind, contentType, size }) => ({ kind, contentType, size })),
          })),
          nextBefore: rows.length > PAGE && last ? `${last.f.createdAt.toISOString()}_${last.f.id}` : null,
        },
        200,
      );
    },
  );

  for (const kind of kinds) {
    app.openapi(
      createRoute({
        method: "get",
        path: `/v1/admin/feedback/{id}/${kind}`,
        tags: ["admin"],
        summary: `Download a report's ${kind}`,
        security,
        request: { params: z.object({ id: z.uuid() }) },
        responses: {
          200: {
            description: "The file, as an attachment.",
            content: { "image/jpeg": { schema: binary }, "image/png": { schema: binary }, "video/mp4": { schema: binary } },
          },
          400: errorResponse("Bad request."),
          401: errorResponse("Wrong or missing admin token."),
          404: errorResponse("No such attachment."),
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const [row] = await db
          .select({ contentType: feedbackAttachments.contentType, bytes: feedbackAttachments.bytes })
          .from(feedbackAttachments)
          .where(and(eq(feedbackAttachments.feedbackId, id), eq(feedbackAttachments.kind, kind)));
        if (!row) throw new ApiError(404, "not_found");
        const extension = { "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4" }[row.contentType];
        return c.body(row.bytes as unknown as ArrayBuffer, 200, {
          "content-type": row.contentType,
          "content-disposition": `attachment; filename="feedback-${id}-${kind}.${extension}"`,
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store",
        }) as never;
      },
    );
  }

  return app;
}
