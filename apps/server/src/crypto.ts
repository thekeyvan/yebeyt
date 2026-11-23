import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

export const randomToken = (): string => randomBytes(32).toString("base64url");

/** Compares two secrets without leaking where they differ (hashing first makes the lengths equal). */
export function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

// The Apple refresh token is encrypted at rest with AES-256-GCM. The key is derived from JWT_SECRET
// with HKDF (a separate "info" label, so it is not the access-token key). Rotating JWT_SECRET makes
// stored Apple tokens unreadable: account deletion then skips the Apple revoke for those users.
const key = (secret: string): Buffer =>
  Buffer.from(hkdfSync("sha256", secret, "", "yebeyt apple refresh token v1", 32));

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Returns null when the value was not produced with this secret. */
export function decryptSecret(sealed: string, secret: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
