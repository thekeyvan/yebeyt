import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import { decodeJwt } from "jose";
import type { WebSocket } from "ws";
import { z } from "zod";
import { verifyAccessToken } from "./auth/sessions.js";
import { users } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { announcePresence } from "./presence.js";
import { createRateLimiter } from "./rateLimit.js";

export type LiveOptions = {
  /** How long a new socket may stay without sending its token. */
  authTimeoutMs?: number;
  /** The time between pings; a socket that has not answered the last ping by the next one is dropped. */
  heartbeatMs?: number;
};

/** What a signed-in socket may send: an answer in a رودررو duel (`option` is the index in the question's `options`). Anything else is ignored. */
const answerSchema = z.object({ type: z.literal("duel.answer"), gameId: z.uuid(), round: z.number().int().min(1).max(5), option: z.number().int().min(0).max(9) });
/** At most this many messages a second from one socket; the rest are dropped. */
const MESSAGES_PER_SECOND = 10;

/** Close codes the server sends: no good token (also when the token expires), the user has no username yet, or a newer socket replaced this one. */
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_USERNAME_REQUIRED = 4403;
export const CLOSE_REPLACED = 4409;

function parseJson(data: unknown): unknown {
  try {
    return JSON.parse(String(data));
  } catch {
    return undefined;
  }
}

/**
 * `GET /v1/live`, a WebSocket. The first message must be `{ "type": "auth", "token": <access token> }` within the timeout.
 * After `{ "type": "ready" }` the server sends events and takes duel answers (see the README) and pings every `heartbeatMs`; frames over 4 KB close the socket. Plain Hono routes,
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
      const limiter = createRateLimiter(MESSAGES_PER_SECOND, 1000, () => new Date());

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
          if (authenticating) return;
          if (userId) {
            if (!limiter.take("socket")) return;
            const answer = answerSchema.safeParse(parseJson(event.data));
            if (answer.success) deps.duels.answer(userId, answer.data);
            return;
          }
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
            // The socket lives as long as the token: when it expires the client reconnects with a fresh one.
            const expiresIn = decodeJwt(message.token).exp! * 1000 - deps.now().getTime();
            timers.push(setTimeout(() => ws.close(CLOSE_UNAUTHORIZED, "token expired"), expiresIn));
            connection = deps.hub.add(id, (e) => ws.send(JSON.stringify(e)), () => ws.close(CLOSE_REPLACED, "too many connections"));
            ws.send(JSON.stringify({ type: "ready" }));
            deps.duels.online(id).catch(() => deps.log("duel online failed"));
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
          if (userId && connection?.remove()) {
            await announcePresence(deps, userId, false).catch(() => deps.log("presence failed"));
            deps.duels.offline(userId).catch(() => deps.log("duel offline failed"));
          }
        },
      };
    }),
  );
  return app;
}
