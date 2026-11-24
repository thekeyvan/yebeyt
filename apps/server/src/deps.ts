import type { JWTVerifyGetKey } from "jose";
import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import type { Duels } from "./duel.js";
import type { GameData } from "./gameData.js";
import type { House } from "./house.js";
import type { Hub } from "./hub.js";

/** Everything the app needs from outside. Production wires the real ones; tests wire local ones. */
export type Deps = {
  config: Config;
  db: Db;
  now: () => Date;
  fetch: typeof fetch;
  /** The live connections of this process (see src/hub.ts). */
  hub: Hub;
  /** The game deck and the poets and books it uses (see src/gameData.ts). */
  data: GameData;
  /** The live duels of this process (see src/duel.ts). */
  duels: Duels;
  /** The demo friend «یه بیت» (see src/house.ts). */
  house: House;
  appleKeys: JWTVerifyGetKey;
  googleKeys: JWTVerifyGetKey;
  /** One line per call. Must never get tokens, emails, IPs or request bodies. */
  log: (line: string) => void;
};

export type AppEnv = { Variables: { userId: string } };
