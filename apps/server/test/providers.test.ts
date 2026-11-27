import { beforeAll, describe, expect, it } from "vitest";
import { verifyAppleIdentityToken, verifyGoogleIdToken } from "../src/auth/providers.js";
import type { Config } from "../src/config.js";
import { BUNDLE_ID, GOOGLE_CLIENT, makeIssuer, nonceHash, testConfig } from "./helpers.js";

const now = new Date("2026-06-01T12:00:00Z");
const sec = Math.floor(now.getTime() / 1000);
const APPLE = "https://appleid.apple.com";

let config: Config;
let apple: Awaited<ReturnType<typeof makeIssuer>>;
let google: Awaited<ReturnType<typeof makeIssuer>>;
let other: Awaited<ReturnType<typeof makeIssuer>>;

beforeAll(async () => {
  config = await testConfig();
  apple = await makeIssuer("a");
  google = await makeIssuer("g");
  other = await makeIssuer("a"); // same kid, different key: a forged token
});

const appleDeps = () => ({ now: () => now, appleKeys: apple.keys, config });
const googleDeps = () => ({ now: () => now, googleKeys: google.keys, config });
const signApple = (claims = {}, o: Partial<{ iss: string; aud: string; exp: number }> = {}) =>
  apple.sign({ sub: "001.abc", nonce: nonceHash("n"), ...claims }, { iss: APPLE, aud: BUNDLE_ID, iat: sec, exp: sec + 600, ...o });
const signGoogle = (o: Partial<{ iss: string; aud: string; exp: number }> = {}, claims = {}) =>
  google.sign({ sub: "1234567890", ...claims }, { iss: "https://accounts.google.com", aud: GOOGLE_CLIENT, iat: sec, exp: sec + 600, ...o });

describe("Apple identity token", () => {
  it("accepts a good token", async () => {
    expect(await verifyAppleIdentityToken(await signApple({ nonce: nonceHash("n") }), "n", appleDeps())).toEqual({
      subject: "001.abc",
      audience: BUNDLE_ID,
      email: null,
    });
  });

  it("rejects a wrong audience, wrong issuer, expired and forged token", async () => {
    const bad = [
      await signApple({}, { aud: "com.someone.else" }),
      await signApple({}, { iss: "https://evil.example" }),
      await signApple({}, { exp: sec - 60 }),
      await other.sign({ sub: "x" }, { iss: APPLE, aud: BUNDLE_ID, iat: sec, exp: sec + 600 }),
      "not-a-jwt",
    ];
    for (const token of bad) {
      await expect(verifyAppleIdentityToken(token, "n", appleDeps())).rejects.toMatchObject({ code: "invalid_token", status: 401 });
    }
  });

  it("always checks the nonce: the token must carry sha256 of the raw nonce", async () => {
    const token = await signApple({ nonce: nonceHash("raw-nonce") });
    await expect(verifyAppleIdentityToken(token, "raw-nonce", appleDeps())).resolves.toBeTruthy();
    await expect(verifyAppleIdentityToken(token, "other-nonce", appleDeps())).rejects.toMatchObject({ code: "invalid_token" });
    await expect(verifyAppleIdentityToken(await signApple(), "raw-nonce", appleDeps())).rejects.toMatchObject({ code: "invalid_token" });
    await expect(verifyAppleIdentityToken(token, "", appleDeps())).rejects.toMatchObject({ code: "invalid_token" });
  });
});

describe("Google id token", () => {
  it("accepts both issuer spellings", async () => {
    for (const iss of ["https://accounts.google.com", "accounts.google.com"]) {
      expect(await verifyGoogleIdToken(await signGoogle({ iss }), googleDeps())).toEqual({
        subject: "1234567890",
        audience: GOOGLE_CLIENT,
        email: null,
      });
    }
  });

  it("rejects a wrong audience, wrong issuer and expired token", async () => {
    for (const token of [
      await signGoogle({ aud: "someone-else.apps.googleusercontent.com" }),
      await signGoogle({ iss: "https://evil.example" }),
      await signGoogle({ exp: sec - 60 }),
    ]) {
      await expect(verifyGoogleIdToken(token, googleDeps())).rejects.toMatchObject({ code: "invalid_token", status: 401 });
    }
  });
});

describe("the verified email claim", () => {
  const appleEmail = async (claims: object) => (await verifyAppleIdentityToken(await signApple(claims), "n", appleDeps())).email;
  const googleEmail = async (claims: object) => (await verifyGoogleIdToken(await signGoogle({}, claims), googleDeps())).email;

  it("Google: only when email_verified is true; lower-cased and trimmed", async () => {
    expect(await googleEmail({ email: "  Ali@Example.COM ", email_verified: true })).toBe("ali@example.com");
    expect(await googleEmail({ email: "ali@example.com", email_verified: false })).toBeNull();
    expect(await googleEmail({ email: "ali@example.com", email_verified: "true" })).toBeNull();
    expect(await googleEmail({ email: "ali@example.com" })).toBeNull();
    expect(await googleEmail({ email_verified: true })).toBeNull();
    expect(await googleEmail({ email: "   ", email_verified: true })).toBeNull();
    expect(await googleEmail({ email: 42, email_verified: true })).toBeNull();
  });

  it("Apple: verified as a boolean or the string \"true\"; the private relay address counts", async () => {
    expect(await appleEmail({ email: "Ali@Example.com", email_verified: true })).toBe("ali@example.com");
    expect(await appleEmail({ email: "ali@example.com", email_verified: "true" })).toBe("ali@example.com");
    expect(await appleEmail({ email: "ali@example.com", email_verified: "true", is_private_email: "false" })).toBe("ali@example.com");
    expect(await appleEmail({ email: "ali@example.com", email_verified: true, is_private_email: false })).toBe("ali@example.com");
    expect(await appleEmail({ email: "X@privaterelay.appleid.com", email_verified: "true", is_private_email: "true" })).toBe("x@privaterelay.appleid.com");
    expect(await appleEmail({ email: "x@privaterelay.appleid.com", email_verified: true, is_private_email: true })).toBe("x@privaterelay.appleid.com");
    expect(await appleEmail({ email: "ali@example.com", email_verified: "false" })).toBeNull();
    expect(await appleEmail({ email: "ali@example.com" })).toBeNull();
  });
});
