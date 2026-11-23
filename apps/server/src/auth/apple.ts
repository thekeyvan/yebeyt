import { importPKCS8, SignJWT } from "jose";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";
import { decryptSecret, encryptSecret } from "../crypto.js";

const APPLE = "https://appleid.apple.com";
const APPLE_TIMEOUT_MS = 10_000;

type AppleDeps = Pick<Deps, "config" | "fetch" | "now" | "log">;

/** Apple wants a short-lived JWT signed with our .p8 key as the client secret. `clientId` is the bundle id. */
async function clientSecret(deps: AppleDeps, clientId: string): Promise<string> {
  const { config } = deps;
  const iat = Math.floor(deps.now().getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.appleKeyId })
    .setIssuer(config.appleTeamId)
    .setSubject(clientId)
    .setAudience(APPLE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 300)
    .sign(await importPKCS8(config.applePrivateKey, "ES256"));
}

const form = (fields: Record<string, string>) =>
  ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(APPLE_TIMEOUT_MS),
  }) satisfies RequestInit;

/**
 * Trades the sign-in authorization code for Apple's refresh token and returns it sealed for storage.
 * Failure is not fatal for signing in; it only means we cannot revoke the Apple token later.
 */
export async function exchangeAppleCode(deps: AppleDeps, code: string, clientId: string): Promise<string | null> {
  try {
    const res = await deps.fetch(
      `${APPLE}/auth/token`,
      form({ client_id: clientId, client_secret: await clientSecret(deps, clientId), code, grant_type: "authorization_code" }),
    );
    if (!res.ok) {
      deps.log(`apple code exchange failed status=${res.status}`);
      return null;
    }
    const body = (await res.json()) as { refresh_token?: unknown };
    if (typeof body.refresh_token !== "string") return null;
    return encryptSecret(JSON.stringify({ t: body.refresh_token, c: clientId }), deps.config.jwtSecret);
  } catch {
    deps.log("apple code exchange failed");
    return null;
  }
}

/**
 * Revokes the stored Apple refresh token (App Store rule for account deletion). Only a 2xx counts as
 * revoked, plus 400 `invalid_grant` (the token is already invalid, e.g. the user revoked the app in
 * their Apple settings, so there is nothing left to revoke). Anything else (an Apple error, a 5xx, a timeout, no network) throws `apple_revoke_failed`
 * so the account is kept and the user can try again. The log gets the status and Apple's `error`
 * code, never a token.
 */
export async function revokeAppleToken(deps: AppleDeps, sealed: string): Promise<void> {
  const opened = decryptSecret(sealed, deps.config.jwtSecret);
  if (opened === null) {
    deps.log("apple token unreadable, skipping revoke");
    return;
  }
  const { t, c } = JSON.parse(opened) as { t: string; c: string };
  let res: Response;
  try {
    res = await deps.fetch(
      `${APPLE}/auth/revoke`,
      form({ client_id: c, client_secret: await clientSecret(deps, c), token: t, token_type_hint: "refresh_token" }),
    );
  } catch {
    deps.log("apple revoke failed: no answer");
    throw new ApiError(502, "apple_revoke_failed");
  }
  if (res.ok) return;
  const code = await res.json().then((b) => (typeof (b as { error?: unknown })?.error === "string" ? (b as { error: string }).error : "unknown"), () => "unknown");
  if (res.status === 400 && code === "invalid_grant") return;
  deps.log(`apple revoke failed status=${res.status} error=${code.slice(0, 40)}`);
  throw new ApiError(502, "apple_revoke_failed");
}
