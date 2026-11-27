import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { constantTimeEqual, randomToken, sha256Hex } from "../crypto.js";
import { feedback, feedbackAttachments } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { feedbackCreatedSchema, feedbackRequestSchema } from "../feedback.js";
import { matchesMediaType } from "../media.js";
import { optionalUser } from "../middleware.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";

const HOUR_MS = 60 * 60 * 1000;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const MB = 1024 * 1024;
const binary = z.string().openapi({ format: "binary" });
/** An empty requirement next to bearerAuth makes signing in optional in the contract. */
const noAuth: Record<string, string[]> = {};

const MAX_UPLOADS_AT_ONCE = 3;
const UPLOAD_READ_MS = 60_000; // a client that sends its file more slowly than this is cut off

/** Attachment bytes accepted per hour: for all guest reports together, and for each signed-in user. Tests pass smaller ones. */
export type UploadBudgets = { guests: number; user: number };
export const UPLOAD_BUDGETS: UploadBudgets = { guests: 500 * MB, user: 200 * MB };

const KINDS = {
  screenshot: { types: ["bug", "annoyed", "idea"], contentTypes: ["image/jpeg", "image/png"], maxBytes: 3 * MB },
  recording: { types: ["bug"], contentTypes: ["video/mp4", "video/webm"], maxBytes: 25 * MB },
} as const;

/**
 * Reads an upload's body: at most `maxBytes`, and within UPLOAD_READ_MS, so a slow sender cannot hold one of the few upload slots.
 * (Hono's bodyLimit would buffer a chunked body before the handler runs, with no time limit, so uploads are read here instead.)
 */
async function readUpload(req: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > maxBytes) throw new ApiError(413, "payload_too_large");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    reader.cancel().catch(() => {}); // ends the pending read
  }, UPLOAD_READ_MS);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
  }
  if (timedOut) throw new ApiError(408, "upload_timeout");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

const tooLarge = (c: { json: (body: { error: "payload_too_large" }, status: 413) => Response }) => c.json({ error: "payload_too_large" }, 413);

export function feedbackRoutes(deps: Deps, budgets: UploadBudgets = UPLOAD_BUDGETS) {
  const app = newRouter();
  const { db } = deps;
  const perUser = createRateLimiter(10, HOUR_MS, deps.now);
  const guests = createRateLimiter(120, HOUR_MS, deps.now);
  const guestBytes = createRateLimiter(budgets.guests, HOUR_MS, deps.now);
  const userBytes = createRateLimiter(budgets.user, HOUR_MS, deps.now);
  let uploading = 0;

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
    // A file is held in memory while it is stored, so only a few are handled at a time.
    app.use(`/v1/feedback/:id/${kind}`, async (c, next) => {
      if (uploading >= MAX_UPLOADS_AT_ONCE) return c.json({ error: "busy" as const }, 503, { "retry-after": "5" });
      uploading += 1;
      try {
        await next();
      } finally {
        uploading -= 1;
      }
    });
    app.openapi(
      createRoute({
        method: "put",
        path: `/v1/feedback/{id}/${kind}`,
        tags: ["feedback"],
        summary: `Attach a ${kind} to a report`,
        description: `For reports of type ${rule.types.join(", ")}; ${rule.contentTypes.join(" or ")}, at most ${rule.maxBytes / MB} MB, and the first bytes must match the declared type; one per report, within 15 minutes of sending it. Hourly budget: ${UPLOAD_BUDGETS.user / MB} MB per signed-in user, ${UPLOAD_BUDGETS.guests / MB} MB for all guests' reports together; refused uploads cost nothing. At most ${MAX_UPLOADS_AT_ONCE} uploads are handled at once, and the file must arrive within ${UPLOAD_READ_MS / 1000} seconds.`,
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
          415: errorResponse("Wrong media type, or the file does not start like the declared type."),
          408: errorResponse("upload_timeout: the file took longer than the time allowed to arrive."),
          429: errorResponse(`rate_limited: the hourly upload budget is used up (${UPLOAD_BUDGETS.user / MB} MB per signed-in user; ${UPLOAD_BUDGETS.guests / MB} MB for all guests together).`),
          503: errorResponse("busy: too many uploads at once; retry after the Retry-After seconds."),
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const [report] = await db
          .select({ type: feedback.type, userId: feedback.userId, hash: feedback.uploadTokenHash, expiresAt: feedback.uploadExpiresAt })
          .from(feedback)
          .where(eq(feedback.id, id));
        if (!report) throw new ApiError(404, "not_found");
        const token = c.req.header("x-upload-token") ?? "";
        if (!constantTimeEqual(sha256Hex(token), report.hash) || report.expiresAt <= deps.now()) throw new ApiError(403, "forbidden");
        if (!(rule.types as readonly string[]).includes(report.type)) throw new ApiError(400, "invalid_request");
        const contentType = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
        if (!(rule.contentTypes as readonly string[]).includes(contentType)) throw new ApiError(415, "unsupported_media_type");
        // The budget is only spent once the file is stored: a refused upload costs nothing.
        const budget = report.userId ? userBytes : guestBytes;
        const budgetKey = report.userId ?? "guests";
        if (!budget.fits(budgetKey, Number(c.req.header("content-length")) || 1)) throw new ApiError(429, "rate_limited");
        const bytes = await readUpload(c.req.raw, rule.maxBytes);
        if (bytes.length === 0) throw new ApiError(400, "invalid_request");
        if (!matchesMediaType(contentType, bytes)) throw new ApiError(415, "unsupported_media_type");
        if (!budget.fits(budgetKey, bytes.length)) throw new ApiError(429, "rate_limited");
        const stored = await db
          .insert(feedbackAttachments)
          .values({ feedbackId: id, kind, contentType, bytes, size: bytes.length, createdAt: deps.now() })
          .onConflictDoNothing()
          .returning({ id: feedbackAttachments.id });
        if (stored.length === 0) throw new ApiError(409, "already_uploaded");
        budget.spend(budgetKey, bytes.length);
        return c.body(null, 204);
      },
    );
  }

  return app;
}
