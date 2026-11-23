import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_SECRET: "a".repeat(32),
  APPLE_BUNDLE_IDS: "com.yebeyt.app, com.yebeyt.app.clip",
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_KEY_ID: "KEY1234567",
  APPLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  GOOGLE_CLIENT_IDS: "one.apps.googleusercontent.com",
  ADMIN_TOKEN: "t".repeat(24),
  PORT: "9000",
};

describe("loadConfig", () => {
  it("reads a complete environment", () => {
    const c = loadConfig(valid);
    expect(c.port).toBe(9000);
    expect(c.appleBundleIds).toEqual(["com.yebeyt.app", "com.yebeyt.app.clip"]);
    expect(c.googleClientIds).toEqual(["one.apps.googleusercontent.com"]);
    expect(c.applePrivateKey).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
  });

  it("defaults the port to 8080", () => {
    const { PORT: _, ...rest } = valid;
    expect(loadConfig(rest).port).toBe(8080);
  });

  it("names every missing or bad variable and never prints values", () => {
    const env = { ...valid, JWT_SECRET: "short-secret-value", ADMIN_TOKEN: undefined, APPLE_BUNDLE_IDS: " , " };
    let error: unknown;
    try {
      loadConfig(env);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as ConfigError).message;
    expect(message).toContain("JWT_SECRET");
    expect(message).toContain("ADMIN_TOKEN");
    expect(message).toContain("APPLE_BUNDLE_IDS");
    expect(message).not.toContain("short-secret-value");
  });

  it("rejects a bad port and a bad database url", () => {
    expect(() => loadConfig({ ...valid, PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });
});
