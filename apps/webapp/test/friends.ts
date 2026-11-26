import { createApi } from "../lib/account/api";

/** What the fake server answers: a status with a body (a 204 has none), or no network. */
export type Answer = { status: number; body?: unknown } | "offline";

export type Seen = { method: string; path: string; query: string; json?: Record<string, unknown> };

export const ok = (body: unknown): Answer => ({ status: 200, body });
export const none = (): Answer => ({ status: 204 });
export const refuse = (status: number, error: string): Answer => ({ status, body: { error } });

/** The client of the web app against a fake door: every call is noted, and `handler` says what it is answered (it may wait). */
export function fakeServer(handler: (request: Seen) => Answer | Promise<Answer>) {
  let answer = handler;
  const requests: Seen[] = [];
  const api = createApi(undefined, async (url, init) => {
    const { pathname, search } = new URL(String(url), "http://door");
    const request: Seen = { method: init?.method ?? "GET", path: pathname.replace(/^\/api/, ""), query: decodeURIComponent(search.slice(1)), ...(init?.body ? { json: JSON.parse(String(init.body)) } : {}) };
    requests.push(request);
    const reply = await answer(request);
    if (reply === "offline") throw new TypeError("offline");
    return reply.body === undefined ? new Response(null, { status: reply.status }) : Response.json(reply.body, { status: reply.status });
  });
  return {
    api,
    requests,
    /** The calls made to `path`. */
    to: (path: string) => requests.filter((request) => request.path === path),
    /** Changes what is answered from now on. */
    respond: (next: (request: Seen) => Answer | Promise<Answer>) => void (answer = next),
  };
}

/** A promise that is settled from outside: a server that waits until the test lets it answer. */
export function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

export const person = (username: string, displayName: string | null = null) => ({ username, displayName, avatar: null });
