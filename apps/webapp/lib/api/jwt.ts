/** How many seconds an access token (a JWT) has left, by the `exp` in its payload; 0 for anything that is not one. Nothing is verified: the server does that. */
export function secondsLeft(token: string, now = Date.now()): number {
  const [, payload, signature] = token.split(".");
  if (!payload || !signature) return 0;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: unknown };
    return typeof exp === "number" ? Math.max(0, Math.floor(exp - now / 1000)) : 0;
  } catch {
    return 0;
  }
}
