import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { constantTimeEqual, randomToken, sha256Hex } from "../crypto.js";
import { feedback, feedbackAttachments } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { feedbackCreatedSchema, feedbackRequestSchema } from "../feedback.js";
import { optionalUser } from "../middleware.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";

const HOUR_MS = 60 * 60 * 1000;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const MB = 1024 * 1024;
const binary = z.string().openapi({ format: "binary" });
/** An empty requirement next to bearerAuth makes signing in optional in the contract. */
const noAuth: Record<string, string[]> = {};

const KINDS = {
  screenshot: { types: ["bug", "annoyed", "idea"], contentTypes: ["image/jpeg", "image/png"], maxBytes: 3 * MB },
  recording: { types: ["bug"], contentTypes: ["video/mp4"], maxBytes: 25 * MB },
} as const;

const tooLarge = (c: { json: (body: { error: "payload_too_large" }, status: 413) => Response }) => c.json({ error: "payload_too_large" }, 413);

export function feedbackRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const perUser = createRateLimiter(10, HOUR_MS, deps.now);
  const guests = createRateLimiter(120, HOUR_MS, deps.now);

  app.use("/v1/feedback", optionalUser(deps));
  app.use("/v1/feedback", bodyLimit({ maxSize: 32 * 1024, onError: tooLarge }));
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/feedback",
      tags: ["feedback"],
      summary: "Send a report: a bug, something annoying, an idea, a game idea or a thank-you",
      description:
        "Signing in is optional; when signed in the report carries the user (the admin sees the username). Signed-in users may send 10 an hour; all guests together 120 an hour. Nothing about the connection is stored. Answers an upload token for the attachments.",
      security: [{ bearerAuth: [] }, noAuth],
      request: { body: { required: true, content: { "application/json": { schema: feedbackRequestSchema } } } },
      responses: {
        201: { description: "Stored.", content: { "application/json": { schema: feedbackCreatedSchema } } },
        400: errorResponse("Breaks the rules for its type."),
        401: errorResponse("A token was sent but it is not valid."),
        413: errorResponse("Larger than 32 KB."),
        429: errorResponse("Too many reports."),
      },
    }),
    async (c) => {
      const userId = c.req.header("authorization") ? c.get("userId") : null;
      if (!(userId ? perUser.take(userId) : guests.take("guests"))) throw new ApiError(429, "rate_limited");
      const body = c.req.valid("json");
      const uploadToken = randomToken();
      const now = deps.now();
      const [row] = await db
        .insert(feedback)
        .values({
          userId,
          type: body.type,
          text: body.text ?? null,
          frequency: body.frequency ?? null,
          game: body.game ?? null,
          screen: body.screen ?? null,
          technical: body.technical ?? null,
          appVersion: body.appVersion,
          deviceModel: body.deviceModel,
          osVersion: body.osVersion,
          uploadTokenHash: sha256Hex(uploadToken),
          uploadExpiresAt: new Date(now.getTime() + UPLOAD_WINDOW_MS),
          createdAt: now,
        })
        .returning({ id: feedback.id });
      return c.json({ id: row!.id, uploadToken }, 201);
    },
  );

  for (const [kind, rule] of Object.entries(KINDS) as [keyof typeof KINDS, (typeof KINDS)[keyof typeof KINDS]][]) {
    const mediaTypes = Object.fromEntries(rule.contentTypes.map((t) => [t, { schema: binary }]));
    app.use(`/v1/feedback/:id/${kind}`, bodyLimit({ maxSize: rule.maxBytes, onError: tooLarge }));
    app.openapi(
      createRoute({
        method: "put",
        path: `/v1/feedback/{id}/${kind}`,
        tags: ["feedback"],
        summary: `Attach a ${kind} to a report`,
        description: `For reports of type ${rule.types.join(", ")}; ${rule.contentTypes.join(" or ")}, at most ${rule.maxBytes / MB} MB; one per report, within 15 minutes of sending it.`,
        request: {
          params: z.object({ id: z.uuid() }),
          headers: z.object({ "x-upload-token": z.string().optional().openapi({ description: "The uploadToken from the report." }) }),
          body: { required: true, content: mediaTypes },
        },
        responses: {
          204: { description: "Stored." },
          400: errorResponse(`Empty, or the report's type takes no ${kind}.`),
          403: errorResponse("Wrong, missing or expired upload token."),
          404: errorResponse("No such report."),
          409: errorResponse(`already_uploaded: this report already has a ${kind}.`),
          413: errorResponse(`Larger than ${rule.maxBytes / MB} MB.`),
          415: errorResponse("Wrong media type."),
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const [report] = await db
          .select({ type: feedback.type, hash: feedback.uploadTokenHash, expiresAt: feedback.uploadExpiresAt })
          .from(feedback)
          .where(eq(feedback.id, id));
        if (!report) throw new ApiError(404, "not_found");
        const token = c.req.header("x-upload-token") ?? "";
        if (!constantTimeEqual(sha256Hex(token), report.hash) || report.expiresAt <= deps.now()) throw new ApiError(403, "forbidden");
        if (!(rule.types as readonly string[]).includes(report.type)) throw new ApiError(400, "invalid_request");
        const contentType = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
        if (!(rule.contentTypes as readonly string[]).includes(contentType)) throw new ApiError(415, "unsupported_media_type");
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        if (bytes.length === 0) throw new ApiError(400, "invalid_request");
        const stored = await db
          .insert(feedbackAttachments)
          .values({ feedbackId: id, kind, contentType, bytes, size: bytes.length, createdAt: deps.now() })
          .onConflictDoNothing()
          .returning({ id: feedbackAttachments.id });
        if (stored.length === 0) throw new ApiError(409, "already_uploaded");
        return c.body(null, 204);
      },
    );
  }

  return app;
}
