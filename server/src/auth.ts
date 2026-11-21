import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export interface Identity {
  provider: "apple" | "google";
  subject: string;
  email?: string;
  name?: string;
}

/** Verifies an identity token from Sign in with Apple (audience = the app's bundle id). */
export async function verifyApple(identityToken: string): Promise<Identity> {
  const audience = list(process.env.APPLE_BUNDLE_IDS);
  if (!audience.length) throw new Error("APPLE_BUNDLE_IDS is not set");
  const { payload } = await jwtVerify(identityToken, appleKeys, { issuer: "https://appleid.apple.com", audience });
  if (!payload.sub) throw new Error("no subject");
  // Apple verifies every address it shares (including "Hide My Email" relay addresses).
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return { provider: "apple", subject: payload.sub, email: typeof payload.email === "string" && verified ? payload.email : undefined };
}

/** Verifies an ID token from Google Sign-In (audience = the iOS OAuth client id). */
export async function verifyGoogle(idToken: string): Promise<Identity> {
  const audience = list(process.env.GOOGLE_CLIENT_IDS);
  if (!audience.length) throw new Error("GOOGLE_CLIENT_IDS is not set");
  const { payload } = await jwtVerify(idToken, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience });
  if (!payload.sub) throw new Error("no subject");
  return {
    provider: "google",
    subject: payload.sub,
    email: typeof payload.email === "string" && payload.email_verified !== false ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
};

/** Our own session token for the app (long-lived; the app keeps it in the Keychain). */
export async function issueSession(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setIssuer("beyt").setExpirationTime("180d").sign(secret());
}

export async function readSession(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret(), { issuer: "beyt" });
  if (!payload.sub) throw new Error("no subject");
  return payload.sub;
}
