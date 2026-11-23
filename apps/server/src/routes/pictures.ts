import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { sha256Hex } from "../crypto.js";
import { poetPictures } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { requireAdmin } from "../middleware.js";
import { newRouter } from "../router.js";

const MAX_BYTES = 15 * 1024 * 1024;
const CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const slugSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/).openapi({ example: "hafez" });
const binary = z.string().openapi({ format: "binary" });

const listSchema = z
  .array(
    z.object({
      slug: slugSchema,
      version: z.string().openapi({ description: "First 12 characters of the picture's sha256; changes when the picture does." }),
      url: z.string().openapi({ description: "Path on this server, to be resolved against its address.", example: "/v1/poets/hafez/picture?v=0a1b2c3d4e5f" }),
    }),
  )
  .openapi("PoetPictureList");

const version = (sha: string) => sha.slice(0, 12);
const etagOf = (sha: string) => `"${sha}"`;

function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((t) => t.trim() === "*" || t.trim().replace(/^W\//, "") === etag);
}

export function pictureRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/poets/pictures",
      tags: ["poets"],
      summary: "Which poets have a picture, and its version",
      responses: { 200: { description: "One entry per picture.", content: { "application/json": { schema: listSchema } } } },
    }),
    async (c) => {
      const rows = await db.select({ slug: poetPictures.slug, sha: poetPictures.sha256 }).from(poetPictures).orderBy(poetPictures.slug);
      return c.json(
        rows.map((r) => ({ slug: r.slug, version: version(r.sha), url: `/v1/poets/${r.slug}/picture?v=${version(r.sha)}` })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/poets/{slug}/picture",
      tags: ["poets"],
      summary: "A poet's picture",
      description: "Cached for a day; send If-None-Match with the ETag to get 304.",
      request: { params: z.object({ slug: slugSchema }) },
      responses: {
        200: { description: "The image.", content: { "image/jpeg": { schema: binary }, "image/png": { schema: binary }, "image/webp": { schema: binary } } },
        304: { description: "Unchanged." },
        404: errorResponse("No picture for this poet."),
      },
    }),
    async (c) => {
      const [row] = await db.select().from(poetPictures).where(eq(poetPictures.slug, c.req.valid("param").slug));
      if (!row) throw new ApiError(404, "not_found");
      const headers = { etag: etagOf(row.sha256), "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" };
      if (matchesEtag(c.req.header("if-none-match"), headers.etag)) return c.body(null, 304, headers) as never;
      return c.body(row.bytes as unknown as ArrayBuffer, 200, { ...headers, "content-type": row.contentType }) as never;
    },
  );

  app.use("/v1/admin/*", requireAdmin(deps));
  app.use(
    "/v1/admin/*",
    bodyLimit({ maxSize: MAX_BYTES, onError: (c) => c.json({ error: "payload_too_large" as const }, 413) }),
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/admin/poets/{slug}/picture",
      tags: ["admin"],
      summary: "Upload or replace a poet's picture",
      security: [{ adminAuth: [] }],
      request: {
        params: z.object({ slug: slugSchema }),
        query: z.object({
          width: z.coerce.number().int().min(1).max(4096),
          height: z.coerce.number().int().min(1).max(4096),
        }),
        body: { required: true, content: { "image/jpeg": { schema: binary }, "image/png": { schema: binary }, "image/webp": { schema: binary } } },
      },
      responses: {
        200: { description: "Stored.", content: { "application/json": { schema: z.object({ slug: slugSchema, version: z.string() }).openapi("PoetPictureStored") } } },
        400: errorResponse("Bad request."),
        401: errorResponse("Wrong or missing admin token."),
        413: errorResponse("Larger than 15 MB."),
        415: errorResponse("Not a JPEG, PNG or WebP."),
      },
    }),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { width, height } = c.req.valid("query");
      const contentType = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!CONTENT_TYPES.includes(contentType)) throw new ApiError(415, "unsupported_media_type");
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      if (bytes.length === 0) throw new ApiError(400, "invalid_request");
      const sha256 = sha256Hex(bytes);
      const values = { contentType, bytes, sha256, width, height, updatedAt: deps.now() };
      await db
        .insert(poetPictures)
        .values({ slug, ...values })
        .onConflictDoUpdate({ target: poetPictures.slug, set: values });
      return c.json({ slug, version: version(sha256) }, 200);
    },
  );

  return app;
}
