import { and, eq, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket } from "ws";
import { verifyAccessToken } from "./auth/sessions.js";
import { conversations, users } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { showingOnline } from "./messaging.js";
import { notBlockedWith } from "./social.js";

export type LiveOptions = {
  /** How long a new socket may stay without sending its token. */
  authTimeoutMs?: number;
  /** The time between pings; a socket that has not answered the last ping by the next one is dropped. */
  heartbeatMs?: number;
};

/** Close codes the server sends: the first message was not a good token, or the user has no username yet. */
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_USERNAME_REQUIRED = 4403;

/** Tells the people who share a chat with the user (and may see it) that they went online or offline. */
async function announcePresence(deps: Deps, userId: string, online: boolean) {
  const { db } = deps;
  if (!(await showingOnline(db, [userId])).has(userId)) return;
  const [me] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
  const otherId = sql<string>`case when ${conversations.userLow} = ${userId} then ${conversations.userHigh} else ${conversations.userLow} end`;
  const watchers = await db
    .select({ id: otherId })
    .from(conversations)
    .where(and(or(eq(conversations.userLow, userId), eq(conversations.userHigh, userId)), notBlockedWith(userId, otherId)));
  for (const { id } of watchers) deps.hub.publish(id, { type: "presence", username: me!.username, online });
}

/**
 * `GET /v1/live`, a WebSocket. The first message must be `{ "type": "auth", "token": <access token> }` within the timeout.
 * After `{ "type": "ready" }` the server sends events (see the README) and pings every `heartbeatMs`. Plain Hono routes,
 * not in the OpenAPI document.
 */
export function liveRoutes(deps: Deps, upgradeWebSocket: UpgradeWebSocket<WebSocket>, options: LiveOptions = {}) {
  const { authTimeoutMs = 5000, heartbeatMs = 25_000 } = options;
  const app = new Hono();

  app.get(
    "/v1/live",
    upgradeWebSocket(() => {
      let timers: NodeJS.Timeout[] = [];
      let closed = false;
      let authenticating = false;
      let connection: ReturnType<typeof deps.hub.add> | undefined;
      let userId: string | undefined;

      return {
        onOpen(_event, ws) {
          const raw = ws.raw!;
          timers.push(
            setTimeout(() => {
              if (!userId) ws.close(CLOSE_UNAUTHORIZED, "auth timeout");
            }, authTimeoutMs),
          );
          let alive = true;
          raw.on("pong", () => (alive = true));
          timers.push(
            setInterval(() => {
              if (!alive) return raw.terminate();
              alive = false;
              raw.ping();
            }, heartbeatMs),
          );
        },
        async onMessage(event, ws) {
          if (userId || authenticating) return;
          authenticating = true;
          try {
            const message = JSON.parse(String(event.data)) as { type?: unknown; token?: unknown };
            if (message.type !== "auth" || typeof message.token !== "string") return ws.close(CLOSE_UNAUTHORIZED, "auth required");
            const id = await verifyAccessToken(deps, message.token);
            const [user] = await deps.db.select({ username: users.username }).from(users).where(eq(users.id, id));
            if (!user) return ws.close(CLOSE_UNAUTHORIZED, "unauthorized");
            if (!user.username) return ws.close(CLOSE_USERNAME_REQUIRED, "username required");
            if (closed) return;
            userId = id;
            connection = deps.hub.add(id, (e) => ws.send(JSON.stringify(e)));
            ws.send(JSON.stringify({ type: "ready" }));
            if (connection.first) await announcePresence(deps, id, true);
          } catch {
            ws.close(CLOSE_UNAUTHORIZED, "unauthorized");
          } finally {
            authenticating = false;
          }
        },
        async onClose() {
          closed = true;
          for (const t of timers) clearTimeout(t);
          timers = [];
          if (userId && connection?.remove()) await announcePresence(deps, userId, false).catch(() => deps.log("presence failed"));
        },
      };
    }),
  );
  return app;
}
