import { clearSession, isSecure, readSession, writeSession, type Tokens } from "./cookies";
import { isSameOrigin } from "./csrf";
import { secondsLeft } from "./jwt";
import { upstreamRoute } from "./proxy";
import { createRefresher } from "./refresh";

/** A call to the server: `credential` is the access token of a request that carries the session, or the refresh token of `/v1/auth/refresh` and `/v1/auth/logout`. */
export type Call = { method: string; path: string; credential?: string; body?: string; headers?: Record<string, string> };
export type Upstream = (call: Call) => Promise<Response>;

/** The most a body may be: the divan of 2000 couplets is a few hundred kilobytes. */
const maxBody = 1_000_000;

/** A token with less time left than this is not handed to a socket (the server closes the socket when its token expires): the session is refreshed first. */
const minLiveSeconds = 60;

/** What of the server's answer is passed on: the type and what lets the browser cache a picture and ask again. */
const passed = ["content-type", "etag", "cache-control"];

const secureAnswer = (body: unknown, status: number, cookies: string[] = []): Response => {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return body === null ? new Response(null, { status, headers }) : Response.json(body, { status, headers });
};

/** The codes of the server's own 502 that the page may be told: Apple could not be reached to revoke its token, so nothing was deleted and the person must try again. */
const badGatewayCodes: readonly string[] = ["apple_revoke_failed"];

const answerOf = async (upstream: Response, cookies: string[], session: boolean): Promise<Response> => {
  const { status } = upstream;
  // The server's 2xx, 304 and refusals (400s) go on as they are; anything else (an error, a redirect) is a bad gateway, with only a code from the short list above passed on.
  if (!((status >= 200 && status < 300) || status === 304 || (status >= 400 && status < 500))) {
    const code = status === 502 ? ((await upstream.json().catch(() => undefined)) as { error?: unknown } | undefined)?.error : undefined;
    return typeof code === "string" && badGatewayCodes.includes(code) ? secureAnswer({ error: code }, 502) : new Response(null, { status: 502 });
  }
  const headers = new Headers();
  for (const name of passed) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (session) headers.set("cache-control", "no-store");
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response([204, 304].includes(status) ? null : upstream.body, { status, headers });
};

type Run = { kind: "none" } | { kind: "signedOut" } | { kind: "offline" } | { kind: "answer"; response: Response; tokens?: Tokens };

/**
 * The web app's side of the session (the BFF): the tokens stay in httpOnly cookies, here, and go to the server as a Bearer header; the page only ever
 * sees what the server's answers hold, never a token. `send` is how the server is asked.
 */
