import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { privacySettings } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { errorResponse } from "../errors.js";
import { announcePresence } from "../presence.js";
import { newRouter } from "../router.js";

const settingsSchema = z
  .object({
    keptVisibility: z.enum(["friends", "me"]),
    dailyVisibility: z.enum(["friends", "me"]),
    showOnline: z.boolean(),
    inGlobalLeaderboard: z.boolean(),
    messagesFrom: z.enum(["all", "friends"]),
    gameInvitesFrom: z.enum(["all", "friends"]),
    allowReposts: z.boolean(),
  })
  .openapi("PrivacySettings");
const patchSchema = settingsSchema.partial().strict().openapi("PrivacyPatch");

type Settings = z.infer<typeof settingsSchema>;

export const PRIVACY_DEFAULTS: Settings = {
  keptVisibility: "friends",
  dailyVisibility: "friends",
  showOnline: true,
  inGlobalLeaderboard: false,
  messagesFrom: "friends",
  gameInvitesFrom: "all",
  allowReposts: true,
};

const security = [{ bearerAuth: [] }];
const okResponse = {
  200: { description: "The settings.", content: { "application/json": { schema: settingsSchema } } },
  401: errorResponse("Not signed in."),
};

export function privacyRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;

  const load = async (userId: string): Promise<Settings> => {
    const [row] = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId));
    if (!row) return PRIVACY_DEFAULTS;
    const { userId: _id, ...settings } = row;
    return settings;
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/privacy",
      tags: ["me"],
      summary: "Who may see and reach me",
      description: "The stored settings, or the defaults when none were stored.",
      security,
      responses: okResponse,
    }),
    async (c) => c.json(await load(c.get("userId")), 200),
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/me/privacy",
      tags: ["me"],
      summary: "Change some privacy settings",
      description: "Only the fields sent change; the rest keep their value (or the default).",
      security,
      request: { body: { required: true, content: { "application/json": { schema: patchSchema } } } },
      responses: { ...okResponse, 400: errorResponse("Bad request.") },
    }),
    async (c) => {
      const userId = c.get("userId");
      const patch = c.req.valid("json");
      if (Object.keys(patch).length > 0) {
        await db
          .insert(privacySettings)
          .values({ ...PRIVACY_DEFAULTS, ...patch, userId })
          .onConflictDoUpdate({ target: privacySettings.userId, set: patch });
        // Turning «آنلاین» off while connected: the people who saw them online are told they went offline.
        if (patch.showOnline === false && deps.hub.isOnline(userId)) await announcePresence(deps, userId, false, true);
      }
      return c.json(await load(userId), 200);
    },
  );

  return app;
}
