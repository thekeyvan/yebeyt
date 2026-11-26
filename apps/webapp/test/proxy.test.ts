import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/[...path]/route";
import { upstreamPath } from "../lib/api/proxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("what the /api proxy lets through (GET only: the list of poet pictures and one picture)", () => {
  it("allows the list and a picture", () => {
    expect(upstreamPath(["v1", "poets", "pictures"])).toBe("/v1/poets/pictures");
    expect(upstreamPath(["v1", "poets", "hafez", "picture"])).toBe("/v1/poets/hafez/picture");
    expect(upstreamPath(["v1", "poets", "a_b-9", "picture"])).toBe("/v1/poets/a_b-9/picture");
  });

  it("refuses every other path", () => {
    for (const path of [[], ["v1"], ["v1", "poets"], ["v1", "me"], ["v1", "poets", "pictures", "x"], ["v2", "poets", "pictures"], ["v1", "poets", "hafez", "picture", "x"], ["v1", "poets", "hafez"]]) {
      expect(upstreamPath(path), path.join("/")).toBeUndefined();
    }
  });

  it("refuses slugs that are not plain (upper case, dots, slashes, too long)", () => {
    for (const slug of ["Hafez", "..", ".", "a.b", "a/b", "../..", "..%2f..", "a b", "", "x".repeat(41), "حافظ", "a\\b", "a?b", "a#b"]) {
      expect(upstreamPath(["v1", "poets", slug, "picture"]), slug).toBeUndefined();
    }
  });

  it("refuses traversal in any segment", () => {
    expect(upstreamPath(["v1", "poets", "..", "pictures"])).toBeUndefined();
    expect(upstreamPath(["v1", "..", "me"])).toBeUndefined();
    expect(upstreamPath(["v1", "poets", "hafez", ".."])).toBeUndefined();
    expect(upstreamPath(["v1", "poets", "hafez", "%2e%2e"])).toBeUndefined();
    expect(upstreamPath(["v1/poets", "pictures"])).toBeUndefined();
  });
});

const call = (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://localhost");
  const segments = url.pathname.split("/").slice(2).map(decodeURIComponent);
  return GET(new Request(url, init), { params: Promise.resolve({ path: segments }) });
};

describe("the proxy route", () => {
  it("passes a picture on from API_URL with its ETag, cache control and type, and sends only the version", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    const upstream = vi.fn(async () => new Response("png", { headers: { etag: '"abc"', "cache-control": "public, max-age=86400", "content-type": "image/png", "set-cookie": "x=1" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await call("/api/v1/poets/hafez/picture?v=ab12&evil=1", { headers: { "if-none-match": '"abc"', cookie: "session=1" } });
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/v1/poets/hafez/picture?v=ab12");
    expect(new Headers(init.headers).get("if-none-match")).toBe('"abc"');
    expect(new Headers(init.headers).get("cookie")).toBeNull();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("manual");
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"abc"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("png");
  });

  it("uses the Railway address when API_URL is not set", async () => {
    vi.stubEnv("API_URL", "");
    const upstream = vi.fn(async (_url: string) => Response.json([]));
    vi.stubGlobal("fetch", upstream);
    await call("/api/v1/poets/pictures");
    expect(upstream.mock.calls[0]![0]).toBe("https://server-production-98f46b7e.up.railway.app/v1/poets/pictures");
  });

  it("answers 404 without asking the server for a path that is not allowed", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await call("/api/v1/me")).status).toBe(404);
    expect((await call("/api/v1/poets/%2e%2e/picture")).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not follow a redirect of the server: it is a 502, not another address", async () => {
    const upstream = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://evil.example/x" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await call("/api/v1/poets/hafez/picture");
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("answers 502 when the server cannot be reached or fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect((await call("/api/v1/poets/pictures")).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect((await call("/api/v1/poets/pictures")).status).toBe(502);
  });

  it("passes on a 304 and a 404 of the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 304, headers: { etag: '"abc"' } })));
    expect((await call("/api/v1/poets/hafez/picture")).status).toBe(304);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404, headers: { "content-type": "application/json" } })));
    expect((await call("/api/v1/poets/nobody/picture")).status).toBe(404);
  });
});