export function createBff(send: Upstream) {
  const refresh = createRefresher((token) => send({ method: "POST", path: "/v1/auth/refresh", credential: token, body: JSON.stringify({ refreshToken: token }) }));

  /** Runs `ask` with the access token; when the server refuses it, once more after a refresh (`renewFirst`: after a refresh at once). */
  async function withSession(request: Request, ask: (access: string) => Promise<Response>, renewFirst = false): Promise<Run> {
    const { access, refresh: refreshToken } = readSession(request);
    if (!access && !refreshToken) return { kind: "none" };
    try {
      let tokens: Tokens | undefined;
      const renew = async (): Promise<"ok" | Run> => {
        const result = refreshToken ? await refresh(refreshToken) : undefined;
        if (!result) return { kind: "signedOut" };
        if (!result.ok) return { kind: result.refused ? "signedOut" : "offline" };
        tokens = result.tokens;
        return "ok";
      };
      let token = renewFirst ? undefined : access;
      if (token === undefined) {
        const renewed = await renew();
        if (renewed !== "ok") return renewed;
        token = tokens!.accessToken;
      }
      let response = await ask(token);
      if (response.status === 401 && tokens === undefined) {
        const renewed = await renew();
        if (renewed !== "ok") return renewed;
        response = await ask(tokens!.accessToken);
      }
      return { kind: "answer", response, tokens };
    } catch {
      return { kind: "offline" };
    }
  }

  const ended = (request: Request): string[] => clearSession(isSecure(request));

  /** The server's answer to a call with the session, as the page gets it. */
  async function finish(run: Run, request: Request): Promise<Response> {
    switch (run.kind) {
      case "none":
        return secureAnswer({ error: "unauthorized" }, 401);
      case "signedOut":
        return secureAnswer({ error: "unauthorized" }, 401, ended(request));
      case "offline":
        return new Response(null, { status: 502 });
      case "answer":
        return await answerOf(run.response, run.tokens ? writeSession(run.tokens, isSecure(request)) : [], true);
    }
  }

  /** The body of a write: JSON, and not more than `maxBody`; a write with no body (a reaction) has none to check. */
  async function body(request: Request): Promise<{ text?: string; refusal?: Response }> {
    if (request.method === "GET") return {};
    if (Number(request.headers.get("content-length") ?? 0) > maxBody) return { refusal: new Response(null, { status: 413 }) };
    const text = await readCapped(request);
    if (text === undefined) return { refusal: new Response(null, { status: 413 }) };
    if (text === "") return {};
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return { refusal: new Response(null, { status: 415 }) };
    return { text };
  }

  return {
    /** `/api/*`: the allowed paths (`lib/api/proxy.ts`), with the session when the path needs it. */
    async proxy(request: Request, segments: string[]): Promise<Response> {
      const route = upstreamRoute(request.method, segments, new URL(request.url).searchParams);
      if (!route) return new Response(null, { status: 404 });
      if (request.method !== "GET" && !isSameOrigin(request)) return new Response(null, { status: 403 });
      const { text, refusal } = await body(request);
      if (refusal) return refusal;
      const call = { method: request.method, path: route.path, ...(text === undefined ? {} : { body: text }) };
      if (!route.auth) {
        const match = request.headers.get("if-none-match");
        try {
          return await answerOf(await send({ ...call, ...(match ? { headers: { "if-none-match": match } } : {}) }), [], false);
        } catch {
          return new Response(null, { status: 502 });
        }
      }
      return await finish(await withSession(request, (access) => send({ ...call, credential: access })), request);
    },

    /** `/auth/apple` and `/auth/google`: the provider's token goes to the server, the session's tokens into the cookies, and the page gets the user. */
    async signIn(request: Request, provider: "apple" | "google"): Promise<Response> {
      if (!isSameOrigin(request)) return new Response(null, { status: 403 });
      const { text, refusal } = await body(request);
      if (refusal) return refusal;
      const fields = providerBody(provider, text);
      if (!fields) return secureAnswer({ error: "invalid_request" }, 400);
      let upstream: Response;
      try {
        upstream = await send({ method: "POST", path: `/v1/auth/${provider}`, body: JSON.stringify(fields) });
      } catch {
        return new Response(null, { status: 502 });
      }
      if (!upstream.ok) return await answerOf(upstream, [], true);
      const session = (await upstream.json().catch(() => undefined)) as (Tokens & { user?: unknown }) | undefined;
      if (!session || typeof session.accessToken !== "string" || typeof session.refreshToken !== "string" || typeof session.user !== "object") return new Response(null, { status: 502 });
      return secureAnswer({ user: session.user }, 200, writeSession(session, isSecure(request)));
    },

    /** `/auth/session`: who is signed in, from the cookies (the user from the server; «signed in» without one when it cannot be reached). */
    async session(request: Request): Promise<Response> {
      const run = await withSession(request, (access) => send({ method: "GET", path: "/v1/me", credential: access }));
      switch (run.kind) {
        case "none":
          return secureAnswer({ signedIn: false }, 200);
        case "signedOut":
          return secureAnswer({ signedIn: false }, 200, ended(request));
        case "offline":
          return secureAnswer({ signedIn: true }, 200);
        case "answer": {
          const cookies = run.tokens ? writeSession(run.tokens, isSecure(request)) : [];
          const user = run.response.ok ? await run.response.json().catch(() => undefined) : undefined;
          return secureAnswer(user ? { signedIn: true, user } : { signedIn: true }, 200, cookies);
        }
      }
    },

    /**
     * `/auth/live`: the access token for the live socket (its first message) and the socket's address, the one place a token reaches page script. The token is the
     * cookie's while it has time left, else the session is refreshed first (the cookies are set, and the page still never sees a refresh token); `?renew=1` is the page saying the
     * server refused the last token (close 4401), which a token with time left in its cookie does not mean to be good: the session is refreshed then too.
     */
    async live(request: Request, url: string): Promise<Response> {
      if (!isSameOrigin(request)) return new Response(null, { status: 403 });
      const { access } = readSession(request);
      const renewFirst = new URL(request.url).searchParams.get("renew") === "1" || access === undefined || secondsLeft(access) < minLiveSeconds;
      return await finish(await withSession(request, async (token) => Response.json({ token, url }), renewFirst), request);
    },

    /** `/auth/logout`: the server is told (its answer does not matter), and the cookies go. */
    async logout(request: Request): Promise<Response> {
      if (!isSameOrigin(request)) return new Response(null, { status: 403 });
      const { refresh: token } = readSession(request);
      if (token) await send({ method: "POST", path: "/v1/auth/logout", credential: token, body: JSON.stringify({ refreshToken: token }) }).catch(() => undefined);
      return secureAnswer(null, 204, ended(request));
    },
  };
}

/** The body as text, read as it arrives so that a chunked body (which has no length to check first) is cut off at `maxBody` bytes: undefined when it is longer. */
async function readCapped(request: Request): Promise<string | undefined> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > maxBody) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(part.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length >= 1 && value.length <= max;

/** What the server is sent for a sign-in: only the fields it knows, checked; undefined when the page's body is not that. */
function providerBody(provider: "apple" | "google", json: string | undefined): Record<string, string> | undefined {
  let given: Record<string, unknown>;
  try {
    given = JSON.parse(json ?? "");
  } catch {
    return undefined;
  }
  if (typeof given !== "object" || given === null) return undefined;
  if (provider === "google") return text(given.idToken, 8192) ? { idToken: given.idToken } : undefined;
  if (!text(given.identityToken, 8192) || !text(given.nonce, 512)) return undefined;
  const code = given.authorizationCode;
  const redirect = given.redirectUri;
  if ((code !== undefined && !text(code, 2048)) || (redirect !== undefined && !text(redirect, 512))) return undefined;
  return { identityToken: given.identityToken, ...(code === undefined ? {} : { authorizationCode: code as string }), nonce: given.nonce, ...(redirect === undefined ? {} : { redirectUri: redirect as string }) };
}
