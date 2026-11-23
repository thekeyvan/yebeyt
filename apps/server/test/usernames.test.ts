import { beforeEach, describe, expect, it } from "vitest";
import { normalizeUsername, usernameProblem } from "../src/usernames.js";
import { makeHarness, type Harness } from "./helpers.js";

describe("username rules", () => {
  const cases: [string, string | null][] = [
    ["ali", null],
    ["hafez_fan", null],
    ["a.b.c", null],
    ["user_123", null],
    ["a".repeat(20), null],
    ["a".repeat(21), "too_long"],
    ["ab", "too_short"],
    ["", "too_short"],
    ["1abc", "bad_chars"],
    ["_abc", "bad_chars"],
    [".abc", "bad_chars"],
    ["ab..cd", "bad_chars"],
    ["abc.", "bad_chars"],
    ["ab cd", "bad_chars"],
    ["علی_علی", "bad_chars"],
    ["ab-cd", "bad_chars"],
    ["ABC", "bad_chars"], // rules apply after lower-casing; see normalizeUsername
    ["yebeyt", "reserved"],
    ["admin", "reserved"],
    ["support", "reserved"],
  ];
  it.each(cases)("%s → %s", (name, problem) => {
    expect(usernameProblem(name)).toBe(problem);
  });

  it("normalizes to lower-case", () => {
    expect(normalizeUsername("  Hafez_Fan ")).toBe("hafez_fan");
    expect(usernameProblem(normalizeUsername("ADMIN"))).toBe("reserved");
  });
});

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

describe("username endpoints", () => {
  const check = (token: string, u: string) => h.request(`/v1/usernames/check?u=${encodeURIComponent(u)}`, { token });
  const set = (token: string, username: string) => h.request("/v1/me/username", { method: "PUT", token, json: { username } });

  it("requires sign-in", async () => {
    expect((await h.request("/v1/usernames/check?u=abc")).status).toBe(401);
    expect((await h.request("/v1/usernames/suggestions?base=abc")).status).toBe(401);
  });

  it("checks availability with reasons", async () => {
    const { accessToken } = await h.signIn();
    expect(await (await check(accessToken, "free_name")).json()).toEqual({ available: true });
    expect(await (await check(accessToken, "ab")).json()).toEqual({ available: false, reason: "too_short" });
    expect(await (await check(accessToken, "a".repeat(21))).json()).toEqual({ available: false, reason: "too_long" });
    expect(await (await check(accessToken, "no way")).json()).toEqual({ available: false, reason: "bad_chars" });
    expect(await (await check(accessToken, "Admin")).json()).toEqual({ available: false, reason: "reserved" });
  });

  it("reports taken names, ignoring case", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    expect((await set(a.accessToken, "Hafez_Fan")).status).toBe(200);
    expect(await (await check(b.accessToken, "hafez_fan")).json()).toEqual({ available: false, reason: "taken" });
    expect(await (await check(b.accessToken, "HAFEZ_FAN")).json()).toEqual({ available: false, reason: "taken" });
  });

  it("sets the username stored in lower-case and refuses a taken or bad one", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    const ok = await set(a.accessToken, "Hafez_Fan");
    expect(ok.status).toBe(200);
    expect((await ok.json()).username).toBe("hafez_fan");

    const taken = await set(b.accessToken, "HAFEZ_fan");
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "username_taken" });

    for (const [name, code] of [["ab", "username_too_short"], ["x".repeat(21), "username_too_long"], ["a b", "username_bad_chars"], ["admin", "username_reserved"]] as const) {
      const res = await set(b.accessToken, name);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: code });
    }
  });

  it("allows the first set at any time, then changes only after 30 days", async () => {
    h.clock.time = new Date("2026-06-10T08:00:00Z");
    await h.signIn();
    h.clock.time = new Date("2026-08-01T08:00:00Z"); // long after sign-up: first set is still free
    const first = await (await set((await h.signIn()).accessToken, "first_name")).json();
    expect(first.usernameChangedAt).toBe("2026-08-01T08:00:00.000Z");

    h.clock.time = new Date("2026-08-30T07:59:00Z");
    const token = (await h.signIn()).accessToken; // access token valid at the new time
    const early = await set(token, "second_name");
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: "username_change_too_soon", allowedAt: "2026-08-31T08:00:00.000Z" });

    h.clock.time = new Date("2026-08-31T08:00:00Z");
    const later = await set((await h.signIn()).accessToken, "second_name");
    expect(later.status).toBe(200);
    expect((await later.json()).username).toBe("second_name");
  });

  it("lets only one of two parallel changes through the 30-day rule", async () => {
    const s = await h.signIn();
    await set(s.accessToken, "first_name");
    h.clock.time = new Date(h.clock.time.getTime() + 31 * 24 * 3600 * 1000);
    const token = (await h.signIn()).accessToken;
    const [a, b] = await Promise.all([set(token, "name_one"), set(token, "name_two")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = await (a.status === 409 ? a : b).json();
    expect(loser.error).toBe("username_change_too_soon");
  });

  it("treats setting the same name again as a no-op", async () => {
    const s = await h.signIn();
    await set(s.accessToken, "same_name");
    const again = await set(s.accessToken, "same_name");
    expect(again.status).toBe(200);
  });

  it("suggests up to 5 free, valid names", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    await set(a.accessToken, "hafez");
    const res = await h.request("/v1/usernames/suggestions?base=Hafez", { token: b.accessToken });
    const { suggestions } = (await res.json()) as { suggestions: string[] };
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(new Set(suggestions).size).toBe(suggestions.length);
    for (const s of suggestions) {
      expect(s).not.toBe("hafez");
      expect(s.startsWith("hafez")).toBe(true);
      expect(usernameProblem(s)).toBeNull();
    }
  });

  it("suggests from short or odd bases, and nothing from an unusable one", async () => {
    const s = await h.signIn();
    const get = async (base: string) => ((await (await h.request(`/v1/usernames/suggestions?base=${encodeURIComponent(base)}`, { token: s.accessToken })).json()) as { suggestions: string[] }).suggestions;
    const short = await get("ab");
    expect(short.length).toBeGreaterThan(0);
    short.forEach((n) => expect(usernameProblem(n)).toBeNull());
    const long = await get("x".repeat(40));
    long.forEach((n) => expect(n.length).toBeLessThanOrEqual(20));
    expect(await get("123")).toEqual([]);
    expect(await get("admin")).not.toContain("admin");
  });

  it("limits check and suggestions per user", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    for (let i = 0; i < 60; i++) expect((await check(a.accessToken, "free_name")).status).toBe(200);
    const blocked = await check(a.accessToken, "free_name");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    expect((await check(b.accessToken, "free_name")).status).toBe(200);
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    // a new access token is needed after the clock moved; the limiter window has passed too
    const again = (await h.signIn("g-1")).accessToken;
    expect((await check(again, "free_name")).status).toBe(200);
  });
});
