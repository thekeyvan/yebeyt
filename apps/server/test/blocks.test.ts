import { beforeEach, describe, expect, it } from "vitest";
import { reports } from "../src/db/schema.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const befriend = async (a: { token: string }, b: { token: string; username: string }, a2: { username: string }) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a2.username}`, { method: "PUT", token: b.token });
};

describe("blocks", () => {
  it("needs a sign-in and a username", async () => {
    expect((await h.request("/v1/blocks/sara", { method: "PUT" })).status).toBe(401);
    expect((await h.request("/v1/me/blocks")).status).toBe(401);
    const nameless = await h.signIn("nameless");
    const res = await h.request("/v1/blocks/sara", { method: "PUT", token: nameless.accessToken });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "username_required" });
  });

  it("blocks idempotently, lists, and unblocks", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "Sara" });
    expect((await h.request("/v1/blocks/Sara", { method: "PUT", token: ali.token })).status).toBe(204);
    expect((await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token })).status).toBe(204);
    const list = await h.request("/v1/me/blocks", { token: ali.token });
    expect(await list.json()).toEqual({ items: [{ username: "sara", displayName: "Sara", avatar: null }], nextCursor: null });
    expect(((await (await h.request("/v1/me/blocks", { token: sara.token })).json()) as { items: unknown[] }).items).toEqual([]);
    expect((await h.request("/v1/blocks/sara", { method: "DELETE", token: ali.token })).status).toBe(204);
    expect((await h.request("/v1/blocks/sara", { method: "DELETE", token: ali.token })).status).toBe(204);
    expect(((await (await h.request("/v1/me/blocks", { token: ali.token })).json()) as { items: unknown[] }).items).toEqual([]);
  });

  it("refuses yourself and unknown people", async () => {
    const ali = await h.signUp("ali");
    expect((await h.request("/v1/blocks/ali", { method: "PUT", token: ali.token })).status).toBe(400);
    expect((await h.request("/v1/blocks/nobody", { method: "PUT", token: ali.token })).status).toBe(404);
    expect((await h.request("/v1/blocks/nobody", { method: "DELETE", token: ali.token })).status).toBe(404);
  });

  it("pages the list, newest first", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 52; i++) {
      const u = await h.signUp(`user${String(i).padStart(2, "0")}`);
      h.clock.time = new Date(h.clock.time.getTime() + 1000);
      await h.request(`/v1/blocks/${u.username}`, { method: "PUT", token: ali.token });
    }
    const first = (await (await h.request("/v1/me/blocks", { token: ali.token })).json()) as { items: { username: string }[]; nextCursor: string };
    expect(first.items).toHaveLength(50);
    expect(first.items[0]!.username).toBe("user51");
    const second = (await (await h.request(`/v1/me/blocks?cursor=${encodeURIComponent(first.nextCursor)}`, { token: ali.token })).json()) as { items: unknown[]; nextCursor: null };
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  it("removes follows both ways and stops new ones", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara, ali);
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    expect(((await (await h.request("/v1/me/following", { token: ali.token })).json()) as { items: unknown[] }).items).toEqual([]);
    expect(((await (await h.request("/v1/me/following", { token: sara.token })).json()) as { items: unknown[] }).items).toEqual([]);
    expect((await h.request("/v1/follows/sara", { method: "PUT", token: ali.token })).status).toBe(404);
    expect((await h.request("/v1/follows/ali", { method: "PUT", token: sara.token })).status).toBe(404);
    await h.request("/v1/blocks/sara", { method: "DELETE", token: ali.token });
    expect((await h.request("/v1/follows/ali", { method: "PUT", token: sara.token })).status).toBe(200);
  });

  it("hides the two from each other's profile and search", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const search = async (token: string, q: string) => ((await (await h.request(`/v1/users/search?q=${q}`, { token })).json()) as { items: unknown[] }).items;
    expect(await search(sara.token, "al")).toHaveLength(1);
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    expect((await h.request("/v1/users/sara", { token: ali.token })).status).toBe(404);
    expect((await h.request("/v1/users/ali", { token: sara.token })).status).toBe(404);
    expect(await search(ali.token, "sa")).toEqual([]);
    expect(await search(sara.token, "al")).toEqual([]);
    await h.request("/v1/blocks/sara", { method: "DELETE", token: ali.token });
    expect((await h.request("/v1/users/sara", { token: ali.token })).status).toBe(200);
  });
});

describe("reports", () => {
  it("files a report of a person and lists it for the admin", async () => {
    const ali = await h.signUp("ali");
    await h.signUp("sara");
    const res = await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "sara", reason: "spam", note: "sends links" } });
    expect(res.status).toBe(204);
    const list = await h.request("/v1/admin/reports", { headers: { authorization: "Bearer admin-token-for-tests" } });
    const body = (await list.json()) as { items: Record<string, unknown>[]; nextBefore: null };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ reporter: "ali", target: "sara", reason: "spam", note: "sends links", message: null });
    expect(body.nextBefore).toBeNull();
  });

  it("needs a sign-in, a username, a known person and a valid body", async () => {
    const ali = await h.signUp("ali");
    const json = { username: "ali", reason: "spam" };
    expect((await h.request("/v1/reports", { method: "POST", json })).status).toBe(401);
    expect((await h.request("/v1/reports", { method: "POST", token: (await h.signIn("x")).accessToken, json })).status).toBe(403);
    expect((await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "nobody", reason: "spam" } })).status).toBe(404);
    expect((await h.request("/v1/reports", { method: "POST", token: ali.token, json })).status).toBe(400); // yourself
    await h.signUp("sara");
    for (const bad of [{ reason: "bad" }, { note: "x".repeat(501) }, { reason: undefined }]) {
      const res = await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "sara", reason: "spam", ...bad } });
      expect(res.status).toBe(400);
    }
  });

  it("limits reports to 10 a minute", async () => {
    const ali = await h.signUp("ali");
    await h.signUp("sara");
    const send = () => h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "sara", reason: "other" } });
    for (let i = 0; i < 10; i++) expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(429);
  });

  it("the admin list needs the admin token and pages newest first", async () => {
    expect((await h.request("/v1/admin/reports")).status).toBe(401);
    expect((await h.request("/v1/admin/reports", { token: "wrong" })).status).toBe(401);
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    for (let i = 0; i < 52; i++) {
      h.clock.time = new Date(h.clock.time.getTime() + 1000);
      await h.db.insert(reports).values({ reporterId: ali.id, targetUserId: sara.id, reason: "abuse", createdAt: h.clock.time });
    }
    const auth = { headers: { authorization: "Bearer admin-token-for-tests" } };
    const first = (await (await h.request("/v1/admin/reports", auth)).json()) as { items: unknown[]; nextBefore: string };
    expect(first.items).toHaveLength(50);
    const second = (await (await h.request(`/v1/admin/reports?before=${encodeURIComponent(first.nextBefore)}`, auth)).json()) as { items: unknown[]; nextBefore: null };
    expect(second.items).toHaveLength(2);
    expect(second.nextBefore).toBeNull();
  });
});
