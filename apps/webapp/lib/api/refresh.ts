import type { Tokens } from "./cookies";

export type Refreshed = { ok: true; tokens: Tokens } | { ok: false; refused: boolean };

/** How long a finished refresh is remembered: a request that went out with the old cookies just before the new ones were stored still gets the new pair. */
const graceMs = 30_000;

/**
 * Swaps a refresh token for a new pair, once per token. A refresh token works once on the server (using it again signs the whole account out), and a page
 * sends several requests at a time, so the requests that meet an expired access token together wait for the same refresh, and ones that
 * come a moment later with the old cookies get its result. `ask` returns the server's answer; `refused` says the token was turned down (401), against
 * a server that could not be reached.
 */
export function createRefresher(ask: (refreshToken: string) => Promise<Response>): (refreshToken: string) => Promise<Refreshed> {
  const known = new Map<string, Promise<Refreshed>>();

  const run = async (refreshToken: string): Promise<Refreshed> => {
    try {
      const response = await ask(refreshToken);
      if (response.status === 401) return { ok: false, refused: true };
      const body = (await response.json()) as Partial<Tokens>;
      if (!response.ok || typeof body.accessToken !== "string" || typeof body.refreshToken !== "string") return { ok: false, refused: false };
      return { ok: true, tokens: { accessToken: body.accessToken, refreshToken: body.refreshToken } };
    } catch {
      return { ok: false, refused: false };
    }
  };

  return (refreshToken) => {
    const earlier = known.get(refreshToken);
    if (earlier) return earlier;
    const started = run(refreshToken);
    known.set(refreshToken, started);
    void started.then((result) => {
      // A refresh that failed to reach the server can be tried again at once; the others are kept for a while.
      if (!result.ok && !result.refused) known.delete(refreshToken);
      else setTimeout(() => known.delete(refreshToken), graceMs).unref?.();
    });
    return started;
  };
}
