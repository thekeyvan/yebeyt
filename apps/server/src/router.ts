import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "./deps.js";

/** A router whose validation failures answer `{ error: "invalid_request" }` (no details, nothing echoed back). */
export const newRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: "invalid_request" as const }, 400);
      return undefined;
    },
  });
