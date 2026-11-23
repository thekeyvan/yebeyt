import { jwtVerify } from "jose";
import { sha256Hex } from "../crypto.js";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";

export type VerifiedIdentity = { subject: string; audience: string };

const APPLE_ISSUER = "https://appleid.apple.com";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

async function verify(
  token: string,
  deps: Pick<Deps, "now">,
  keys: Deps["appleKeys"],
  issuer: string | string[],
  allowedAudiences: string[],
): Promise<{ payload: Awaited<ReturnType<typeof jwtVerify>>["payload"]; identity: VerifiedIdentity }> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: allowedAudiences,
      algorithms: ["RS256"],
      currentDate: deps.now(),
      requiredClaims: ["sub", "exp"],
    });
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const audience = audiences.find((a): a is string => typeof a === "string" && allowedAudiences.includes(a));
    if (!payload.sub || !audience) throw new Error("missing claims");
    return { payload, identity: { subject: payload.sub, audience } };
  } catch {
    throw new ApiError(401, "invalid_token");
  }
}

/** Apple puts sha256(nonce) in the token's `nonce` claim; the app sends the raw nonce and we always compare. */
export async function verifyAppleIdentityToken(
  token: string,
  nonce: string,
  deps: Pick<Deps, "now" | "appleKeys" | "config">,
): Promise<VerifiedIdentity> {
  const { payload, identity } = await verify(token, deps, deps.appleKeys, APPLE_ISSUER, deps.config.appleBundleIds);
  if (payload.nonce !== sha256Hex(nonce)) throw new ApiError(401, "invalid_token");
  return identity;
}

export async function verifyGoogleIdToken(
  token: string,
  deps: Pick<Deps, "now" | "googleKeys" | "config">,
): Promise<VerifiedIdentity> {
  return (await verify(token, deps, deps.googleKeys, GOOGLE_ISSUERS, deps.config.googleClientIds)).identity;
}
