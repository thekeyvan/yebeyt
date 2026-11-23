import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const DEFAULTS = {
  keptVisibility: "friends",
  dailyVisibility: "friends",
  showOnline: true,
  inGlobalLeaderboard: false,
  messagesFrom: "friends",
  gameInvitesFrom: "all",
  allowReposts: true,
};
const put = (token: string, json: unknown) => h.request("/v1/me/privacy", { method: "PUT", token, json });
const get = async (token: string) => (await h.request("/v1/me/privacy", { token })).json();

describe("privacy", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/me/privacy")).status).toBe(401);
    expect((await h.request("/v1/me/privacy", { method: "PUT", json: {} })).status).toBe(401);
  });

  it("returns the defaults before anything is stored", async () => {
    const { accessToken } = await h.signIn();
    expect(await get(accessToken)).toEqual(DEFAULTS);
  });

  it("changes only the fields sent", async () => {
    const { accessToken } = await h.signIn();
    const res = await put(accessToken, { keptVisibility: "me", inGlobalLeaderboard: true });
    expect(res.status).toBe(200);
    const expected = { ...DEFAULTS, keptVisibility: "me", inGlobalLeaderboard: true };
    expect(await res.json()).toEqual(expected);
    const next = await put(accessToken, { messagesFrom: "all", showOnline: false });
    expect(await next.json()).toEqual({ ...expected, messagesFrom: "all", showOnline: false });
    expect(await get(accessToken)).toEqual({ ...expected, messagesFrom: "all", showOnline: false });
  });

  it("accepts an empty object and returns the settings unchanged", async () => {
    const { accessToken } = await h.signIn();
    expect(await (await put(accessToken, {})).json()).toEqual(DEFAULTS);
    await put(accessToken, { allowReposts: false });
    expect(await (await put(accessToken, {})).json()).toEqual({ ...DEFAULTS, allowReposts: false });
  });

  it("keeps each user's settings apart", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    await put(a.accessToken, { dailyVisibility: "me" });
    expect(await get(b.accessToken)).toEqual(DEFAULTS);
  });

  it("rejects values outside the enums, wrong types and unknown fields", async () => {
    const { accessToken } = await h.signIn();
    for (const bad of [
      { keptVisibility: "all" },
      { dailyVisibility: "everyone" },
      { messagesFrom: "me" },
      { gameInvitesFrom: "me" },
      { showOnline: "yes" },
      { allowReposts: null },
      { other: true },
    ]) {
      const res = await put(accessToken, bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });
});
