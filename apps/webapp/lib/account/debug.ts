import type { ProviderSignIn } from "./accountModel";

/**
 * What a debug sign-in is made as (see `debugAnswer` in `lib/api/stub.ts`). `providerName` is the name the provider shares (it only fills the name field);
 * `displayName` is one the account already has; `email` is niloofar@example.com unless given (null: an account with none).
 */
export type DebugAccount = { id?: string; username?: string | null; displayName?: string | null; providerName?: string; provider?: "apple" | "google"; syncFails?: boolean; email?: string | null };

/** base64url of the spec as UTF-8 (a name may be Persian). */
const encode = (spec: DebugAccount): string => `debug-${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(spec)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

/** The fake provider credential of the debug sign-in: the phone's `-beytSignedIn 1`, but through the real sign-in (the cookies, the carry-over, the gate's waiting action). */
export function debugCredential(spec: DebugAccount, redirectUri: string): ProviderSignIn {
  const name = spec.providerName;
  return spec.provider === "google"
    ? { credential: { provider: "google", idToken: encode(spec) }, name }
    : { credential: { provider: "apple", identityToken: encode(spec), nonce: "debug", redirectUri }, name };
}
