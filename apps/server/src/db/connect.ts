import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";
import type { Db } from "./index.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Opens the production database and applies every pending migration. */
export async function connectAndMigrate(url: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const migrationClient = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder });
  } finally {
    await migrationClient.end();
  }
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
