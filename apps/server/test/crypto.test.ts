import { describe, expect, it } from "vitest";
import { constantTimeEqual, decryptSecret, encryptSecret, sha256Hex } from "../src/crypto.js";

describe("crypto", () => {
  it("encrypts and decrypts with the same secret only", () => {
    const secret = "s".repeat(32);
    const sealed = encryptSecret("refresh-token", secret);
    expect(sealed).not.toContain("refresh-token");
    expect(decryptSecret(sealed, secret)).toBe("refresh-token");
    expect(decryptSecret(sealed, "x".repeat(32))).toBeNull();
    expect(decryptSecret("garbage", secret)).toBeNull();
  });

  it("uses a fresh nonce every time", () => {
    const secret = "s".repeat(32);
    expect(encryptSecret("a", secret)).not.toBe(encryptSecret("a", secret));
  });

  it("compares secrets of any length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("hashes like sha256", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
