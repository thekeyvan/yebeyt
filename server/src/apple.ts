import { importPKCS8, SignJWT } from "jose";

/**
 * Sign in with Apple REST API: exchange the one-time authorization code for a refresh token at
 * sign-in, and revoke it when the account is deleted (App Store requirement).
 * Needs a "Sign in with Apple" key from the Apple Developer account:
 * APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (the .p8 contents; "\n" may be escaped).
 * Without them, sign-in still works; revocation is skipped.
 */
const teamId = () => process.env.APPLE_TEAM_ID;
const keyId = () => process.env.APPLE_KEY_ID;
const privateKey = () => process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientId = () => (process.env.APPLE_BUNDLE_IDS ?? "").split(",")[0]?.trim();

export const appleRestConfigured = () => Boolean(teamId() && keyId() && privateKey() && clientId());

async function clientSecret(): Promise<string> {
  const key = await importPKCS8(privateKey()!, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId()! })
    .setIssuer(teamId()!)
    .setIssuedAt()
    .setExpirationTime("10m")
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId()!)
    .sign(key);
}

async function post(path: string, form: Record<string, string>): Promise<Response> {
  return fetch(`https://appleid.apple.com/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
}

/** Returns a refresh token for later revocation, or null if not configured / failed. */
export async function exchangeAppleCode(code: string): Promise<string | null> {
  if (!appleRestConfigured() || !code) return null;
  try {
    const r = await post("token", { client_id: clientId()!, client_secret: await clientSecret(), code, grant_type: "authorization_code" });
    if (!r.ok) {
      console.warn("apple token exchange failed:", r.status, await r.text());
      return null;
    }
    const j = (await r.json()) as { refresh_token?: string };
    return j.refresh_token ?? null;
  } catch (e) {
    console.warn("apple token exchange error:", (e as Error).message);
    return null;
  }
}

export async function revokeAppleToken(refreshToken: string): Promise<void> {
  if (!appleRestConfigured()) return;
  try {
    const r = await post("revoke", { client_id: clientId()!, client_secret: await clientSecret(), token: refreshToken, token_type_hint: "refresh_token" });
    if (!r.ok) console.warn("apple revoke failed:", r.status, await r.text());
  } catch (e) {
    console.warn("apple revoke error:", (e as Error).message);
  }
}
