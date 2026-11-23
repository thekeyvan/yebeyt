import { serve } from "@hono/node-server";
import { createRemoteJWKSet } from "jose";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { connectAndMigrate } from "./db/connect.js";
import type { Deps } from "./deps.js";

async function main() {
  const config = await loadConfig(process.env);
  const { db, close } = await connectAndMigrate(config.databaseUrl);
  const deps: Deps = {
    config,
    db,
    now: () => new Date(),
    fetch,
    appleKeys: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    googleKeys: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    log: (line) => console.log(line),
  };
  const server = serve({ fetch: createApp(deps).fetch, port: config.port }, (info) => {
    console.log(`yebeyt server listening on ${info.port}`);
  });
  const stop = () => {
    server.close(() => void close().then(() => process.exit(0)));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e: unknown) => {
  console.error(e instanceof ConfigError ? e.message : `Could not start: ${e instanceof Error ? e.name : "unknown error"}`);
  process.exit(1);
});
