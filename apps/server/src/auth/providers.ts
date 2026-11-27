import { jwtVerify } from "jose";
import { sha256Hex } from "../crypto.js";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";

/** `email` is set only when the provider says it is verified (Apple's private relay address included): lower-cased and trimmed. `emailLinkable` says whether it may join accounts: always for Apple; for Google only when the address is @gmail.com or the token has an `hd` claim (a Workspace domain), the only cases where Google is the authority for the address (its own guidance). */
export type VerifiedIdentity = { subject: string; audience: string; email: string | null; emailLinkable: boolean };

const APPLE_ISSUER = "https://appleid.apple.com";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

async function verify(
  token: string,
  deps: Pick<Deps, "now">,
  keys: Deps["appleKeys"],
  issuer: string | string[],
  allowedAudiences: string[],
): Promise<{ payload: Awaited<ReturnType<typeof jwtVerify>>["payload"]; identity: Pick<VerifiedIdentity, "subject" | "audience"> }> {
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

/** Apple sends these claims as booleans or as the strings "true"/"false"; Google sends booleans. */
const isTrue = (claim: unknown): boolean => claim === true || claim === "true";

const cleanEmail = (claim: unknown): string | null => {
  if (typeof claim !== "string") return null;
  const email = claim.trim().toLowerCase();
  return email.length > 0 && email.length <= 320 ? email : null;
};

/** Apple puts sha256(nonce) in the token's `nonce` claim; the app sends the raw nonce and we always compare. */
export async function verifyAppleIdentityToken(
  token: string,
  nonce: string,
  deps: Pick<Deps, "now" | "appleKeys" | "config">,
): Promise<VerifiedIdentity> {
  const { payload, identity } = await verify(token, deps, deps.appleKeys, APPLE_ISSUER, deps.config.appleBundleIds);
  if (payload.nonce !== sha256Hex(nonce)) throw new ApiError(401, "invalid_token");
  const email = isTrue(payload.email_verified) ? cleanEmail(payload.email) : null;
  return { ...identity, email, emailLinkable: email !== null };
}

export async function verifyGoogleIdToken(
  token: string,
  deps: Pick<Deps, "now" | "googleKeys" | "config">,
): Promise<VerifiedIdentity> {
  const { payload, identity } = await verify(token, deps, deps.googleKeys, GOOGLE_ISSUERS, deps.config.googleClientIds);
  const email = payload.email_verified === true ? cleanEmail(payload.email) : null;
  const workspace = typeof payload.hd === "string" && payload.hd !== "";
  return { ...identity, email, emailLinkable: email !== null && (workspace || email.endsWith("@gmail.com")) };
}
