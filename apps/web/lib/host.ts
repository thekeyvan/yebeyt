const APEX = "yebeyt.com";

/** The address to send a visitor of www.yebeyt.com to (the same path and query on the apex), or null for any other host. */
export function wwwRedirect(host: string | null, path: string): string | null {
  return host?.toLowerCase().split(":")[0] === `www.${APEX}` ? `https://${APEX}${path}` : null;
}
