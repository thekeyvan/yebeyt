import { describe, expect, it } from "vitest";
import { createBff, type Call, type Upstream } from "../lib/api/bff";
import { maxScreenshotBytes, maxRecordingBytes, upstreamRoute } from "../lib/api/proxy";

const id = "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6f";
const route = (method: string, path: string, query = "") => upstreamRoute(method, path.split("/").filter(Boolean), new URLSearchParams(query));
const MB = 1024 * 1024;

describe("what the /api door lets through for feedback (W9)", () => {
  it("lets the report through, with the session when there is one (a guest's goes without)", () => {
    expect(route("POST", "v1/feedback", "x=1")).toEqual({ path: "/v1/feedback", auth: "optional" });
  });

  it("lets the two uploads through with no session (the upload token is their key), each with its types and its size", () => {
    expect(route("PUT", `v1/feedback/${id}/screenshot`)).toEqual({ path: `/v1/feedback/${id}/screenshot`, auth: false, upload: { types: ["image/jpeg", "image/png"], maxBytes: 3 * MB } });
    expect(route("PUT", `v1/feedback/${id}/recording`)).toEqual({ path: `/v1/feedback/${id}/recording`, auth: false, upload: { types: ["video/mp4"], maxBytes: 25 * MB } });
    expect([maxScreenshotBytes, maxRecordingBytes]).toEqual([3 * MB, 25 * MB]);
  });

  it("lets nothing else of it through: no reading, no other method, no other file, no admin", () => {
    for (const [method, path] of [
      ["GET", "v1/feedback"], ["PUT", "v1/feedback"], ["DELETE", "v1/feedback"], ["GET", `v1/feedback/${id}`], ["POST", `v1/feedback/${id}`],
      ["POST", `v1/feedback/${id}/screenshot`], ["GET", `v1/feedback/${id}/screenshot`], ["DELETE", `v1/feedback/${id}/recording`], ["PUT", `v1/feedback/${id}/other`],
      ["PUT", `v1/feedback/${id}/screenshot/extra`], ["GET", "v1/admin/feedback"], ["GET", `v1/admin/feedback/${id}/screenshot`], ["PUT", `v1/admin/feedback/${id}/screenshot`],
    ] as const) {
      expect(route(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("checks the id of the report: a UUID, and nothing that moves the path", () => {
    for (const bad of ["..", ".", "a/b", "a b", "", "g1", "6f1c2b9e", "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6", `${id}x`, "%2e%2e", "حافظ", "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6f?x"]) {
      expect(upstreamRoute("PUT", ["v1", "feedback", bad, "screenshot"], new URLSearchParams()), bad).toBeUndefined();
      expect(upstreamRoute("PUT", ["v1", "feedback", bad, "recording"], new URLSearchParams()), bad).toBeUndefined();
    }
  });
});

const origin = "https://app.yebeyt.com";
const calls = (): { calls: Call[]; send: Upstream; answer: Response } => {
  const seen: Call[] = [];
  const out = { calls: seen, answer: new Response(null, { status: 204 }), send: (async (call) => (seen.push(call), out.answer.clone())) as Upstream };
  return out;
};
const put = (path: string, body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request(`${origin}${path}`, { method: "PUT", headers: { host: "app.yebeyt.com", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin", ...headers }, body, ...(body ? { duplex: "half" } : {}) } as RequestInit);
const proxy = (bff: ReturnType<typeof createBff>, request: Request) => bff.proxy(request, new URL(request.url).pathname.split("/").slice(2));
const shotPath = `/api/v1/feedback/${id}/screenshot`;
const filmPath = `/api/v1/feedback/${id}/recording`;
const token = { "x-upload-token": "tok_1-A" };

describe("uploads through the door", () => {
  it("passes the file with its type and the upload token, and nothing of the session", async () => {
    const up = calls();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const response = await proxy(createBff(up.send), put(shotPath, bytes, { "content-type": "image/jpeg", cookie: "yb_access=a; yb_refresh=r", ...token }));
    expect(response.status).toBe(204);
    expect(up.calls).toHaveLength(1);
    const [call] = up.calls;
    expect([call!.method, call!.path, call!.credential, call!.headers]).toEqual(["PUT", `/v1/feedback/${id}/screenshot`, undefined, { "x-upload-token": "tok_1-A" }]);
    expect(call!.file?.type).toBe("image/jpeg");
    expect([...call!.file!.bytes]).toEqual([...bytes]);
  });

  it("takes a recording of up to 25 MB and a screenshot of up to 3 MB, and not a byte more", async () => {
    const mp4 = (size: number) => put(filmPath, new Uint8Array(size), { "content-type": "video/mp4", ...token });
    const jpeg = (size: number) => put(shotPath, new Uint8Array(size), { "content-type": "image/jpeg", ...token });
    expect((await proxy(createBff(calls().send), mp4(25 * MB))).status).toBe(204);
    expect((await proxy(createBff(calls().send), mp4(25 * MB + 1))).status).toBe(413);
    expect((await proxy(createBff(calls().send), jpeg(3 * MB))).status).toBe(204);
    expect((await proxy(createBff(calls().send), jpeg(3 * MB + 1))).status).toBe(413);
  });

  it("cuts a body that says it is small and is not, and does not ask the server", async () => {
    const up = calls();
    const big = new Uint8Array(3 * MB + 10);
    const lying = put(shotPath, big, { "content-type": "image/jpeg", ...token });
    lying.headers.set("content-length", "10");
    expect((await proxy(createBff(up.send), lying)).status).toBe(413);
    expect(up.calls).toEqual([]);
  });

  it("the 1 MB cap of the other bodies stays: a big file is only for these two paths", async () => {
    const up = calls();
    const request = new Request(`${origin}/api/v1/feedback`, { method: "POST", headers: { host: "app.yebeyt.com", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: "x".repeat(MB + 1) });
    expect((await proxy(createBff(up.send), request)).status).toBe(413);
    expect(up.calls).toEqual([]);
  });

  it("refuses another type for the file, a missing or odd token and an empty file, without asking the server", async () => {
    const up = calls();
    const bff = createBff(up.send);
    expect((await proxy(bff, put(shotPath, new Uint8Array(4), { "content-type": "video/mp4", ...token }))).status).toBe(415);
    expect((await proxy(bff, put(filmPath, new Uint8Array(4), { "content-type": "image/jpeg", ...token }))).status).toBe(415);
    expect((await proxy(bff, put(shotPath, new Uint8Array(4), { "content-type": "text/html", ...token }))).status).toBe(415);
    expect((await proxy(bff, put(shotPath, new Uint8Array(4), { "content-type": "image/jpeg" }))).status).toBe(403);
    expect((await proxy(bff, put(shotPath, new Uint8Array(4), { "content-type": "image/jpeg", "x-upload-token": "a b" }))).status).toBe(403);
    expect((await proxy(bff, put(shotPath, new Uint8Array(0), { "content-type": "image/jpeg", ...token }))).status).toBe(400);
    expect(up.calls).toEqual([]);
  });

  it("keeps CSRF on: a file from another site is refused", async () => {
    const up = calls();
    const request = put(shotPath, new Uint8Array(4), { "content-type": "image/jpeg", ...token, "sec-fetch-site": "cross-site" });
    expect((await proxy(createBff(up.send), request)).status).toBe(403);
    expect(up.calls).toEqual([]);
  });

  it("passes the server's refusals on, a busy server with its Retry-After, and anything else that is wrong as a bad gateway", async () => {
    const send = (response: Response): Upstream => async () => response;
    const ask = (response: Response) => proxy(createBff(send(response)), put(shotPath, new Uint8Array(4), { "content-type": "image/jpeg", ...token }));
    expect((await ask(Response.json({ error: "already_uploaded" }, { status: 409 }))).status).toBe(409);
    expect((await ask(Response.json({ error: "rate_limited" }, { status: 429 }))).status).toBe(429);
    const busy = await ask(Response.json({ error: "busy" }, { status: 503, headers: { "retry-after": "5" } }));
    expect([busy.status, busy.headers.get("retry-after"), await busy.json()]).toEqual([503, "5", { error: "busy" }]);
    expect((await ask(new Response("boom", { status: 500 }))).status).toBe(502);
  });
});
