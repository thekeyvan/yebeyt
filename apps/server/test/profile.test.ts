import { beforeEach, describe, expect, it } from "vitest";
import { displayNameProblem, normalizeDisplayName } from "../src/profile.js";
import { makeHarness, type Harness } from "./helpers.js";

describe("display name rules", () => {
  const cases: [string, boolean][] = [
    ["علی", true],
    ["Ali Rezaei", true],
    ["a", true],
    ["x".repeat(30), true],
    ["x".repeat(31), false],
    ["", false],
    ["   ", false],
    ["bad\u0000name", false],
    ["tab\tname", false],
    ["line\nbreak", false],
    ["del\u007fname", false],
    ["ok name 😀", true],
  ];
  it.each(cases)("%j → valid %s", (name, valid) => {
    expect(displayNameProblem(normalizeDisplayName(name)) === null).toBe(valid);
  });

  it("trims before measuring", () => {
    expect(normalizeDisplayName("  علی  ")).toBe("علی");
    expect(displayNameProblem(normalizeDisplayName(` ${"x".repeat(30)} `))).toBeNull();
  });
});

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

describe("PUT /v1/me/profile", () => {
  const put = (token: string | undefined, body: unknown) => h.request("/v1/me/profile", { method: "PUT", token, json: body });

  it("requires sign-in", async () => {
    expect((await put(undefined, { displayName: "علی" })).status).toBe(401);
  });

  it("starts with no display name and stores the trimmed one", async () => {
    const s = await h.signIn();
    expect(s.user).toMatchObject({ displayName: null });
    const res = await put(s.accessToken, { displayName: "  علی رضایی " });
    expect(res.status).toBe(200);
    expect((await res.json()).displayName).toBe("علی رضایی");
    const me = await (await h.request("/v1/me", { token: s.accessToken })).json();
    expect(me.displayName).toBe("علی رضایی");
  });

  it("replaces the name", async () => {
    const s = await h.signIn();
    await put(s.accessToken, { displayName: "اول" });
    const res = await put(s.accessToken, { displayName: "دوم" });
    expect((await res.json()).displayName).toBe("دوم");
  });

  it("refuses empty, long and control-character names with invalid_request", async () => {
    const s = await h.signIn();
    for (const displayName of ["", "   ", "x".repeat(31), "a\u0007b", "a\nb"]) {
      const res = await put(s.accessToken, { displayName });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    expect((await put(s.accessToken, {})).status).toBe(400);
    expect((await (await h.request("/v1/me", { token: s.accessToken })).json()).displayName).toBeNull();
  });

  it("is not logged", async () => {
    const s = await h.signIn();
    await put(s.accessToken, { displayName: "private person" });
    expect(h.logs.join("\n")).not.toContain("private person");
  });
});
