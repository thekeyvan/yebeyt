import { exportJWK, exportPKCS8, generateKeyPair, createLocalJWKSet, SignJWT, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { createHash } from "node:crypto";
import { vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import type { Db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import type { Deps } from "../src/deps.js";

export const BUNDLE_ID = "com.yebeyt.app";
export const NONCE = "test-nonce";
export const GOOGLE_CLIENT = "web-client.apps.googleusercontent.com";

/** A signing key and the JWKS that publishes it, standing in for Apple's or Google's. */
export async function makeIssuer(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const keys: JWTVerifyGetKey = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid, alg: "RS256" }] });
  const sign = (claims: JWTPayload, opts: { iss: string; aud: string; exp: number; iat: number }) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(opts.iss)
      .setAudience(opts.aud)
      .setIssuedAt(opts.iat)
      .setExpirationTime(opts.exp)
      .sign(privateKey);
  return { keys, sign };
}

export async function testConfig(): Promise<Config> {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  return {
    databaseUrl: "postgres://unused",
    jwtSecret: "j".repeat(48),
    appleBundleIds: [BUNDLE_ID],
    appleTeamId: "TEAM123456",
    appleKeyId: "KEY1234567",
    applePrivateKey: await exportPKCS8(privateKey),
    googleClientIds: [GOOGLE_CLIENT],
    adminToken: "admin-token-for-tests",
    port: 0,
  };
}

export const nonceHash = (nonce: string) => createHash("sha256").update(nonce).digest("hex");

let sharedDb: Promise<Db> | undefined;
/** One in-process Postgres per test file, emptied between tests. */
export function testDb(): Promise<Db> {
  sharedDb ??= (async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    return db as unknown as Db;
  })();
  return sharedDb;
}

export async function resetDb(db: Db) {
  await db.execute(sql`truncate users, poet_pictures cascade`);
}

export type Harness = Awaited<ReturnType<typeof makeHarness>>;

export async function makeHarness() {
  const db = await testDb();
  await resetDb(db);
  const apple = await makeIssuer("apple-key");
  const google = await makeIssuer("google-key");
  const clock = { time: new Date("2026-06-01T12:00:00Z") };
  const logs: string[] = [];
  const fetchMock = vi.fn<typeof fetch>();
  const deps: Deps = {
    config: await testConfig(),
    db,
    now: () => clock.time,
    fetch: fetchMock,
    appleKeys: apple.keys,
    googleKeys: google.keys,
    log: (line) => logs.push(line),
  };
  const app = createApp(deps);

  const nowSec = () => Math.floor(clock.time.getTime() / 1000);
  const appleToken = (sub: string, extra: JWTPayload = {}, opts: Partial<{ iss: string; aud: string; exp: number }> = {}) =>
    apple.sign({ sub, nonce: nonceHash(NONCE), ...extra }, { iss: "https://appleid.apple.com", aud: BUNDLE_ID, iat: nowSec(), exp: nowSec() + 600, ...opts });
  const googleToken = (sub: string, opts: Partial<{ iss: string; aud: string; exp: number }> = {}) =>
    google.sign({ sub }, { iss: "https://accounts.google.com", aud: GOOGLE_CLIENT, iat: nowSec(), exp: nowSec() + 600, ...opts });

  const request = (path: string, init: RequestInit & { token?: string; json?: unknown } = {}) => {
    const { token, json, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (json !== undefined) {
      headers.set("content-type", "application/json");
      rest.body = JSON.stringify(json);
    }
    return app.request(path, { ...rest, headers });
  };

  /** Signs in with Google and returns the session. `sub` picks the user. */
  const signIn = async (sub = "google-user-1") => {
    const res = await request("/v1/auth/google", { method: "POST", json: { idToken: await googleToken(sub) } });
    if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
    return (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; username: string | null; usernameChangedAt: string | null; createdAt: string; providers: string[] };
    };
  };

  return { app, db, deps, clock, logs, fetchMock, appleToken, googleToken, request, signIn };
}
