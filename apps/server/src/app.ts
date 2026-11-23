import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";
import type { Deps } from "./deps.js";
import { ApiError } from "./errors.js";
import { requireUser } from "./middleware.js";
import { newRouter } from "./router.js";
import { authRoutes } from "./routes/auth.js";
import { divanRoutes } from "./routes/divan.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { feedbackAdminRoutes } from "./routes/feedbackAdmin.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { pictureRoutes } from "./routes/pictures.js";
import { privacyRoutes } from "./routes/privacy.js";
import { progressRoutes } from "./routes/progress.js";
import { usernameRoutes } from "./routes/usernames.js";

export function createApp(deps: Deps) {
  const app = newRouter();

  // One line per request: method, route pattern, status, milliseconds. Nothing else is logged.
  app.use("*", async (c, next) => {
    const start = performance.now();
    await next();
    deps.log(`${c.req.method} ${routePath(c)} ${c.res.status} ${Math.round(performance.now() - start)}ms`);
  });

  // Every JSON body is tiny. Only the admin picture upload (limited in routes/pictures.ts), the divan sync (routes/divan.ts)
  // and the feedback attachments (routes/feedback.ts) may be larger.
  const smallBodies = bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "payload_too_large" as const }, 413) });
  const hasOwnLimit = (path: string) =>
    path.startsWith("/v1/admin/") || path === "/v1/me/divan" || /^\/v1\/feedback\/[^/]+\/(screenshot|recording)$/.test(path);
  app.use("*", (c, next) => (hasOwnLimit(c.req.path) ? next() : smallBodies(c, next)));

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.code, ...err.extra }, err.status);
    if (err instanceof HTTPException && err.status === 400) return c.json({ error: "invalid_request" as const }, 400);
    // Drizzle's messages carry the SQL parameters, so log only the kind of error.
    deps.log(`unhandled error ${err.name}`);
    return c.json({ error: "internal_error" as const }, 500);
  });
  app.notFound((c) => c.json({ error: "not_found" as const }, 404));

  const user = requireUser(deps);
  app.use("/v1/me", user);
  app.use("/v1/me/*", user);
  app.use("/v1/usernames/*", user);

  app.route("/", healthRoutes(deps));
  app.route("/", authRoutes(deps));
  app.route("/", meRoutes(deps));
  app.route("/", progressRoutes(deps));
  app.route("/", divanRoutes(deps));
  app.route("/", privacyRoutes(deps));
  app.route("/", usernameRoutes(deps));
  app.route("/", pictureRoutes(deps));
  app.route("/", feedbackRoutes(deps));
  app.route("/", feedbackAdminRoutes(deps));

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", { type: "http", scheme: "bearer", bearerFormat: "JWT" });
  app.openAPIRegistry.registerComponent("securitySchemes", "adminAuth", { type: "http", scheme: "bearer" });
  return app;
}
