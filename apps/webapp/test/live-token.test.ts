import { describe, expect, it } from "vitest";
import { createBff, type Call, type Upstream } from "../lib/api/bff";
import { liveUrl } from "../lib/api/config";
import { secondsLeft } from "../lib/api/jwt";

// `POST /auth/live`: the one place a token reaches page script. The socket's first message is that token (the server's `/v1/live`).

const origin = "https://app.yebeyt.com";
const url = "wss://api.yebeyt.com/v1/live";
const json = (status: number, body: unknown) => Response.json(body, { status });

/** A JWT like the server's: only the payload matters here. */
const jwt = (expiresInSeconds: number, label = "a") => `h.${Buffer.from(JSON.stringify({ sub: label, exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString("base64url")}.s`;

function upstream(answer: (call: Call) => Response | Promise<Response>): { send: Upstream; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    send: async (call) => {
      calls.push(call);
      return answer(call);
    },
  };
}

const post = (cookie?: string, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }, query = "") =>
  new Request(`${origin}/auth/live${query}`, { method: "POST", headers: { host: "app.yebeyt.com", "x-forwarded-proto": "https", ...headers, ...(cookie ? { cookie } : {}) } });

describe("the token for the live socket", () => {
  it("hands out the access token of the cookie while it has time left, without asking the server, and never a refresh token", async () => {
    const access = jwt(600);
    const up = upstream(() => json(200, {}));
    const response = await createBff(up.send).live(post(`yb_access=${access}; yb_refresh=refresh-1`), url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: access, url });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(up.calls).toEqual([]);
  });

  it("refreshes the session when the token is about to expire, and sets the new cookies", async () => {
    const fresh = jwt(900, "new");
    const up = upstream((call) => (call.path === "/v1/auth/refresh" ? json(200, { accessToken: fresh, refreshToken: "refresh-2", user: {} }) : json(404, {})));
    const response = await createBff(up.send).live(post(`yb_access=${jwt(20)}; yb_refresh=refresh-1`), url);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ token: fresh, url });
    expect(text).not.toContain("refresh-2");
    expect(up.calls).toEqual([{ method: "POST", path: "/v1/auth/refresh", credential: "refresh-1", body: '{"refreshToken":"refresh-1"}' }]);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.join(";")).toContain(`yb_access=${fresh}`);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly"))).toBe(true);
  });

  it("refreshes when the page says the server refused the token (?renew=1), though the cookie's has time left; without it the same token goes out again", async () => {
    const stale = jwt(600, "stale");
    const fresh = jwt(900, "new");
    const up = upstream(() => json(200, { accessToken: fresh, refreshToken: "refresh-2", user: {} }));
    const bff = createBff(up.send);
    const cookie = `yb_access=${stale}; yb_refresh=refresh-1`;
    expect((await (await bff.live(post(cookie), url)).json()).token).toBe(stale);
    expect((await (await bff.live(post(cookie), url)).json()).token).toBe(stale); // the same twice: what a refused token would get again
    expect(up.calls).toEqual([]);
    const renewed = await bff.live(post(cookie, undefined, "?renew=1"), url);
    expect((await renewed.json()).token).toBe(fresh);
    expect(up.calls.map((call) => call.credential)).toEqual(["refresh-1"]);
    expect(renewed.headers.getSetCookie()).toHaveLength(2);
  });

  it("refreshes when only the refresh cookie is left, and when the token is not a JWT at all", async () => {
    const fresh = jwt(900, "new");
    const up = upstream(() => json(200, { accessToken: fresh, refreshToken: "refresh-2", user: {} }));
    const bff = createBff(up.send);
    expect((await (await bff.live(post("yb_refresh=refresh-1"), url)).json()).token).toBe(fresh);
    expect((await (await bff.live(post("yb_access=opaque; yb_refresh=refresh-3"), url)).json()).token).toBe(fresh);
    expect(up.calls.map((call) => call.credential)).toEqual(["refresh-1", "refresh-3"]);
  });

  it("answers 401 with no cookies and asks nothing; a refused refresh answers 401 and clears the cookies", async () => {
    const up = upstream(() => json(401, { error: "unauthorized" }));
    const bff = createBff(up.send);
    const none = await bff.live(post(), url);
    expect(none.status).toBe(401);
    expect(none.headers.get("cache-control")).toBe("no-store");
    expect(up.calls).toEqual([]);
    const refused = await bff.live(post(`yb_access=${jwt(5)}; yb_refresh=refresh-1`), url);
    expect(refused.status).toBe(401);
    expect(refused.headers.getSetCookie().every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("answers 502 when the server cannot be reached for the refresh", async () => {
    const up = upstream(() => {
      throw new TypeError("offline");
    });
    expect((await createBff(up.send).live(post("yb_refresh=refresh-1"), url)).status).toBe(502);
  });

  it("is the page's own call only: a request from another site, or with no sign of its origin, is refused before anything is read", async () => {
    const up = upstream(() => json(200, {}));
    const bff = createBff(up.send);
    const cookie = `yb_access=${jwt(600)}; yb_refresh=refresh-1`;
    expect((await bff.live(post(cookie, { "sec-fetch-site": "cross-site" }), url)).status).toBe(403);
    expect((await bff.live(post(cookie, {}), url)).status).toBe(403);
    expect((await bff.live(post(cookie, { origin: "https://evil.example" }), url)).status).toBe(403);
    expect((await bff.live(post(cookie, { origin }), url)).status).toBe(200); // a browser without Sec-Fetch-Site: its Origin is this host
    expect(up.calls).toEqual([]);
  });
});

describe("how long a token has left", () => {
  it("reads the expiry of a JWT, and says nothing is left for anything else", () => {
    const now = 1_700_000_000_000;
    const at = (exp: unknown) => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
    expect(secondsLeft(at(1_700_000_600), now)).toBe(600);
    expect(secondsLeft(at(1_699_999_000), now)).toBe(0);
    for (const token of ["", "opaque", "a.b.c", "a..c", at("soon"), at(undefined), `h.${Buffer.from("[]").toString("base64url")}.s`]) expect(secondsLeft(token, now), token).toBe(0);
  });
});

describe("the socket's address", () => {
  it("is the server's with the socket scheme", () => {
    expect(liveUrl("https://api.yebeyt.com")).toBe("wss://api.yebeyt.com/v1/live");
    expect(liveUrl("https://server-production-98f46b7e.up.railway.app/")).toBe("wss://server-production-98f46b7e.up.railway.app/v1/live");
    expect(liveUrl("http://localhost:8080")).toBe("ws://localhost:8080/v1/live");
    expect(liveUrl("http://127.0.0.1:9")).toBe("ws://127.0.0.1:9/v1/live");
  });
});
