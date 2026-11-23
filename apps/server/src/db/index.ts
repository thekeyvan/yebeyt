import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema.js";

/** Both the postgres-js database (production) and the PGlite one (tests) fit this type. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The Postgres error code 23505, however the driver or Drizzle wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  for (let e = error as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23505") return true;
  }
  return false;
}
