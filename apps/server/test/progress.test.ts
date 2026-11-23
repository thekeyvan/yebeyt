import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const put = (token: string, json: unknown) => h.request("/v1/me/progress", { method: "PUT", token, json });

describe("progress", () => {
  it("starts empty", async () => {
    const { accessToken } = await h.signIn();
    const res = await h.request("/v1/me/progress", { token: accessToken });
    expect(await res.json()).toEqual({ points: 0, streakDays: 0, streakLastDate: null, bestByGame: {} });
  });

  it("requires sign-in", async () => {
    expect((await h.request("/v1/me/progress")).status).toBe(401);
    expect((await h.request("/v1/me/progress", { method: "PUT", json: {} })).status).toBe(401);
  });

  it("stores the first upload and returns it", async () => {
    const { accessToken } = await h.signIn();
    const body = { points: 120, streakDays: 3, streakLastDate: "2026-06-01", bestByGame: { jigsaw: 40, fal: 10 } };
    const res = await put(accessToken, body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(await (await h.request("/v1/me/progress", { token: accessToken })).json()).toEqual(body);
  });

  it("merges keeping the larger of each field", async () => {
    const { accessToken } = await h.signIn();
    await put(accessToken, { points: 120, streakDays: 3, streakLastDate: "2026-06-01", bestByGame: { jigsaw: 40, fal: 10 } });
    const res = await put(accessToken, { points: 50, streakDays: 7, streakLastDate: "2026-05-20", bestByGame: { jigsaw: 25, quiz: 9 } });
    expect(await res.json()).toEqual({
      points: 120,
      streakDays: 7,
      streakLastDate: "2026-06-01",
      bestByGame: { jigsaw: 40, fal: 10, quiz: 9 },
    });
    const nullDate = await put(accessToken, { points: 0, streakDays: 0, streakLastDate: null, bestByGame: {} });
    expect((await nullDate.json()).streakLastDate).toBe("2026-06-01");
  });

  it("keeps each user's progress apart", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    await put(a.accessToken, { points: 9, streakDays: 1, streakLastDate: null, bestByGame: {} });
    expect((await (await h.request("/v1/me/progress", { token: b.accessToken })).json()).points).toBe(0);
  });

  it("rejects bad values", async () => {
    const { accessToken } = await h.signIn();
    const good = { points: 1, streakDays: 1, streakLastDate: "2026-06-01", bestByGame: {} };
    for (const bad of [
      { ...good, points: -1 },
      { ...good, points: 1.5 },
      { ...good, streakLastDate: "2026-13-40" },
      { ...good, streakLastDate: "06/01/2026" },
      { ...good, bestByGame: { "Bad Key": 1 } },
      { ...good, bestByGame: { jigsaw: -4 } },
      { points: 1 },
    ]) {
      const res = await put(accessToken, bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });
});
