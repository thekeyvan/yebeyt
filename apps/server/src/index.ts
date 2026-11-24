import { createRemoteJWKSet } from "jose";
import { ConfigError, loadConfig } from "./config.js";
import { connectAndMigrate } from "./db/connect.js";
import type { Deps } from "./deps.js";
import { loadGameData } from "./gameData.js";
import { createDuels } from "./duel.js";
import { createHouse } from "./house.js";
import { createHub } from "./hub.js";
import { startServer } from "./server.js";

async function main() {
  const config = await loadConfig(process.env);
  const { db, close } = await connectAndMigrate(config.databaseUrl);
  const deps: Deps = {
    config,
    db,
    hub: createHub(),
    data: loadGameData(),
    now: () => new Date(),
    fetch,
    appleKeys: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    googleKeys: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    log: (line) => console.log(line),
    duels: undefined as never, // these need the rest of the deps, so they are made next
    house: undefined as never,
  };
  deps.duels = createDuels(deps);
  deps.house = createHouse(deps);
  const server = await startServer(deps, config.port);
  console.log(`yebeyt server listening on ${server.port}`);
  const stop = () => {
    void server.close().then(() => close()).then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e: unknown) => {
  console.error(e instanceof ConfigError ? e.message : `Could not start: ${e instanceof Error ? e.name : "unknown error"}`);
  process.exit(1);
});
