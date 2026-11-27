import { afterEach, describe, expect, it, vi } from "vitest";
import { createBff, type Call, type Upstream } from "../lib/api/bff";

afterEach(() => vi.unstubAllEnvs());

const user = { id: "u1", username: "niloofar", displayName: "نیلوفر", usernameChangedAt: null, createdAt: "2026-11-20T08:00:00.000Z", providers: ["apple"], avatar: null };
const tokens = (n: number) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, user });
const json = (status: number, body: unknown) => Response.json(body, { status });

/** An upstream that answers by `answer` and remembers the calls. */
function upstream(answer: (call: Call, calls: Call[]) => Response | Promise<Response>): { send: Upstream; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    send: async (call) => {
      calls.push(call);
      return answer(call, calls);
    },
  };
}

const origin = "https://app.yebeyt.com";
const request = (method: string, path: string, init: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
  new Request(`${origin}${path}`, {
    method,
    headers: {
      host: "app.yebeyt.com",
      "x-forwarded-proto": "https",
      ...(method === "GET" ? {} : { "sec-fetch-site": "same-origin", "content-type": "application/json" }),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

const signedIn = "yb_access=access-1; yb_refresh=refresh-1";
const proxy = (bff: ReturnType<typeof createBff>, req: Request) => {
  const url = new URL(req.url);
  return bff.proxy(req, url.pathname.split("/").slice(2));
};
const setCookies = (response: Response) => response.headers.getSetCookie();

describe("the proxy turns the session cookie into a Bearer token", () => {
  it("sends the access cookie as Authorization and nothing else of the browser's", async () => {
    const up = upstream(() => json(200, { items: [] }));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: `${signedIn}; other=1` }));
    expect(response.status).toBe(200);
    expect(up.calls).toEqual([{ method: "GET", path: "/v1/me/divan", credential: "access-1" }]);
    expect(setCookies(response)).toEqual([]);
  });

  it("answers 401 at once, without asking the server, when there is no session", async () => {
    const up = upstream(() => json(200, {}));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(up.calls).toEqual([]);
  });

  it("does not send the session with what a guest may ask", async () => {
    const up = upstream(() => json(200, []));
    await proxy(createBff(up.send), request("GET", "/api/v1/poets/pictures", { cookie: signedIn }));
    expect(up.calls).toEqual([{ method: "GET", path: "/v1/poets/pictures" }]);
  });

  it("passes the body of a PUT and the server's refusal as it is", async () => {
    const up = upstream(() => json(409, { error: "username_taken" }));
    const response = await proxy(createBff(up.send), request("PUT", "/api/v1/me/username", { cookie: signedIn, body: { username: "sara" } }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "username_taken" });
    expect(up.calls[0]).toEqual({ method: "PUT", path: "/v1/me/username", credential: "access-1", body: '{"username":"sara"}' });
  });

  it("answers 404 without asking the server for a path that is not allowed", async () => {
    const up = upstream(() => json(200, {}));
    const bff = createBff(up.send);
    expect((await proxy(bff, request("GET", "/api/v1/me", { cookie: signedIn }))).status).toBe(404);
    expect((await proxy(bff, request("PUT", "/api/v1/me", { cookie: signedIn }))).status).toBe(404);
    expect((await bff.proxy(request("GET", "/api/x", { cookie: signedIn }), ["v1", "poets", "..", "pictures"])).status).toBe(404);
    expect(up.calls).toEqual([]);
  });

  it("lets the deletion of the account through with the session, and its 204 on without a body (W5)", async () => {
    const up = upstream(() => new Response(null, { status: 204 }));
    const response = await proxy(createBff(up.send), request("DELETE", "/api/v1/me", { cookie: signedIn }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(up.calls).toEqual([{ method: "DELETE", path: "/v1/me", credential: "access-1" }]);
    const crossSite = await proxy(createBff(up.send), request("DELETE", "/api/v1/me", { cookie: signedIn, headers: { "sec-fetch-site": "cross-site" } }));
    expect(crossSite.status).toBe(403);
    expect(up.calls).toHaveLength(1);
  });

  it("passes the picture's ETag, cache control and type on, and a 304", async () => {
    const up = upstream(() => new Response("png", { headers: { etag: '"abc"', "cache-control": "public, max-age=86400", "content-type": "image/png", "set-cookie": "x=1" } }));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/poets/hafez/picture?v=ab12&evil=1", { headers: { "if-none-match": '"abc"' } }));
    expect(response.headers.get("etag")).toBe('"abc"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("png");
    expect(up.calls[0]).toEqual({ method: "GET", path: "/v1/poets/hafez/picture?v=ab12", headers: { "if-none-match": '"abc"' } });
  });

  it("does not let an answer with a session be cached", async () => {
    const up = upstream(() => json(200, { items: [] }));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 502 when the server cannot be reached, fails, or redirects", async () => {
    for (const answer of [() => { throw new TypeError("offline"); }, () => new Response("no", { status: 500 }), () => new Response(null, { status: 302, headers: { location: "http://evil.example/x" } })]) {
      const response = await proxy(createBff(upstream(answer).send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
      expect(response.status).toBe(502);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("passes on the code of the server's 502 only when it is on the short list: Apple could not be reached to revoke its token", async () => {
    const asked = async (answer: () => Response) => proxy(createBff(upstream(answer).send), request("DELETE", "/api/v1/me", { cookie: signedIn }));
    const revoke = await asked(() => json(502, { error: "apple_revoke_failed" }));
    expect(revoke.status).toBe(502);
    expect(await revoke.json()).toEqual({ error: "apple_revoke_failed" });
    for (const answer of [() => json(502, { error: "something_else", detail: "secret" }), () => new Response("<html>", { status: 502 }), () => json(500, { error: "apple_revoke_failed" })]) {
      const other = await asked(answer);
      expect(other.status).toBe(502);
      expect(await other.text()).toBe("");
    }
  });

  it("passes a write that has no body, a reaction, whose key is in the query", async () => {
    const up = upstream(() => json(200, { likes: 1 }));
    const bare = new Request(`${origin}/api/v1/reactions/like?key=%2Fa%2Fb%230`, { method: "PUT", headers: { host: "app.yebeyt.com", "sec-fetch-site": "same-origin", cookie: signedIn } });
    expect((await proxy(createBff(up.send), bare)).status).toBe(200);
    expect(up.calls[0]).toEqual({ method: "PUT", path: "/v1/reactions/like?key=%2Fa%2Fb%230", credential: "access-1" });
  });

  it("refuses a body that is not JSON or is too large", async () => {
    const up = upstream(() => json(200, {}));
    const bff = createBff(up.send);
    expect((await proxy(bff, request("POST", "/api/v1/scores", { cookie: signedIn, body: {}, headers: { "content-type": "text/plain" } }))).status).toBe(415);
    expect((await proxy(bff, request("POST", "/api/v1/scores", { cookie: signedIn, body: { pad: "x".repeat(1_100_000) } }))).status).toBe(413);
    expect(up.calls).toEqual([]);
  });

  it("cuts off a chunked body, which has no length to check, once it is too large, and stops reading it", async () => {
    const up = upstream(() => json(200, {}));
    let sent = 0;
    const chunk = new TextEncoder().encode("x".repeat(400_000));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 50) return controller.close();
        controller.enqueue(chunk);
      },
    });
    const chunked = new Request(`${origin}/api/v1/scores`, {
      method: "POST",
      headers: { host: "app.yebeyt.com", "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: signedIn },
      body,
      duplex: "half",
    } as RequestInit);
    expect(chunked.headers.get("content-length")).toBeNull();
    expect((await proxy(createBff(up.send), chunked)).status).toBe(413);
    expect(sent).toBeLessThan(10);
    expect(up.calls).toEqual([]);
  });

  it("passes a chunked body that is within the limit", async () => {
    const up = upstream(() => json(200, {}));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"game":"po'));
        controller.enqueue(encoder.encode('et","points":3}'));
        controller.close();
      },
    });
    const chunked = new Request(`${origin}/api/v1/scores`, {
      method: "POST",
      headers: { host: "app.yebeyt.com", "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: signedIn },
      body,
      duplex: "half",
    } as RequestInit);
    expect((await proxy(createBff(up.send), chunked)).status).toBe(200);
    expect(up.calls[0]?.body).toBe('{"game":"poet","points":3}');
  });
});

describe("a challenge may be read and answered without a session (W8)", () => {
  it("reads a challenge with no session for a guest, and with the session of someone signed in", async () => {
    const up = upstream(() => json(200, { score: 8 }));
    const bff = createBff(up.send);
    expect((await proxy(bff, request("GET", "/api/v1/challenges/7KQ2"))).status).toBe(200);
    expect((await proxy(bff, request("GET", "/api/v1/challenges/7KQ2", { cookie: signedIn }))).status).toBe(200);
    expect(up.calls).toEqual([{ method: "GET", path: "/v1/challenges/7KQ2" }, { method: "GET", path: "/v1/challenges/7KQ2", credential: "access-1" }]);
  });

  it("posts a result with the session when there is one", async () => {
    const up = upstream(() => json(201, { id: "r1" }));
    const response = await proxy(createBff(up.send), request("POST", "/api/v1/challenges/7KQ2/results", { cookie: signedIn, body: { score: 9, seconds: 80 } }));
    expect(response.status).toBe(201);
    expect(up.calls).toEqual([{ method: "POST", path: "/v1/challenges/7KQ2/results", credential: "access-1", body: '{"score":9,"seconds":80}' }]);
  });

  it("posts a guest's result with no credential, as a write from the page's own origin", async () => {
    const up = upstream(() => json(201, { id: "r1" }));
    const bff = createBff(up.send);
    const response = await proxy(bff, request("POST", "/api/v1/challenges/7KQ2/results", { body: { score: 7, seconds: 90, name: "کیان" } }));
    expect(response.status).toBe(201);
    expect(up.calls).toEqual([{ method: "POST", path: "/v1/challenges/7KQ2/results", body: '{"score":7,"seconds":90,"name":"کیان"}' }]);
    const foreign = await proxy(bff, request("POST", "/api/v1/challenges/7KQ2/results", { body: { score: 7, seconds: 90, name: "x" }, headers: { "sec-fetch-site": "cross-site" } }));
    expect(foreign.status).toBe(403);
    expect(up.calls).toHaveLength(1);
  });

  it("passes the server's refusal of a guest's result on, a 409 included", async () => {
    const up = upstream(() => json(409, { error: "conflict" }));
    const response = await proxy(createBff(up.send), request("POST", "/api/v1/challenges/7KQ2/results", { body: { score: 7, seconds: 90, name: "کیان" } }));
    expect([response.status, await response.json()]).toEqual([409, { error: "conflict" }]);
  });

  it("signs out, as for any call with a session, when the session is refused for good", async () => {
    const up = upstream((call) => (call.path === "/v1/auth/refresh" ? json(401, { error: "invalid_token" }) : json(401, { error: "unauthorized" })));
    const response = await proxy(createBff(up.send), request("POST", "/api/v1/challenges/7KQ2/results", { cookie: signedIn, body: { score: 7, seconds: 90 } }));
    expect(response.status).toBe(401);
    expect(setCookies(response).map((line) => line.split(";")[0])).toEqual(["yb_access=", "yb_refresh="]);
  });

  it("sends the debug server's header only in a build with the debug pages, and only when the page asked for it", async () => {
    const up = upstream(() => json(200, {}));
    const bff = createBff(up.send);
    const ask = () => proxy(bff, request("GET", "/api/v1/challenges/7KQ2", { headers: { "x-beyt-play-stub": "1" } }));
    await ask();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "");
    await ask();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    await ask();
    await proxy(bff, request("GET", "/api/v1/challenges/7KQ2"));
    expect(up.calls.map((call) => call.headers)).toEqual([{ "x-beyt-play-stub": "1" }, undefined, { "x-beyt-play-stub": "1" }, undefined]);
  });
});

describe("a 401 is refreshed once", () => {
  const refreshing = () =>
    upstream((call) => {
      if (call.path === "/v1/auth/refresh") return json(200, tokens(2));
      return json(call.credential === "access-2" ? 200 : 401, call.credential === "access-2" ? { items: [] } : { error: "unauthorized" });
    });

  it("swaps the refresh token for a new pair, asks again, and sets the new cookies", async () => {
    const up = refreshing();
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    expect(response.status).toBe(200);
    expect(up.calls.map((call) => `${call.path} ${call.credential}`)).toEqual(["/v1/me/divan access-1", "/v1/auth/refresh refresh-1", "/v1/me/divan access-2"]);
    expect(up.calls[1]!.body).toBe('{"refreshToken":"refresh-1"}');
    const cookies = setCookies(response);
    expect(cookies.find((line) => line.startsWith("yb_access=access-2"))).toMatch(/HttpOnly/);
    expect(cookies.find((line) => line.startsWith("yb_refresh=refresh-2"))).toMatch(/HttpOnly/);
  });

  it("refreshes first when the access cookie has expired", async () => {
    const up = refreshing();
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: "yb_refresh=refresh-1" }));
    expect(response.status).toBe(200);
    expect(up.calls.map((call) => `${call.path} ${call.credential}`)).toEqual(["/v1/auth/refresh refresh-1", "/v1/me/divan access-2"]);
  });

  it("does not refresh a second time when the new token is refused too", async () => {
    const up = upstream((call) => (call.path === "/v1/auth/refresh" ? json(200, tokens(2)) : json(401, { error: "unauthorized" })));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    expect(response.status).toBe(401);
    expect(up.calls.filter((call) => call.path === "/v1/auth/refresh")).toHaveLength(1);
  });

  it("signs out when the refresh token is refused: the cookies are cleared", async () => {
    const up = upstream((call) => (call.path === "/v1/auth/refresh" ? json(401, { error: "invalid_token" }) : json(401, { error: "unauthorized" })));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    expect(response.status).toBe(401);
    expect(setCookies(response).map((line) => line.split(";")[0])).toEqual(["yb_access=", "yb_refresh="]);
    expect(setCookies(response).every((line) => /Max-Age=0/.test(line))).toBe(true);
  });

  it("stays signed in when the server cannot be reached for the refresh: 502 and no cookie change", async () => {
    const up = upstream((call) => {
      if (call.path === "/v1/auth/refresh") throw new TypeError("offline");
      return json(401, { error: "unauthorized" });
    });
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    expect(response.status).toBe(502);
    expect(setCookies(response)).toEqual([]);
  });

  it("shares one refresh between requests that meet the expired token together, and with a late one that carries the old token", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const up = upstream(async (call) => {
      if (call.path === "/v1/auth/refresh") {
        await gate;
        return json(200, tokens(2));
      }
      return call.credential === "access-2" ? json(200, { items: [] }) : json(401, { error: "unauthorized" });
    });
    const bff = createBff(up.send);
    const first = proxy(bff, request("GET", "/api/v1/me/divan", { cookie: signedIn }));
    const second = proxy(bff, request("GET", "/api/v1/me/reactions", { cookie: signedIn }));
    await vi.waitFor(() => expect(up.calls.filter((call) => call.credential === "access-1")).toHaveLength(2));
    release();
    const answers = await Promise.all([first, second]);
    expect(answers.map((answer) => answer.status)).toEqual([200, 200]);
    expect(up.calls.filter((call) => call.path === "/v1/auth/refresh")).toHaveLength(1);
    for (const answer of answers) expect(setCookies(answer).some((line) => line.startsWith("yb_refresh=refresh-2"))).toBe(true);

    // The browser had not yet stored the new cookies when one more request went out with the old pair: the token is not used twice.
    const late = await proxy(bff, request("GET", "/api/v1/me/stats", { cookie: signedIn }));
    expect(late.status).toBe(200);
    expect(up.calls.filter((call) => call.path === "/v1/auth/refresh")).toHaveLength(1);
  });
});

