/** The server the web app's `/api` route asks (on Railway; app.yebeyt.com reaches the same one as api.yebeyt.com). */
export const defaultApiUrl = "https://server-production-98f46b7e.up.railway.app";

export const apiUrl = (): string => process.env.API_URL || defaultApiUrl;

/** The server's live socket: `https://api.yebeyt.com` → `wss://api.yebeyt.com/v1/live` (`http` → `ws`). */
export function liveUrl(api: string = apiUrl()): string {
  const url = new URL("/v1/live", api);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  return url.toString();
}
