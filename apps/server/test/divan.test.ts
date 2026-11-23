import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const put = (token: string, items: unknown) => h.request("/v1/me/divan", { method: "PUT", token, json: { items } });
const get = async (token: string) => (await (await h.request("/v1/me/divan", { token })).json()) as { items: unknown[] };

const A = "/hafez/ghazal/sh3#0";
const B = "/saadi/ghazal/sh1#4";
const T1 = "2026-06-01T10:00:00.000Z";
const T2 = "2026-06-01T11:00:00.000Z";
const T3 = "2026-06-01T11:30:00.000Z";

describe("divan", () => {
  it("requires sign-in", async () => {
    expect((await h.request("/v1/me/divan")).status).toBe(401);
    expect((await h.request("/v1/me/divan", { method: "PUT", json: { items: [] } })).status).toBe(401);
  });

  it("starts empty", async () => {
    const { accessToken } = await h.signIn();
    expect(await get(accessToken)).toEqual({ items: [] });
  });

  it("adds unknown keys and returns the full state", async () => {
    const { accessToken } = await h.signIn();
    const res = await put(accessToken, [{ key: A, keptAt: T1 }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ key: A, keptAt: T1, removedAt: null }] });
    const res2 = await put(accessToken, [{ key: B, removedAt: T2 }]);
    const merged = await res2.json();
    expect(merged).toEqual({
      items: [
        { key: A, keptAt: T1, removedAt: null },
        { key: B, keptAt: null, removedAt: T2 },
      ],
    });
    expect(await get(accessToken)).toEqual(merged);
  });

  it("a newer keep wins over an older keep and removal", async () => {
    const { accessToken } = await h.signIn();
    await put(accessToken, [{ key: A, keptAt: T1, removedAt: T2 }]);
    const res = await put(accessToken, [{ key: A, keptAt: T3 }]);
    expect(await res.json()).toEqual({ items: [{ key: A, keptAt: T3, removedAt: T2 }] });
  });

  it("a newer removal wins and an older one does not", async () => {
    const { accessToken } = await h.signIn();
    await put(accessToken, [{ key: A, keptAt: T2 }]);
    const newer = await put(accessToken, [{ key: A, removedAt: T3 }]);
    expect(await newer.json()).toEqual({ items: [{ key: A, keptAt: T2, removedAt: T3 }] });
    const older = await put(accessToken, [{ key: A, removedAt: T1 }]);
    expect(await older.json()).toEqual({ items: [{ key: A, keptAt: T2, removedAt: T3 }] });
  });

  it("is idempotent", async () => {
    const { accessToken } = await h.signIn();
    const items = [{ key: A, keptAt: T1 }, { key: B, keptAt: T1, removedAt: T2 }];
    const first = await (await put(accessToken, items)).json();
    expect(await (await put(accessToken, items)).json()).toEqual(first);
  });

  it("merges two devices", async () => {
    const { accessToken } = await h.signIn();
    await put(accessToken, [{ key: A, keptAt: T1 }, { key: B, keptAt: T1 }]); // phone 1
    const res = await put(accessToken, [{ key: A, removedAt: T2 }, { key: B, keptAt: T1 }, { key: "/rumi/ghazal/sh9#2", keptAt: T3 }]); // phone 2
    expect(await res.json()).toEqual({
      items: [
        { key: A, keptAt: T1, removedAt: T2 },
        { key: "/rumi/ghazal/sh9#2", keptAt: T3, removedAt: null },
        { key: B, keptAt: T1, removedAt: null },
      ],
    });
  });

  it("merges repeated keys inside one request", async () => {
    const { accessToken } = await h.signIn();
    const res = await put(accessToken, [{ key: A, keptAt: T2 }, { key: A, keptAt: T1, removedAt: T3 }]);
    expect(await res.json()).toEqual({ items: [{ key: A, keptAt: T2, removedAt: T3 }] });
  });

  it("keeps each user's divan apart", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    await put(a.accessToken, [{ key: A, keptAt: T1 }]);
    expect(await get(b.accessToken)).toEqual({ items: [] });
  });

  it("accepts an empty list and timestamps up to five minutes ahead", async () => {
    const { accessToken } = await h.signIn();
    expect((await put(accessToken, [])).status).toBe(200);
    const ok = new Date(h.clock.time.getTime() + 5 * 60_000).toISOString();
    expect((await put(accessToken, [{ key: A, keptAt: ok }])).status).toBe(200);
  });

  it("refuses timestamps more than five minutes ahead", async () => {
    const { accessToken } = await h.signIn();
    const late = new Date(h.clock.time.getTime() + 5 * 60_000 + 1000).toISOString();
    for (const item of [{ key: A, keptAt: late }, { key: A, removedAt: late }]) {
      const res = await put(accessToken, [item]);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_timestamp" });
    }
    expect(await get(accessToken)).toEqual({ items: [] });
  });

  it("rejects bad keys, bad dates and too many items", async () => {
    const { accessToken } = await h.signIn();
    const bad: unknown[] = [
      [{ key: "hafez/ghazal/sh3#0", keptAt: T1 }],
      [{ key: "/Hafez/ghazal/sh3#0", keptAt: T1 }],
      [{ key: "/hafez/ghazal/sh3", keptAt: T1 }],
      [{ key: "/hafez#123456", keptAt: T1 }],
      [{ key: "/hafez#", keptAt: T1 }],
      [{ key: "/" + "a".repeat(200) + "#0", keptAt: T1 }],
      [{ key: A, keptAt: "yesterday" }],
      [{ key: A, extra: 1 }],
      Array.from({ length: 2001 }, (_, i) => ({ key: `/p/x#${i}`, keptAt: T1 })),
    ];
    for (const items of bad) {
      const res = await put(accessToken, items);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    expect((await h.request("/v1/me/divan", { method: "PUT", token: accessToken, json: {} })).status).toBe(400);
  });

  it("takes 2000 items in one request", async () => {
    const { accessToken } = await h.signIn();
    const items = Array.from({ length: 2000 }, (_, i) => ({ key: `/hafez/ghazal/sh${i}#${i % 20}`, keptAt: T1, removedAt: T2 }));
    const res = await put(accessToken, items);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items).toHaveLength(2000);
  });

  it("limits the body", async () => {
    const { accessToken } = await h.signIn();
    const res = await h.request("/v1/me/divan", { method: "PUT", token: accessToken, json: { items: [], pad: "x".repeat(1_100_000) } });
    expect(res.status).toBe(413);
  });
});
