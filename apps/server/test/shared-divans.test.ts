import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { messages } from "../src/db/schema.js";
import type { LiveEvent } from "../src/hub.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type User = { token: string; id: string; username: string };
type Item = { id: string; key: string; note: string | null; addedByMe: boolean; createdAt: string; likedByMe: boolean; likedByThem: boolean };
type Counts = { total: number; mine: number; theirs: number };
type ItemPage = { items: Item[]; nextCursor: string | null; counts: Counts };

const befriend = async (a: User, b: User) => {
  await h.befriend(a, b);
};
const pair = async () => {
  const ali = await h.signUp("ali");
  const sara = await h.signUp("sara");
  await befriend(ali, sara);
  const res = await h.request("/v1/shared-divans", { method: "POST", token: ali.token, json: { username: "sara" } });
  return { ali, sara, id: ((await res.json()) as { id: string }).id };
};
const add = (u: User, id: string, key: string, note?: string) => h.request(`/v1/shared-divans/${id}/items`, { method: "POST", token: u.token, json: { key, note } });
const items = async (u: User, id: string, query = "") => (await (await h.request(`/v1/shared-divans/${id}/items${query}`, { token: u.token })).json()) as ItemPage;
const tick = () => (h.clock.time = new Date(h.clock.time.getTime() + 1000));
const listen = (u: User) => {
  const events: LiveEvent[] = [];
  h.deps.hub.add(u.id, (e) => events.push(e));
  return events;
};
const A = "/hafez/ghazal/sh3#0";
const B = "/hafez/ghazal/sh3#1";
const C = "/saadi/ghazal/sh1#4";

describe("POST /v1/shared-divans", () => {
  it("needs a sign-in and a username", async () => {
    expect((await h.request("/v1/shared-divans", { method: "POST", json: { username: "x" } })).status).toBe(401);
    expect((await h.request("/v1/shared-divans")).status).toBe(401);
    const nameless = await h.signIn("nameless");
    const res = await h.request("/v1/shared-divans", { token: nameless.accessToken });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "username_required" });
  });

  it("is only for friends, and returns the same divan for the pair whoever asks", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "Sara" });
    const open = (u: User, username: string) => h.request("/v1/shared-divans", { method: "POST", token: u.token, json: { username } });
    expect((await open(ali, "sara")).status).toBe(403);
    await h.request("/v1/friend-requests/sara", { method: "POST", token: ali.token });
    expect((await open(ali, "sara")).status).toBe(403); // not a friend yet
    await h.request("/v1/friend-requests/ali", { method: "POST", token: sara.token });
    const first = await open(ali, "Sara");
    expect(first.status).toBe(200);
    const body = (await first.json()) as { id: string };
    expect(body).toEqual({ id: expect.any(String), other: { username: "sara", displayName: "Sara", avatar: null }, counts: { total: 0, mine: 0, theirs: 0 } });
    expect(((await (await open(sara, "ali")).json()) as { id: string }).id).toBe(body.id);
    expect((await open(ali, "ali")).status).toBe(400);
    expect((await open(ali, "nobody")).status).toBe(404);
  });

  it("is not found for a blocked pair", async () => {
    const { ali, sara } = await pair();
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    for (const [from, to] of [[ali, "sara"], [sara, "ali"]] as const) {
      expect((await h.request("/v1/shared-divans", { method: "POST", token: from.token, json: { username: to } })).status).toBe(404);
    }
  });
});

describe("GET /v1/shared-divans", () => {
  it("lists my divans with the counts, and hides a blocked person's", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    await befriend(ali, omid);
    tick(); // omid's divan is newer than sara's
    await h.request("/v1/shared-divans", { method: "POST", token: ali.token, json: { username: "omid" } });
    await add(ali, id, A);
    await add(sara, id, B);
    await add(sara, id, C);
    const list = (await (await h.request("/v1/shared-divans", { token: ali.token })).json()) as { items: { id: string; other: { username: string }; counts: Counts }[]; nextCursor: null };
    expect(list.items.map((i) => i.other.username)).toEqual(["omid", "sara"]);
    expect(list.items.find((i) => i.id === id)!.counts).toEqual({ total: 3, mine: 1, theirs: 2 });
    expect(list.nextCursor).toBeNull();
    const fromSara = (await (await h.request("/v1/shared-divans", { token: sara.token })).json()) as { items: { counts: Counts }[] };
    expect(fromSara.items[0]!.counts).toEqual({ total: 3, mine: 2, theirs: 1 });
    await h.request("/v1/blocks/omid", { method: "PUT", token: ali.token });
    const after = (await (await h.request("/v1/shared-divans", { token: ali.token })).json()) as { items: unknown[] };
    expect(after.items).toHaveLength(1);
  });
});

