import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { upstream } from "../lib/api/upstream";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const spec = (account: object) => `debug-${Buffer.from(JSON.stringify(account)).toString("base64url")}`;

/** Signs in with the debug provider token and returns the session. */
async function signIn(account: object = {}) {
  const answer = await upstream({ method: "POST", path: "/v1/auth/apple", body: JSON.stringify({ identityToken: spec(account), nonce: "n" }) });
  return (await answer.json()) as { accessToken: string; refreshToken: string; user: { id: string; username: string | null; email: string | null; newsOptIn: boolean } };
}

const call = (session: { accessToken: string }, method: string, path: string, body?: unknown) =>
  upstream({ method, path, credential: session.accessToken, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

describe("the debug server (only in a build with the debug pages)", () => {
  it("is not there in production: a debug sign-in goes to the real server like any other, and a debug token is only a Bearer token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "");
    vi.stubEnv("API_URL", "http://api.test");
    const fetched = vi.fn(async () => Response.json({ error: "invalid_token" }, { status: 401 }));
    vi.stubGlobal("fetch", fetched);
    const answer = await upstream({ method: "POST", path: "/v1/auth/apple", body: JSON.stringify({ identityToken: spec({ username: "x" }), nonce: "n" }) });
    expect(answer.status).toBe(401);
    expect(fetched).toHaveBeenCalledTimes(1);
    await upstream({ method: "GET", path: "/v1/me", credential: "debug-access.abc" });
    expect(fetched).toHaveBeenCalledTimes(2);
    expect(new Headers((fetched.mock.calls[1] as unknown as [string, RequestInit])[1].headers).get("authorization")).toBe("Bearer debug-access.abc");
    expect(String((fetched.mock.calls[1] as unknown as [string])[0])).toBe("http://api.test/v1/me");
  });

  it("sends the Bearer token of the session to the real server, and the refresh token only in the body", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "http://api.test");
    const fetched = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetched);
    await upstream({ method: "GET", path: "/v1/me/divan", credential: "access-1" });
    await upstream({ method: "POST", path: "/v1/auth/refresh", credential: "refresh-1", body: '{"refreshToken":"refresh-1"}' });
    const [, first] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    const [, second] = fetched.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(first.headers).get("authorization")).toBe("Bearer access-1");
    expect(new Headers(second.headers).get("authorization")).toBeNull();
    expect(first.redirect).toBe("manual");
    expect(first.signal).toBeInstanceOf(AbortSignal);
  });

  it("signs in as the account asked for, a new one without a username, and refreshes and ends the session", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const fresh = await signIn({ username: null, provider: "google" });
    expect(fresh.user).toMatchObject({ username: null, providers: ["google"] });
    const same = await signIn({ id: "fixed", username: "niloofar" });
    expect((await signIn({ id: "fixed" })).user.id).toBe(same.user.id);
    const refreshed = (await (await upstream({ method: "POST", path: "/v1/auth/refresh", credential: same.refreshToken, body: JSON.stringify({ refreshToken: same.refreshToken }) })).json()) as { user: { username: string } };
    expect(refreshed.user.username).toBe("niloofar");
    expect((await upstream({ method: "POST", path: "/v1/auth/logout", credential: same.refreshToken, body: "{}" })).status).toBe(204);
  });

  it("answers the username rules as the server does: the reasons, the taken names, and a saved username", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const session = await signIn({ username: null });
    const check = async (name: string) => (await call(session, "GET", `/v1/usernames/check?u=${name}`)).json();
    expect(await check("sara")).toEqual({ available: false, reason: "taken" });
    expect(await check("ab")).toEqual({ available: false, reason: "too_short" });
    expect(await check("admin")).toEqual({ available: false, reason: "reserved" });
    expect(await check("mahsa.k")).toEqual({ available: true });
    expect((await call(session, "PUT", "/v1/me/username", { username: "sara" })).status).toBe(409);
    expect((await call(session, "PUT", "/v1/me/username", { username: "a b" })).status).toBe(400);
    const saved = (await (await call(session, "PUT", "/v1/me/username", { username: "mahsa.k" })).json()) as { username: string };
    expect(saved.username).toBe("mahsa.k");
    expect(await (await call(session, "GET", "/v1/usernames/suggestions?base=niloo")).json()).toEqual({ suggestions: ["niloo_", "niloo.beyt", "niloo42"] });
  });

  it("keeps a divan with the later of each time, reactions, rounds (a repeated round id is a conflict) and progress", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const session = await signIn({ username: "niloofar" });
    await call(session, "PUT", "/v1/me/divan", { items: [{ key: "/a/b#0", keptAt: "2026-11-20T10:00:00.000Z" }] });
    const merged = (await (await call(session, "PUT", "/v1/me/divan", { items: [{ key: "/a/b#0", removedAt: "2026-11-21T10:00:00.000Z" }] })).json()) as { items: unknown[] };
    expect(merged.items).toEqual([{ key: "/a/b#0", keptAt: "2026-11-20T10:00:00.000Z", removedAt: "2026-11-21T10:00:00.000Z" }]);

    await call(session, "PUT", "/v1/reactions/like?key=%2Fa%2Fb%230");
    expect(await (await call(session, "GET", "/v1/me/reactions")).json()).toMatchObject({ items: [{ key: "/a/b#0", kind: "like" }], nextCursor: null });
    await call(session, "DELETE", "/v1/reactions/like?key=%2Fa%2Fb%230");
    expect(await (await call(session, "GET", "/v1/me/reactions")).json()).toMatchObject({ items: [] });

    const round = { roundId: "r1", game: "poet", points: 60, playedAt: "2026-11-20T10:00:00.000Z" };
    expect((await call(session, "POST", "/v1/scores", round)).status).toBe(200);
    expect((await call(session, "POST", "/v1/scores", round)).status).toBe(409);
    await call(session, "PUT", "/v1/me/progress", { points: 140, streakDays: 2, streakLastDate: "2026-11-22", bestByGame: { jigsaw: 215 } });
    expect(await (await call(session, "GET", "/v1/me/stats")).json()).toMatchObject({ totalPoints: 60, streakDays: 2 }); // the carried-over points are not rounds
  });

  it("answers an email and the news choice as the server does: the choice is off at first, kept once made, and only a boolean is taken", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const session = await signIn({ username: "niloofar" });
    expect(session.user).toMatchObject({ email: "niloofar@example.com", newsOptIn: false });
    const on = (await (await call(session, "PUT", "/v1/me/news", { optIn: true })).json()) as { newsOptIn: boolean; email: string };
    expect(on).toMatchObject({ newsOptIn: true, email: "niloofar@example.com" });
    expect(await (await call(session, "GET", "/v1/me")).json()).toMatchObject({ newsOptIn: true });
    expect(((await (await call(session, "PUT", "/v1/me/news", { optIn: false })).json()) as { newsOptIn: boolean }).newsOptIn).toBe(false);
    expect((await call(session, "PUT", "/v1/me/news", { optIn: "yes" })).status).toBe(400);
    expect((await call(session, "PUT", "/v1/me/news", {})).status).toBe(400);
    const relay = await signIn({ username: "x", email: "x7k2@privaterelay.appleid.com" });
    expect(relay.user).toMatchObject({ email: "x7k2@privaterelay.appleid.com" });
    expect((await signIn({ username: "y", email: null })).user).toMatchObject({ email: null });
  });

  it("keeps the avatar and the privacy settings (the defaults, then only the fields sent) and forgets a deleted account", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const session = await signIn({ id: "to-delete", username: "niloofar" });
    const face = { face: "tan", eyes: "wink", hair: "fire", mouth: "grin", accessory: "rose", background: "mint" };
    expect(((await (await call(session, "PUT", "/v1/me/avatar", face)).json()) as { avatar: unknown }).avatar).toEqual(face);
    expect(((await (await call(session, "GET", "/v1/me")).json()) as { avatar: unknown }).avatar).toEqual(face);

    expect(await (await call(session, "GET", "/v1/me/privacy")).json()).toEqual({ keptVisibility: "friends", dailyVisibility: "friends", showOnline: true, inGlobalLeaderboard: false, messagesFrom: "friends", gameInvitesFrom: "all", allowReposts: true });
    expect(await (await call(session, "PUT", "/v1/me/privacy", { keptVisibility: "me" })).json()).toMatchObject({ keptVisibility: "me", showOnline: true });

    expect((await call(session, "DELETE", "/v1/me")).status).toBe(204);
    expect((await call(session, "GET", "/v1/me")).status).toBe(401);
    const again = await signIn({ id: "to-delete", username: "niloofar" }); // a new account
    expect(((await (await call(again, "GET", "/v1/me")).json()) as { avatar: unknown }).avatar).toBeNull();
  });

  it("refuses the divan when it is told to, for the sign-out warning", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    const session = await signIn({ username: "niloofar", syncFails: true });
    expect((await call(session, "GET", "/v1/me/divan")).status).toBe(503);
    expect((await call(session, "GET", "/v1/me/stats")).status).toBe(200);
  });
});

describe("the types of the contract", () => {
  it("are up to date (pnpm --filter @yebeyt/webapp api:types)", () => {
    expect(() => execFileSync("node", ["scripts/api-types.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  }, 20_000);
});
