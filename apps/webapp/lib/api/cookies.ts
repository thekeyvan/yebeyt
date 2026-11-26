/** The session lives in two cookies the page's scripts cannot read: the access token (15 minutes on the server) and the refresh token (60 days). */
export const accessName = "yb_access";
export const refreshName = "yb_refresh";

const accessMaxAge = 14 * 60;
const refreshMaxAge = 60 * 24 * 60 * 60;

export type Tokens = { accessToken: string; refreshToken: string };

/** What a token looks like (a JWT, an opaque string): anything else in a cookie is no token, so it can never reach a header. */
const token = /^[A-Za-z0-9._~-]{1,4096}$/;

function parse(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0) cookies.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return cookies;
}

/** The tokens the browser sent back; a missing or odd one is undefined. */
export function readSession(request: Request): { access?: string; refresh?: string } {
  const cookies = parse(request.headers.get("cookie"));
  const valid = (name: string) => {
    const value = cookies.get(name);
    return value !== undefined && token.test(value) ? value : undefined;
  };
  return { access: valid(accessName), refresh: valid(refreshName) };
}

/** Whether the page was reached over https (Railway's proxy says so): only then the cookies are `Secure`, so that a plain-http test on localhost keeps them. */
export const isSecure = (request: Request): boolean => request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";

const line = (name: string, value: string, maxAge: number, secure: boolean): string => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

/** The `Set-Cookie` lines that keep a session. */
export const writeSession = ({ accessToken, refreshToken }: Tokens, secure: boolean): string[] => [line(accessName, accessToken, accessMaxAge, secure), line(refreshName, refreshToken, refreshMaxAge, secure)];

/** The lines that end it. */
export const clearSession = (secure: boolean): string[] => [line(accessName, "", 0, secure), line(refreshName, "", 0, secure)];
