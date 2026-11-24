import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";
import type { Deps } from "./deps.js";
import { liveRoutes, type LiveOptions } from "./live.js";

export type RunningServer = { port: number; close: () => Promise<void> };

/** Starts the HTTP server with the API and the live WebSocket (`/v1/live`). Port 0 picks a free port. */
export function startServer(deps: Deps, port: number, live?: LiveOptions): Promise<RunningServer> {
  const app = createApp(deps);
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });
  app.route("/", liveRoutes(deps, upgradeWebSocket, live));
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      resolve({
        port: info.port,
        close: () =>
          new Promise((done) => {
            for (const client of wss.clients) client.terminate();
            server.close(() => done());
            if ("closeAllConnections" in server) server.closeAllConnections();
          }),
      });
    });
    injectWebSocket(server);
  });
}