describe("items", () => {
  it("adds a couplet with a note and tells the chat and the other person", async () => {
    const { ali, sara, id } = await pair();
    const toAli = listen(ali);
    const toSara = listen(sara);
    const res = await add(ali, id, A, "bokhun");
    expect(res.status).toBe(201);
    const item = (await res.json()) as Item;
    expect(item).toMatchObject({ key: A, note: "bokhun", addedByMe: true, likedByMe: false, likedByThem: false });
    expect((await items(sara, id)).items[0]).toMatchObject({ id: item.id, addedByMe: false });

    // A system line in the chat, made with the chat, from either side.
    const chat = (await (await h.request("/v1/conversations", { token: sara.token })).json()) as { items: { id: string; last: { kind: string; fromMe: boolean; event: string | null }; unread: number }[] };
    expect(chat.items[0]).toMatchObject({ last: { kind: "system", fromMe: false, event: "divan_add" }, unread: 0 });
    const lines = (await (await h.request(`/v1/conversations/${chat.items[0]!.id}/messages`, { token: ali.token })).json()) as { items: { kind: string; fromMe: boolean; payload: unknown }[] };
    expect(lines.items).toEqual([expect.objectContaining({ kind: "system", fromMe: true, payload: { event: "divan_add", key: A } })]);

    expect(toSara.map((e) => e.type)).toEqual(["message", "divan"]);
    expect(toSara[1]).toEqual({ type: "divan", sharedDivanId: id, item: expect.objectContaining({ id: item.id, key: A, addedByMe: false }) });
    expect(toAli[1]).toEqual({ type: "divan", sharedDivanId: id, item: expect.objectContaining({ id: item.id, addedByMe: true }) });
  });

  it("adding the same couplet again answers the first item and adds no second line", async () => {
    const { ali, sara, id } = await pair();
    const first = (await (await add(ali, id, A)).json()) as Item;
    const again = await add(sara, id, A, "mine too");
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ id: first.id, addedByMe: false, note: null });
    expect((await items(ali, id)).items).toHaveLength(1);
    expect(await h.db.select().from(messages).where(eq(messages.kind, "system"))).toHaveLength(1);
  });

  it("refuses bad bodies, outsiders, and adding once we are no longer friends", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    for (const bad of [{ key: "nope" }, { key: A, note: "x".repeat(201) }, { key: A, note: "" }, { key: A, note: "   " }, {}]) {
      expect((await h.request(`/v1/shared-divans/${id}/items`, { method: "POST", token: ali.token, json: bad })).status).toBe(400);
    }
    expect(((await (await add(ali, id, A, "  padded  ")).json()) as Item).note).toBe("padded");
    expect((await add(ali, id, B, "x".repeat(200))).status).toBe(201);
    expect((await add(omid, id, B)).status).toBe(404);
    expect((await items(omid, id)).items).toBeUndefined();
    expect((await h.request(`/v1/shared-divans/${crypto.randomUUID()}/items`, { token: ali.token })).status).toBe(404);
    await h.request("/v1/friends/ali", { method: "DELETE", token: sara.token });
    const res = await add(ali, id, B);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect((await items(ali, id)).items).toHaveLength(2); // what is there stays readable
  });

  it("lists newest first, filtered by who added, with counts of the whole divan, and pages", async () => {
    const { ali, sara, id } = await pair();
    const keys = Array.from({ length: 52 }, (_, i) => `/p/q#${i}`);
    for (const [i, key] of keys.entries()) {
      tick();
      await add(i % 4 === 0 ? ali : sara, id, key);
    }
    const all = await items(ali, id);
    expect(all.items).toHaveLength(50);
    expect(all.items[0]!.key).toBe("/p/q#51");
    expect(all.counts).toEqual({ total: 52, mine: 13, theirs: 39 });
    const rest = await items(ali, id, `?cursor=${encodeURIComponent(all.nextCursor!)}`);
    expect(rest.items.map((i) => i.key)).toEqual(["/p/q#1", "/p/q#0"]);
    expect(rest.nextCursor).toBeNull();
    const mine = await items(ali, id, "?by=me");
    expect(mine.items).toHaveLength(13);
    expect(mine.items.every((i) => i.addedByMe)).toBe(true);
    expect(mine.counts).toEqual({ total: 52, mine: 13, theirs: 39 });
    const theirs = await items(ali, id, "?by=them");
    expect(theirs.items).toHaveLength(39);
    expect(theirs.items.every((i) => !i.addedByMe)).toBe(true);
    expect(((await items(sara, id, "?by=me")).counts)).toEqual({ total: 52, mine: 39, theirs: 13 });
    expect((await h.request(`/v1/shared-divans/${id}/items?by=x`, { token: ali.token })).status).toBe(400);
    expect((await h.request(`/v1/shared-divans/${id}/items?cursor=junk`, { token: ali.token })).status).toBe(400);
  });

  it("lets only the person who added an item delete it", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    const item = (await (await add(ali, id, A)).json()) as Item;
    const del = (u: User, itemId = item.id) => h.request(`/v1/shared-divans/${id}/items/${itemId}`, { method: "DELETE", token: u.token });
    expect((await del(sara)).status).toBe(403);
    expect((await del(omid)).status).toBe(404);
    expect((await del(ali, crypto.randomUUID())).status).toBe(404);
    expect((await del(ali)).status).toBe(204);
    expect((await del(ali)).status).toBe(404);
    expect((await items(sara, id)).counts.total).toBe(0);
    expect((await add(sara, id, A)).status).toBe(201); // free again
  });

  it("tells both people live when an item is removed, and nobody when it was refused", async () => {
    const { ali, sara, id } = await pair();
    const item = (await (await add(ali, id, A)).json()) as Item;
    const toAli = listen(ali);
    const toSara = listen(sara);
    const del = (u: User) => h.request(`/v1/shared-divans/${id}/items/${item.id}`, { method: "DELETE", token: u.token });
    expect((await del(sara)).status).toBe(403);
    expect(toAli).toEqual([]);
    expect(toSara).toEqual([]);
    expect((await del(ali)).status).toBe(204);
    const gone = { type: "divan.removed", sharedDivanId: id, itemId: item.id };
    expect(toAli).toEqual([gone]);
    expect(toSara).toEqual([gone]);
    expect((await del(ali)).status).toBe(404);
    expect(toSara).toHaveLength(1); // the second delete says nothing
  });

  it("keeps each person's like, idempotently", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    const item = (await (await add(ali, id, A)).json()) as Item;
    const like = (u: User, method: "PUT" | "DELETE") => h.request(`/v1/shared-divans/${id}/items/${item.id}/like`, { method, token: u.token });
    expect(await (await like(sara, "PUT")).json()).toMatchObject({ id: item.id, likedByMe: true, likedByThem: false });
    expect(await (await like(sara, "PUT")).json()).toMatchObject({ likedByMe: true });
    expect(await (await like(ali, "PUT")).json()).toMatchObject({ likedByMe: true, likedByThem: true });
    expect((await items(sara, id)).items[0]).toMatchObject({ likedByMe: true, likedByThem: true });
    expect(await (await like(sara, "DELETE")).json()).toMatchObject({ likedByMe: false, likedByThem: true });
    expect(await (await like(sara, "DELETE")).json()).toMatchObject({ likedByMe: false });
    expect((await like(omid, "PUT")).status).toBe(404);
    expect((await h.request(`/v1/shared-divans/${id}/items/${crypto.randomUUID()}/like`, { method: "PUT", token: ali.token })).status).toBe(404);
  });

  it("is hidden once either person blocks the other", async () => {
    const { ali, sara, id } = await pair();
    const item = (await (await add(ali, id, A)).json()) as Item;
    await h.request("/v1/blocks/ali", { method: "PUT", token: sara.token });
    for (const u of [ali, sara]) {
      expect((await h.request(`/v1/shared-divans/${id}/items`, { token: u.token })).status).toBe(404);
      expect((await h.request(`/v1/shared-divans/${id}/items/${item.id}/like`, { method: "PUT", token: u.token })).status).toBe(404);
      expect((await add(u, id, B)).status).toBe(404);
    }
  });
});