describe("a write needs the page's own origin", () => {
  const bff = () => createBff(upstream(() => json(200, {})).send);

  it("refuses a write from another site, or with no sign of where it came from", async () => {
    for (const headers of [{ "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "none" }]) {
      expect((await proxy(bff(), request("POST", "/api/v1/scores", { cookie: signedIn, body: {}, headers }))).status, JSON.stringify(headers)).toBe(403);
    }
    const bare = new Request(`${origin}/api/v1/scores`, { method: "POST", headers: { host: "app.yebeyt.com", cookie: signedIn, "content-type": "application/json" }, body: "{}" });
    expect((await proxy(bff(), bare)).status).toBe(403);
    const evil = new Request(`${origin}/api/v1/scores`, { method: "POST", headers: { host: "app.yebeyt.com", origin: "https://evil.example", cookie: signedIn, "content-type": "application/json" }, body: "{}" });
    expect((await proxy(bff(), evil)).status).toBe(403);
  });

  it("accepts Sec-Fetch-Site same-origin, and an Origin of this host when the browser sends no Sec-Fetch-Site", async () => {
    expect((await proxy(bff(), request("POST", "/api/v1/scores", { cookie: signedIn, body: {} }))).status).toBe(200);
    const old = new Request(`${origin}/api/v1/scores`, { method: "POST", headers: { host: "app.yebeyt.com", origin, cookie: signedIn, "content-type": "application/json" }, body: "{}" });
    expect((await proxy(bff(), old)).status).toBe(200);
  });

  it("does not ask a read for it", async () => {
    const read = new Request(`${origin}/api/v1/me/stats`, { headers: { host: "app.yebeyt.com", cookie: signedIn, "sec-fetch-site": "cross-site" } });
    expect((await proxy(bff(), read)).status).toBe(200);
  });
});

describe("the auth routes keep the tokens away from the page", () => {
  it("signs in with Apple: the raw nonce and the code go to the server, the tokens go into httpOnly cookies, the page gets the user", async () => {
    const up = upstream(() => json(200, tokens(1)));
    const body = { identityToken: "idt", authorizationCode: "code", nonce: "raw-nonce", redirectUri: "https://app.yebeyt.com/auth/apple" };
    const response = await createBff(up.send).signIn(request("POST", "/auth/apple", { body }), "apple");
    expect(up.calls).toEqual([{ method: "POST", path: "/v1/auth/apple", body: JSON.stringify(body) }]);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ user });
    expect(text).not.toContain("access-1");
    expect(text).not.toContain("refresh-1");
    const cookies = setCookies(response);
    expect(cookies).toHaveLength(2);
    expect(cookies.every((line) => /HttpOnly/.test(line) && /Secure/.test(line) && /SameSite=Lax/.test(line) && /Path=\//.test(line))).toBe(true);
    expect(cookies[0]).toMatch(/^yb_access=access-1;/);
    expect(cookies[1]).toMatch(/^yb_refresh=refresh-1;.*Max-Age=5184000/);
  });

  it("signs in with Google by its id token", async () => {
    const up = upstream(() => json(200, tokens(1)));
    const response = await createBff(up.send).signIn(request("POST", "/auth/google", { body: { idToken: "gid", extra: "dropped" } }), "google");
    expect(up.calls[0]).toEqual({ method: "POST", path: "/v1/auth/google", body: '{"idToken":"gid"}' });
    expect(await response.json()).toEqual({ user });
  });

  it("passes the server's refusal on without cookies, and refuses a body that is not what the provider sends", async () => {
    const refused = createBff(upstream(() => json(401, { error: "invalid_token" })).send);
    const no = await refused.signIn(request("POST", "/auth/google", { body: { idToken: "bad" } }), "google");
    expect(no.status).toBe(401);
    expect(await no.json()).toEqual({ error: "invalid_token" });
    expect(setCookies(no)).toEqual([]);
    const up = upstream(() => json(200, tokens(1)));
    const bff = createBff(up.send);
    expect((await bff.signIn(request("POST", "/auth/google", { body: { idToken: 5 } }), "google")).status).toBe(400);
    expect((await bff.signIn(request("POST", "/auth/apple", { body: { identityToken: "x" } }), "apple")).status).toBe(400);
    expect(up.calls).toEqual([]);
  });

  it("answers 502, not 500, when the server's 200 to a sign-in is not JSON or not a session", async () => {
    const html = createBff(upstream(() => new Response("<html>", { status: 200 })).send);
    const first = await html.signIn(request("POST", "/auth/google", { body: { idToken: "t" } }), "google");
    expect(first.status).toBe(502);
    expect(setCookies(first)).toEqual([]);
    const odd = createBff(upstream(() => json(200, { hello: 1 })).send);
    expect((await odd.signIn(request("POST", "/auth/apple", { body: { identityToken: "t", nonce: "n" } }), "apple")).status).toBe(502);
  });

  it("refuses a sign-in from another site", async () => {
    const up = upstream(() => json(200, tokens(1)));
    const cross = request("POST", "/auth/google", { body: { idToken: "gid" }, headers: { "sec-fetch-site": "cross-site" } });
    expect((await createBff(up.send).signIn(cross, "google")).status).toBe(403);
    expect(up.calls).toEqual([]);
  });

  it("has the Secure flag only when it is served over https", async () => {
    const up = upstream(() => json(200, tokens(1)));
    const http = new Request("http://localhost:4173/auth/google", { method: "POST", headers: { host: "localhost:4173", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: '{"idToken":"g"}' });
    const response = await createBff(up.send).signIn(http, "google");
    expect(setCookies(response).some((line) => /Secure/.test(line))).toBe(false);
  });

  it("tells who is signed in: nobody without cookies, the user with them, and still «signed in» when the server cannot be reached", async () => {
    const asking = upstream(() => json(200, user));
    const bff = createBff(asking.send);
    expect(await (await bff.session(request("GET", "/auth/session"))).json()).toEqual({ signedIn: false });
    expect(asking.calls).toEqual([]);
    expect(await (await bff.session(request("GET", "/auth/session", { cookie: signedIn }))).json()).toEqual({ signedIn: true, user });
    expect(asking.calls).toEqual([{ method: "GET", path: "/v1/me", credential: "access-1" }]);
    const offline = createBff(upstream(() => { throw new TypeError("offline"); }).send);
    expect(await (await offline.session(request("GET", "/auth/session", { cookie: signedIn }))).json()).toEqual({ signedIn: true });
  });

  it("refreshes when it asks, and signs out when the refresh is refused", async () => {
    const up = upstream((call) => {
      if (call.path === "/v1/auth/refresh") return json(200, tokens(2));
      return call.credential === "access-2" ? json(200, user) : json(401, { error: "unauthorized" });
    });
    const response = await createBff(up.send).session(request("GET", "/auth/session", { cookie: signedIn }));
    expect(await response.json()).toEqual({ signedIn: true, user });
    expect(setCookies(response).some((line) => line.startsWith("yb_refresh=refresh-2"))).toBe(true);
    const gone = await createBff(upstream(() => json(401, { error: "invalid_token" })).send).session(request("GET", "/auth/session", { cookie: signedIn }));
    expect(await gone.json()).toEqual({ signedIn: false });
    expect(setCookies(gone).map((line) => line.split(";")[0])).toEqual(["yb_access=", "yb_refresh="]);
  });

  it("signs out: the server is told, and the cookies go even when it cannot be reached", async () => {
    const up = upstream(() => new Response(null, { status: 204 }));
    const response = await createBff(up.send).logout(request("POST", "/auth/logout", { cookie: signedIn, body: {} }));
    expect(response.status).toBe(204);
    expect(up.calls).toEqual([{ method: "POST", path: "/v1/auth/logout", credential: "refresh-1", body: '{"refreshToken":"refresh-1"}' }]);
    expect(setCookies(response).map((line) => line.split(";")[0])).toEqual(["yb_access=", "yb_refresh="]);
    const down = await createBff(upstream(() => { throw new TypeError("offline"); }).send).logout(request("POST", "/auth/logout", { cookie: signedIn, body: {} }));
    expect(down.status).toBe(204);
    expect(setCookies(down)).toHaveLength(2);
  });

  it("refuses a sign-out from another site", async () => {
    const up = upstream(() => new Response(null, { status: 204 }));
    const cross = request("POST", "/auth/logout", { cookie: signedIn, body: {}, headers: { "sec-fetch-site": "cross-site" } });
    expect((await createBff(up.send).logout(cross)).status).toBe(403);
    expect(up.calls).toEqual([]);
  });

  it("ignores a cookie that is not a token, so nothing odd reaches the server's header", async () => {
    const up = upstream(() => json(200, {}));
    const response = await proxy(createBff(up.send), request("GET", "/api/v1/me/divan", { cookie: "yb_access=a b; yb_refresh=<script>" }));
    expect(response.status).toBe(401);
    expect(up.calls).toEqual([]);
  });
});
