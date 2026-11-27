import { devPagesEnabled } from "../dev";
import { apiUrl } from "./config";
import type { Upstream } from "./bff";
import { debugAnswer, playStubAnswer } from "./stub";

/** How long the server may take before the web app gives up. */
const timeoutMs = 10_000;

/** Asks the server at `API_URL`. The debug sign-in and its sessions (only in a build with the debug pages) are answered by the stub instead (`lib/api/stub.ts`). */
export const upstream: Upstream = async ({ method, path, credential, body, headers }) => {
  const debug = devPagesEnabled() ? (debugAnswer({ method, path, credential, body }) ?? playStubAnswer({ method, path, credential, body, headers })) : undefined;
  if (debug) return debug;
  const sent = new Headers(headers);
  // The refresh and logout calls carry the refresh token in their body; every other call with a credential is the session's access token.
  if (credential && !path.startsWith("/v1/auth/")) sent.set("authorization", `Bearer ${credential}`);
  if (body !== undefined) sent.set("content-type", "application/json");
  return fetch(`${apiUrl()}${path}`, { method, headers: sent, body, signal: AbortSignal.timeout(timeoutMs), cache: "no-store", redirect: "manual" });
};
