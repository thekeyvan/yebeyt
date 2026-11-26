/**
 * Whether a write came from this web app's own pages (a guard against cross-site requests, on top of the cookie's SameSite=Lax): the browser's
 * `Sec-Fetch-Site` says «same-origin», or, for a browser that does not send it, `Origin` is this host. No sign of either is a refusal.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
