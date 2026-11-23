import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const avatar = { face: "round-1", eyes: "happy", hair: "curly-3", mouth: "smile", accessory: "none", background: "sun" };
const put = (token: string, json: unknown) => h.request("/v1/me/avatar", { method: "PUT", token, json });

describe("avatar", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/me/avatar", { method: "PUT", json: avatar })).status).toBe(401);
  });

  it("is null until set", async () => {
    const { accessToken } = await h.signIn();
    expect((await (await h.request("/v1/me", { token: accessToken })).json()).avatar).toBeNull();
  });

  it("is stored, shown in GET /v1/me and replaced as a whole", async () => {
    const { accessToken } = await h.signIn();
    const res = await put(accessToken, avatar);
    expect(res.status).toBe(200);
    expect((await res.json()).avatar).toEqual(avatar);
    expect((await (await h.request("/v1/me", { token: accessToken })).json()).avatar).toEqual(avatar);
    const next = { ...avatar, hair: "bald" };
    await put(accessToken, next);
    expect((await (await h.request("/v1/me", { token: accessToken })).json()).avatar).toEqual(next);
  });

  it("rejects missing, malformed, long or extra fields", async () => {
    const { accessToken } = await h.signIn();
    const { face: _face, ...missing } = avatar;
    for (const bad of [
      missing,
      { ...avatar, face: "" },
      { ...avatar, face: "Round" },
      { ...avatar, eyes: "a b" },
      { ...avatar, hair: "x".repeat(33) },
      { ...avatar, mouth: 3 },
      { ...avatar, extra: "x" },
    ]) {
      const res = await put(accessToken, bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });
});
