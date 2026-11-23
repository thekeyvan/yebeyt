import { z } from "zod";

export class ConfigError extends Error {}

const list = z
  .string()
  .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean))
  .pipe(z.array(z.string()).min(1, "needs at least one value"));

const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  APPLE_BUNDLE_IDS: list,
  APPLE_TEAM_ID: z.string().min(1),
  APPLE_KEY_ID: z.string().min(1),
  APPLE_PRIVATE_KEY: z
    .string()
    .transform((s) => s.replace(/\\n/g, "\n"))
    .pipe(z.string().includes("PRIVATE KEY", "must be a PEM private key")),
  GOOGLE_CLIENT_IDS: list,
  ADMIN_TOKEN: z.string().min(16, "must be at least 16 characters"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
});

export type Config = {
  databaseUrl: string;
  jwtSecret: string;
  appleBundleIds: string[];
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  googleClientIds: string[];
  adminToken: string;
  port: number;
};

/** Reads and checks the environment. The error names the variables, never their values. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${String(i.path[0])}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n${lines.join("\n")}`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    appleBundleIds: e.APPLE_BUNDLE_IDS,
    appleTeamId: e.APPLE_TEAM_ID,
    appleKeyId: e.APPLE_KEY_ID,
    applePrivateKey: e.APPLE_PRIVATE_KEY,
    googleClientIds: e.GOOGLE_CLIENT_IDS,
    adminToken: e.ADMIN_TOKEN,
    port: e.PORT,
  };
}
