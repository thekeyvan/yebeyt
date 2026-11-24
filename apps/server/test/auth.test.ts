import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret } from "../src/crypto.js";
import { identities, sessions, users } from "../src/db/schema.js";
import { BUNDLE_ID, makeHarness, NONCE, nonceHash, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const post = (path: string, json: unknown) => h.request(path, { method: "POST", json });

describe("POST /v1/auth/google", () => {
  it("signs in and creates the user", async () => {
    const res = await post("/v1/auth/google", { idToken: await h.googleToken("g-1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ username: null, usernameChangedAt: null, providers: ["google"] });
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    const me = await h.request("/v1/me", { token: body.accessToken });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual(body.user);
  });

  it("reuses the user for the same Google account and separates accounts", async () => {
    const a = await h.signIn("g-1");
    const again = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    expect(again.user.id).toBe(a.user.id);
    expect(b.user.id).not.toBe(a.user.id);
    expect(await h.db.select().from(users).where(eq(users.isHouse, false))).toHaveLength(2);
  });

  it("rejects bad tokens with 401 invalid_token", async () => {
    const res = await post("/v1/auth/google", { idToken: await h.googleToken("g", { aud: "other" }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_token" });
  });

  it("rejects a malformed body with 400 invalid_request", async () => {
    const res = await post("/v1/auth/google", { nope: 1 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    const broken = await h.request("/v1/auth/google", { method: "POST", body: "{", headers: { "content-type": "application/json" } });
    expect(broken.status).toBe(400);
  });
});

describe("POST /v1/auth/apple", () => {
  it("signs in by the Apple sub, checking the nonce when given", async () => {
    const token = await h.appleToken("apple-1", { nonce: nonceHash("n1") });
    const ok = await post("/v1/auth/apple", { identityToken: token, nonce: "n1", fullName: { givenName: "Ali", familyName: null } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).user.providers).toEqual(["apple"]);
    const bad = await post("/v1/auth/apple", { identityToken: token, nonce: "wrong" });
    expect(bad.status).toBe(401);
    const missing = await post("/v1/auth/apple", { identityToken: token });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "invalid_request" });
    const unbound = await post("/v1/auth/apple", { identityToken: await h.appleToken("apple-2", { nonce: undefined }), nonce: "n1" });
    expect(unbound.status).toBe(401);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Apple's refresh token, sealed, when an authorization code is given", async () => {
    h.fetchMock.mockResolvedValueOnce(Response.json({ refresh_token: "apple-refresh-1", access_token: "x" }));
    const res = await post("/v1/auth/apple", { identityToken: await h.appleToken("apple-1"), nonce: NONCE, authorizationCode: "code-1" });
    expect(res.status).toBe(200);

    const [url, init] = h.fetchMock.mock.calls[0]!;
    expect(url).toBe("https://appleid.apple.com/auth/token");
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    const form = init!.body as URLSearchParams;
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("code-1");
    expect(form.get("client_id")).toBe(BUNDLE_ID);
    const [header, claims] = form.get("client_secret")!.split(".").slice(0, 2).map((p) => JSON.parse(Buffer.from(p, "base64url").toString()));
    expect(header).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(claims).toMatchObject({ iss: "TEAM123456", sub: BUNDLE_ID, aud: "https://appleid.apple.com" });

    const [identity] = await h.db.select().from(identities);
    expect(identity!.appleRefreshToken).not.toContain("apple-refresh-1");
    expect(JSON.parse(decryptSecret(identity!.appleRefreshToken!, h.deps.config.jwtSecret)!)).toEqual({ t: "apple-refresh-1", c: BUNDLE_ID });
  });

  it("still signs in when Apple's code exchange fails", async () => {
    h.fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    const res = await post("/v1/auth/apple", { identityToken: await h.appleToken("apple-1"), nonce: NONCE, authorizationCode: "bad" });
    expect(res.status).toBe(200);
    const [identity] = await h.db.select().from(identities);
    expect(identity!.appleRefreshToken).toBeNull();
  });
});

describe("refresh and logout", () => {
  it("rotates: the old token stops working, the new one works", async () => {
    const s = await h.signIn();
    const res = await post("/v1/auth/refresh", { refreshToken: s.refreshToken });
    expect(res.status).toBe(200);
    const next = await res.json();
    expect(next.refreshToken).not.toBe(s.refreshToken);
    expect(next.user.id).toBe(s.user.id);
    expect((await h.request("/v1/me", { token: next.accessToken })).status).toBe(200);
    expect((await post("/v1/auth/refresh", { refreshToken: next.refreshToken })).status).toBe(200);
  });

  it("stores only a hash of the refresh token", async () => {
    const s = await h.signIn();
    const rows = await h.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(s.refreshToken);
    expect(JSON.stringify(rows)).not.toContain(s.refreshToken);
  });

  it("revokes the whole family when a used token is shown again", async () => {
    const s = await h.signIn();
    const next = await (await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).json();
    h.clock.time = new Date(h.clock.time.getTime() + 11_000); // past the 10 s grace for retries
    const replay = await post("/v1/auth/refresh", { refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);
    expect(await replay.json()).toEqual({ error: "invalid_token" });
    // the newest token of the family is dead too
    expect((await post("/v1/auth/refresh", { refreshToken: next.refreshToken })).status).toBe(401);
  });

  it("leaves other sign-ins of the same user alone when one family is revoked", async () => {
    const phone = await h.signIn("g-1");
    const other = await h.signIn("g-1");
    await post("/v1/auth/refresh", { refreshToken: phone.refreshToken });
    h.clock.time = new Date(h.clock.time.getTime() + 11_000);
    await post("/v1/auth/refresh", { refreshToken: phone.refreshToken }); // replay
    expect((await post("/v1/auth/refresh", { refreshToken: other.refreshToken })).status).toBe(200);
  });

  it("lets exactly one of two parallel refreshes win, and the winner's new token works", async () => {
    const s = await h.signIn();
    const [a, b] = await Promise.all([
      post("/v1/auth/refresh", { refreshToken: s.refreshToken }),
      post("/v1/auth/refresh", { refreshToken: s.refreshToken }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
    const winner = await (a.status === 200 ? a : b).json();
    expect((await post("/v1/auth/refresh", { refreshToken: winner.refreshToken })).status).toBe(200);
    expect(await h.db.select().from(sessions)).toHaveLength(3);
  });

  it("refuses a token used moments ago without revoking the family, but revokes once the grace has passed", async () => {
    const s = await h.signIn();
    const next = await (await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).json();
    expect((await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).status).toBe(401); // a retry
    const still = await post("/v1/auth/refresh", { refreshToken: next.refreshToken });
    expect(still.status).toBe(200);
    h.clock.time = new Date(h.clock.time.getTime() + 11_000);
    expect((await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).status).toBe(401); // a replay
    expect((await post("/v1/auth/refresh", { refreshToken: (await still.json()).refreshToken })).status).toBe(401);
  });

  it("rejects unknown and expired refresh tokens", async () => {
    expect((await post("/v1/auth/refresh", { refreshToken: "nope" })).status).toBe(401);
    const s = await h.signIn();
    h.clock.time = new Date(h.clock.time.getTime() + 61 * 24 * 3600 * 1000);
    expect((await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).status).toBe(401);
  });

  it("logout revokes the sign-in and is idempotent", async () => {
    const s = await h.signIn();
    expect((await post("/v1/auth/logout", { refreshToken: s.refreshToken })).status).toBe(204);
    expect((await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).status).toBe(401);
    expect((await post("/v1/auth/logout", { refreshToken: s.refreshToken })).status).toBe(204);
    expect((await post("/v1/auth/logout", { refreshToken: "unknown" })).status).toBe(204);
  });

  it("access tokens last 15 minutes", async () => {
    const s = await h.signIn();
    h.clock.time = new Date(h.clock.time.getTime() + 14 * 60 * 1000);
    expect((await h.request("/v1/me", { token: s.accessToken })).status).toBe(200);
    h.clock.time = new Date(h.clock.time.getTime() + 2 * 60 * 1000);
    const res = await h.request("/v1/me", { token: s.accessToken });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("refuses requests without a valid access token", async () => {
    expect((await h.request("/v1/me")).status).toBe(401);
    expect((await h.request("/v1/me", { token: "garbage" })).status).toBe(401);
    // a refresh token is not an access token
    const s = await h.signIn();
    expect((await h.request("/v1/me", { token: s.refreshToken })).status).toBe(401);
  });
});

describe("DELETE /v1/me", () => {
  const signInApple = async (sub = "apple-1") => {
    h.fetchMock.mockResolvedValueOnce(Response.json({ refresh_token: "apple-refresh-1" }));
    const res = await post("/v1/auth/apple", { identityToken: await h.appleToken(sub), nonce: NONCE, authorizationCode: "c" });
    h.fetchMock.mockClear();
    return res.json() as Promise<Awaited<ReturnType<Harness["signIn"]>>>;
  };

  it("deletes the user and every row, and revokes the Apple token", async () => {
    const s = await signInApple();
    await h.request("/v1/me/progress", { method: "PUT", token: s.accessToken, json: { points: 5, streakDays: 1, streakLastDate: "2026-06-01", bestByGame: {} } });
    await h.request("/v1/me/divan", { method: "PUT", token: s.accessToken, json: { items: [{ key: "/hafez/ghazal/sh3#0", keptAt: "2026-06-01T10:00:00.000Z" }] } });
    await h.request("/v1/me/privacy", { method: "PUT", token: s.accessToken, json: { keptVisibility: "me" } });
    h.fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const res = await h.request("/v1/me", { method: "DELETE", token: s.accessToken });
    expect(res.status).toBe(204);

    const [url, init] = h.fetchMock.mock.calls[0]!;
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    const form = init!.body as URLSearchParams;
    expect(form.get("token")).toBe("apple-refresh-1");
    expect(form.get("token_type_hint")).toBe("refresh_token");
    expect(form.get("client_id")).toBe(BUNDLE_ID);

    for (const table of ["users", "identities", "sessions", "progress", "divan_items", "privacy_settings"]) {
      const rows = await h.db.execute(sql.raw(`select count(*)::int as n from ${table}${table === "users" ? " where not is_house" : ""}`)); // «یه بیت» stays
      expect((rows as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(0);
    }
    expect((await h.request("/v1/me", { token: s.accessToken })).status).toBe(401);
    expect((await post("/v1/auth/refresh", { refreshToken: s.refreshToken })).status).toBe(401);
  });

  it("deletes a Google-only user without calling Apple", async () => {
    const s = await h.signIn();
    expect((await h.request("/v1/me", { method: "DELETE", token: s.accessToken })).status).toBe(204);
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(await h.db.select().from(users).where(eq(users.isHouse, false))).toHaveLength(0);
  });

  it("keeps the account when Apple cannot be reached, so it can be retried", async () => {
    const s = await signInApple();
    h.fetchMock.mockRejectedValueOnce(new Error("network"));
    const res = await h.request("/v1/me", { method: "DELETE", token: s.accessToken });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "apple_revoke_failed" });
    expect(await h.db.select().from(users).where(eq(users.id, s.user.id))).toHaveLength(1);
    h.fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await h.request("/v1/me", { method: "DELETE", token: s.accessToken })).status).toBe(204);
  });

  it("deletes when Apple answers 400 invalid_grant: the token was already revoked", async () => {
    const s = await signInApple();
    h.fetchMock.mockResolvedValueOnce(Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect((await h.request("/v1/me", { method: "DELETE", token: s.accessToken })).status).toBe(204);
    expect(await h.db.select().from(users).where(eq(users.isHouse, false))).toHaveLength(0);
  });

  it("keeps the account on any other non-2xx from Apple and logs the status and error code only", async () => {
    const s = await signInApple();
    for (const [status, error] of [[400, "invalid_client"], [500, "invalid_grant"]] as const) {
      h.fetchMock.mockResolvedValueOnce(Response.json({ error, error_description: "secret detail" }, { status }));
      const res = await h.request("/v1/me", { method: "DELETE", token: s.accessToken });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "apple_revoke_failed" });
    }
    expect(h.logs).toContain("apple revoke failed status=400 error=invalid_client");
    expect(h.logs.join("\n")).not.toContain("secret detail");
    expect(h.logs.join("\n")).not.toContain("apple-refresh-1");
    expect(await h.db.select().from(users).where(eq(users.isHouse, false))).toHaveLength(1);
  });
});
