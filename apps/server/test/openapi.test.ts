import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { openApiDocument, renderOpenApi } from "../src/openapi.js";
import { makeHarness, type Harness } from "./helpers.js";

describe("OpenAPI document", () => {
  it("is stable between runs", () => {
    expect(renderOpenApi()).toBe(renderOpenApi());
  });

  it("matches the committed packages/api/openapi.json", () => {
    const committed = readFileSync(fileURLToPath(new URL("../../../packages/api/openapi.json", import.meta.url)), "utf8");
    expect(renderOpenApi()).toBe(committed);
  });

  it("describes every endpoint", () => {
    const paths = Object.keys(openApiDocument().paths ?? {}).sort();
    expect(paths).toEqual([
      "/health",
      "/v1/admin/feedback",
      "/v1/admin/feedback/{id}/recording",
      "/v1/admin/feedback/{id}/screenshot",
      "/v1/admin/poets/{slug}/picture",
      "/v1/admin/reports",
      "/v1/auth/apple",
      "/v1/auth/google",
      "/v1/auth/logout",
      "/v1/auth/refresh",
      "/v1/blocks/{username}",
      "/v1/challenges",
      "/v1/challenges/{code}",
      "/v1/challenges/{code}/results",
      "/v1/conversations",
      "/v1/conversations/{id}/messages",
      "/v1/conversations/{id}/read",
      "/v1/daily",
      "/v1/daily/{date}/friends",
      "/v1/feed",
      "/v1/feedback",
      "/v1/feedback/{id}/recording",
      "/v1/feedback/{id}/screenshot",
      "/v1/friend-requests/{username}",
      "/v1/friend-requests/{username}/accept",
      "/v1/friend-requests/{username}/reject",
      "/v1/friends/{username}",
      "/v1/games",
      "/v1/games/by-code/{code}/join",
      "/v1/games/{id}",
      "/v1/games/{id}/join",
      "/v1/games/{id}/moves",
      "/v1/games/{id}/resign",
      "/v1/leaderboard/friends",
      "/v1/leaderboard/global",
      "/v1/leaderboard/league",
      "/v1/me",
      "/v1/me/avatar",
      "/v1/me/blocks",
      "/v1/me/challenges",
      "/v1/me/divan",
      "/v1/me/friend-requests",
      "/v1/me/friends",
      "/v1/me/games",
      "/v1/me/privacy",
      "/v1/me/profile",
      "/v1/me/progress",
      "/v1/me/reactions",
      "/v1/me/stats",
      "/v1/me/unread",
      "/v1/me/username",
      "/v1/messages/{id}",
      "/v1/poets/pictures",
      "/v1/poets/{slug}/picture",
      "/v1/public/games/{code}",
      "/v1/public/users/{username}",
      "/v1/reactions/counts",
      "/v1/reactions/{kind}",
      "/v1/reports",
      "/v1/scores",
      "/v1/shared-divans",
      "/v1/shared-divans/{id}/items",
      "/v1/shared-divans/{id}/items/{itemId}",
      "/v1/shared-divans/{id}/items/{itemId}/like",
      "/v1/usernames/check",
      "/v1/usernames/suggestions",
      "/v1/users/search",
      "/v1/users/{username}",
    ]);
  });
});

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

describe("health", () => {
  it("answers ok with the database up", async () => {
    const res = await h.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("logging and errors", () => {
  it("logs one line per request: method, route, status, ms", async () => {
    await h.request("/health");
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatch(/^GET \/health 200 \d+ms$/);
  });

  it("never logs tokens, usernames, bodies or the query", async () => {
    const idToken = await h.googleToken("secret-sub-123");
    const session = await (await h.request("/v1/auth/google", { method: "POST", json: { idToken } })).json();
    await h.request("/v1/me/username", { method: "PUT", token: session.accessToken, json: { username: "private_name" } });
    await h.request("/v1/usernames/check?u=private_name", { token: session.accessToken });
    await h.request("/v1/auth/refresh", { method: "POST", json: { refreshToken: session.refreshToken } });
    await h.request("/v1/poets/hafez/picture?x=1", { headers: { "x-forwarded-for": "203.0.113.9" } });
    const all = h.logs.join("\n");
    for (const secret of [idToken, session.accessToken, session.refreshToken, "secret-sub-123", "private_name", "203.0.113.9", session.user.id]) {
      expect(all).not.toContain(secret);
    }
    expect(h.logs.every((l) => /^[A-Z]+ \S+ \d{3} \d+ms$/.test(l))).toBe(true);
    expect(h.logs.some((l) => /^GET \/v1\/poets\/:slug\/picture 404 /.test(l))).toBe(true);
  });

  it("refuses request bodies over 64 KB with 413 payload_too_large", async () => {
    const big = { idToken: "x".repeat(70 * 1024) };
    for (const path of ["/v1/auth/google", "/v1/auth/refresh"]) {
      const res = await h.request(path, { method: "POST", json: big });
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: "payload_too_large" });
    }
    const small = await h.request("/v1/auth/google", { method: "POST", json: { idToken: "x".repeat(60 * 1024) } });
    expect(small.status).toBe(400); // passes the size limit, fails validation (max 8192)
  });

  it("answers unknown routes with a JSON 404 and failures without details", async () => {
    const res = await h.request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });

    const broken = {
      ...h.deps,
      db: { execute: () => Promise.reject(new Error("select token=abc")), select: () => { throw new Error("params: secret-value"); } },
    } as never;
    const { createApp } = await import("../src/app.js");
    const sick = await createApp(broken).request("/health");
    expect(sick.status).toBe(503);
    expect(await sick.json()).toEqual({ error: "unavailable" });

    h.logs.length = 0;
    const bad = await createApp(broken).request("/v1/poets/pictures");
    expect(bad.status).toBe(500);
    expect(await bad.json()).toEqual({ error: "internal_error" });
    expect(h.logs.join("\n")).not.toContain("secret-value");
  });
});
