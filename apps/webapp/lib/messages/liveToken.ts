import { ApiError } from "../account/api";
import type { LiveToken } from "./liveConnection";

/** Asks the web app's own `/auth/live` for a token for the socket (the one place a token reaches the page, only to be sent as the socket's first message). `renew` says the server refused the last token, so the route refreshes the session. A 401 means signed out. */
export async function fetchLiveToken(renew = false, send: typeof fetch = (...args) => fetch(...args)): Promise<LiveToken> {
  let response: Response;
  try {
    response = await send(renew ? "/auth/live?renew=1" : "/auth/live", { method: "POST", credentials: "same-origin" });
  } catch {
    throw new ApiError(0);
  }
  const body = (await response.json().catch(() => undefined)) as Partial<LiveToken> | undefined;
  if (!response.ok) throw new ApiError(response.status);
  if (typeof body?.token !== "string" || typeof body.url !== "string") throw new ApiError(502);
  return { token: body.token, url: body.url };
}
