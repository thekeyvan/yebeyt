import { createRoute, z } from "@hono/zod-openapi";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { checkUsername, suggestUsernames } from "../usernames.js";

const security = [{ bearerAuth: [] }];
const limits = {
  401: errorResponse("Not signed in."),
  429: errorResponse("Too many requests (60 a minute per user)."),
};

const checkSchema = z
  .object({
    available: z.boolean(),
    reason: z.enum(["too_short", "too_long", "bad_chars", "reserved", "taken"]).optional(),
  })
  .openapi("UsernameCheck");

const suggestionsSchema = z.object({ suggestions: z.array(z.string()).max(5) }).openapi("UsernameSuggestions");

export function usernameRoutes(deps: Deps) {
  const app = newRouter();
  const limiter = createRateLimiter(60, 60_000, deps.now);
  const limit = (userId: string) => {
    if (!limiter.take(userId)) throw new ApiError(429, "rate_limited");
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/usernames/check",
      tags: ["usernames"],
      summary: "Is this username free and allowed?",
      description: "Case-insensitive. `reason` says why not: too_short, too_long, bad_chars, reserved, taken.",
      security,
      request: { query: z.object({ u: z.string().max(100) }) },
      responses: {
        200: { description: "Availability.", content: { "application/json": { schema: checkSchema } } },
        400: errorResponse("Bad request."),
        ...limits,
      },
    }),
    async (c) => {
      limit(c.get("userId"));
      return c.json(await checkUsername(deps.db, c.req.valid("query").u), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/usernames/suggestions",
      tags: ["usernames"],
      summary: "Up to 5 free usernames built from a latin base",
      security,
      request: { query: z.object({ base: z.string().max(100) }) },
      responses: {
        200: { description: "Suggestions (empty when nothing usable is left of the base).", content: { "application/json": { schema: suggestionsSchema } } },
        400: errorResponse("Bad request."),
        ...limits,
      },
    }),
    async (c) => {
      limit(c.get("userId"));
      return c.json({ suggestions: await suggestUsernames(deps.db, c.req.valid("query").base) }, 200);
    },
  );

  return app;
}
