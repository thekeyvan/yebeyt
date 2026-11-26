import { exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

let pem: string;
let valid: Record<string, string | undefined>;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  pem = await exportPKCS8(privateKey);
  valid = {
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    JWT_SECRET: "a".repeat(32),
    APPLE_BUNDLE_IDS: "com.yebeyt.app, com.yebeyt.app.clip",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY: pem.trim().replace(/\n/g, "\\n"),
    GOOGLE_CLIENT_IDS: "one.apps.googleusercontent.com",
    ADMIN_TOKEN: "t".repeat(24),
    PORT: "9000",
  };
});

describe("loadConfig", () => {
  it("reads a complete environment", async () => {
    const c = await loadConfig(valid);
    expect(c.port).toBe(9000);
    expect(c.appleBundleIds).toEqual(["com.yebeyt.app", "com.yebeyt.app.clip"]);
    expect(c.googleClientIds).toEqual(["one.apps.googleusercontent.com"]);
    expect(c.appleRedirectUris).toEqual([]);
    expect(c.applePrivateKey).toBe(pem.trim());
  });

  it("reads the web redirect uris of Apple, which are optional", async () => {
    const c = await loadConfig({ ...valid, APPLE_REDIRECT_URIS: "https://app.yebeyt.com/auth/apple, https://example.test/auth/apple" });
    expect(c.appleRedirectUris).toEqual(["https://app.yebeyt.com/auth/apple", "https://example.test/auth/apple"]);
  });

  it("defaults the port to 8080", async () => {
    const { PORT: _, ...rest } = valid;
    expect((await loadConfig(rest)).port).toBe(8080);
  });

  it("names every missing or bad variable and never prints values", async () => {
    const env = { ...valid, JWT_SECRET: "short-secret-value", ADMIN_TOKEN: undefined, APPLE_BUNDLE_IDS: " , " };
    const error = await loadConfig(env).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as ConfigError).message;
    expect(message).toContain("JWT_SECRET");
    expect(message).toContain("ADMIN_TOKEN");
    expect(message).toContain("APPLE_BUNDLE_IDS");
    expect(message).not.toContain("short-secret-value");
  });

  it("rejects a bad port and a bad database url", async () => {
    await expect(loadConfig({ ...valid, PORT: "abc" })).rejects.toThrow(/PORT/);
    await expect(loadConfig({ ...valid, DATABASE_URL: "mysql://x" })).rejects.toThrow(/DATABASE_URL/);
  });

  it("fails at start when the Apple key cannot be used", async () => {
    const rsa = await generateKeyPair("RS256", { extractable: true });
    const bad = [
      "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
      (await exportPKCS8(rsa.privateKey)).replace(/\n/g, "\\n"),
    ];
    for (const key of bad) {
      const error = await loadConfig({ ...valid, APPLE_PRIVATE_KEY: key }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain("APPLE_PRIVATE_KEY");
      expect((error as ConfigError).message).not.toContain("abc");
    }
  });
});
