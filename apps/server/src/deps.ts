import type { JWTVerifyGetKey } from "jose";
import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import type { Hub } from "./hub.js";

/** Everything the app needs from outside. Production wires the real ones; tests wire local ones. */
export type Deps = {
  config: Config;
  db: Db;
  now: () => Date;
  fetch: typeof fetch;
  /** The live connections of this process (see src/hub.ts). */
  hub: Hub;
  appleKeys: JWTVerifyGetKey;
  googleKeys: JWTVerifyGetKey;
  /** One line per call. Must never get tokens, emails, IPs or request bodies. */
  log: (line: string) => void;
};

export type AppEnv = { Variables: { userId: string } };
