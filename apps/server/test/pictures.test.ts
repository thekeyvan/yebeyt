import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const image = (seed: number) => new Uint8Array(Array.from({ length: 300 }, (_, i) => (i * seed) % 256));
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const upload = (slug: string, bytes: Uint8Array, opts: { token?: string; type?: string; query?: string } = {}) =>
  h.request(`/v1/admin/poets/${slug}/picture${opts.query ?? "?width=512&height=512"}`, {
    method: "PUT",
    token: opts.token ?? h.deps.config.adminToken,
    headers: { "content-type": opts.type ?? "image/jpeg" },
    body: bytes as unknown as BodyInit,
  });

describe("poet pictures", () => {
  it("lists nothing at first", async () => {
    const res = await h.request("/v1/poets/pictures");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("stores a picture and lists it with a version", async () => {
    const bytes = image(7);
    const res = await upload("hafez", bytes);
    expect(res.status).toBe(200);
    const version = sha(bytes).slice(0, 12);
    expect(await res.json()).toEqual({ slug: "hafez", version });
    await upload("moulavi", image(3), { type: "image/webp" });
    const list = await (await h.request("/v1/poets/pictures")).json();
    expect(list).toEqual([
      { slug: "hafez", version, url: `/v1/poets/hafez/picture?v=${version}` },
      { slug: "moulavi", version: sha(image(3)).slice(0, 12), url: `/v1/poets/moulavi/picture?v=${sha(image(3)).slice(0, 12)}` },
    ]);
  });

  it("serves the bytes with ETag and a day of caching, and answers 304", async () => {
    const bytes = image(7);
    await upload("hafez", bytes);
    const res = await h.request("/v1/poets/hafez/picture");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const etag = res.headers.get("etag")!;
    expect(etag).toBe(`"${sha(bytes)}"`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);

    for (const header of [etag, `W/${etag}`, `"other", ${etag}`, "*"]) {
      const cached = await h.request("/v1/poets/hafez/picture", { headers: { "if-none-match": header } });
      expect(cached.status).toBe(304);
      expect(cached.headers.get("etag")).toBe(etag);
      expect(cached.headers.get("x-content-type-options")).toBe("nosniff");
      expect(await cached.text()).toBe("");
    }
    const stale = await h.request("/v1/poets/hafez/picture", { headers: { "if-none-match": '"old"' } });
    expect(stale.status).toBe(200);
  });

  it("replaces a picture and changes its version", async () => {
    await upload("hafez", image(7));
    const next = image(9);
    await upload("hafez", next);
    const [entry] = await (await h.request("/v1/poets/pictures")).json();
    expect(entry.version).toBe(sha(next).slice(0, 12));
    expect(new Uint8Array(await (await h.request("/v1/poets/hafez/picture")).arrayBuffer())).toEqual(next);
  });

  it("answers 404 for a poet without a picture", async () => {
    const res = await h.request("/v1/poets/saadi/picture");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("needs the admin token", async () => {
    for (const token of [undefined, "wrong-token"]) {
      const res = await h.request("/v1/admin/poets/hafez/picture?width=1&height=1", {
        method: "PUT",
        token,
        headers: { "content-type": "image/jpeg" },
        body: image(1) as unknown as BodyInit,
      });
      expect(res.status).toBe(401);
    }
    // a user's access token is not an admin token
    const s = await h.signIn();
    expect((await upload("hafez", image(1), { token: s.accessToken })).status).toBe(401);
    expect(await (await h.request("/v1/poets/pictures")).json()).toEqual([]);
  });

  it("accepts an upload larger than the 64 KB JSON limit", async () => {
    expect((await upload("hafez", new Uint8Array(200 * 1024).fill(7))).status).toBe(200);
  });

  it("rejects wrong types, sizes, slugs and missing dimensions", async () => {
    expect((await upload("hafez", image(1), { type: "text/plain" })).status).toBe(415);
    expect((await upload("hafez", new Uint8Array(0))).status).toBe(400);
    const tooBig = await upload("hafez", new Uint8Array(15 * 1024 * 1024 + 1));
    expect(tooBig.status).toBe(413);
    expect(await tooBig.json()).toEqual({ error: "payload_too_large" });
    expect((await upload("Bad Slug", image(1))).status).toBe(400);
    expect((await upload("hafez", image(1), { query: "" })).status).toBe(400);
    expect(await (await h.request("/v1/poets/pictures")).json()).toEqual([]);
  });
});
