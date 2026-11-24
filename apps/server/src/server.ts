import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";
import type { Deps } from "./deps.js";
import { SWEEP_MS, sweepGames } from "./games.js";
import { liveRoutes, type LiveOptions } from "./live.js";

const MAX_FRAME_BYTES = 4096;

export type RunningServer = { port: number; close: () => Promise<void> };

/** Starts the HTTP server with the API and the live WebSocket (`/v1/live`). Port 0 picks a free port. */
export function startServer(deps: Deps, port: number, live?: LiveOptions): Promise<RunningServer> {
  const app = createApp(deps);
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });
  wss.options.maxPayload = MAX_FRAME_BYTES; // the client only sends its token; a bigger frame closes the socket with 1009
  app.route("/", liveRoutes(deps, upgradeWebSocket, live));
  const sweeper = setInterval(() => sweepGames(deps).catch(() => deps.log("game sweep failed")), SWEEP_MS);
  sweeper.unref();
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      resolve({
        port: info.port,
        close: () =>
          new Promise((done) => {
            clearInterval(sweeper);
            for (const client of wss.clients) client.terminate();
            server.close(() => done());
            if ("closeAllConnections" in server) server.closeAllConnections();
          }),
      });
    });
    injectWebSocket(server);
  });
}
