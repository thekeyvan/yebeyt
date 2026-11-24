import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type User = { token: string; id: string; username: string };
const befriend = async (a: User, b: User) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
const open = async (from: User, username: string) => h.request("/v1/conversations", { method: "POST", token: from.token, json: { username } });
const openId = async (from: User, username: string) => ((await (await open(from, username)).json()) as { id: string }).id;
const send = (from: User, conversationId: string, text: string) =>
  h.request(`/v1/conversations/${conversationId}/messages`, { method: "POST", token: from.token, json: { clientId: crypto.randomUUID(), kind: "text", text } });
const tick = () => (h.clock.time = new Date(h.clock.time.getTime() + 1000));
type Row = { id: string; other: { username: string; displayName: string | null; online: boolean | null }; last: { kind: string; text: string | null; at: string; fromMe: boolean }; unread: number };
const list = async (u: User, query = "") => (await (await h.request(`/v1/conversations${query}`, { token: u.token })).json()) as { items: Row[]; nextCursor: string | null };

describe("POST /v1/conversations", () => {
  it("needs a sign-in and a username", async () => {
    expect((await h.request("/v1/conversations", { method: "POST", json: { username: "x" } })).status).toBe(401);
    const nameless = await h.signIn("nameless");
    const res = await h.request("/v1/conversations", { method: "POST", token: nameless.accessToken, json: { username: "x" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "username_required" });
    expect((await h.request("/v1/conversations", { token: nameless.accessToken })).status).toBe(403);
    expect((await h.request("/v1/me/unread", { token: nameless.accessToken })).status).toBe(403);
  });

  it("is closed to strangers by default, open to friends and to everyone who allows it", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const res = await open(ali, "sara");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "messages_closed" });
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "all" } });
    expect((await open(ali, "sara")).status).toBe(200);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "friends" } });
    expect((await open(ali, "sara")).status).toBe(403);
    await befriend(ali, sara);
    expect((await open(ali, "sara")).status).toBe(200);
  });

  it("opens a chat where the other person already wrote, whatever their setting says", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    const id = await openId(ali, "sara");
    await send(sara, id, "salam");
    await h.request("/v1/follows/ali", { method: "DELETE", token: sara.token }); // no longer friends; ali takes messages from friends only
    expect((await open(ali, "sara")).status).toBe(200); // sara wrote here, so ali may answer
    expect(await openId(ali, "sara")).toBe(id);
    expect((await open(sara, "ali")).status).toBe(403); // ali has not written
  });

  it("returns the same conversation for the pair, whoever asks", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara", { displayName: "Sara" });
    await befriend(ali, sara);
    const first = (await (await open(ali, "sara")).json()) as { id: string; other: unknown };
    expect(first.other).toEqual({ username: "sara", displayName: "Sara", avatar: null, online: false });
    expect(await openId(ali, "Sara")).toBe(first.id);
    expect(await openId(sara, "ali")).toBe(first.id);
  });

  it("refuses yourself, unknown people and blocked pairs", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    expect((await open(ali, "ali")).status).toBe(400);
    expect((await open(ali, "nobody")).status).toBe(404);
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    expect((await open(ali, "sara")).status).toBe(404);
    expect((await open(sara, "ali")).status).toBe(404);
  });
});

describe("GET /v1/conversations and /v1/me/unread", () => {
  it("lists chats that have messages, newest first, with the last message and unread count", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const omid = await h.signUp("omid");
    await befriend(ali, sara);
    await befriend(ali, omid);
    const withSara = await openId(ali, "sara");
    const withOmid = await openId(ali, "omid");
    expect((await list(ali)).items).toEqual([]); // nothing said yet
    await send(sara, withSara, "salam");
    tick();
    await send(sara, withSara, "chetori?");
    tick();
    await send(ali, withOmid, "hi omid");
    const { items } = await list(ali);
    expect(items.map((i) => i.other.username)).toEqual(["omid", "sara"]);
    expect(items[0]).toMatchObject({ id: withOmid, last: { kind: "text", text: "hi omid", fromMe: true, event: null }, unread: 0 });
    expect(items[1]).toMatchObject({ id: withSara, last: { text: "chetori?", fromMe: false }, unread: 2 });
    expect(((await (await h.request("/v1/me/unread", { token: ali.token })).json()) as { total: number }).total).toBe(2);
    expect(((await (await h.request("/v1/me/unread", { token: sara.token })).json()) as { total: number }).total).toBe(0);
    expect((await list(omid)).items[0]).toMatchObject({ unread: 1 });
  });

  it("shows a couplet and a deleted message in the preview", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    const id = await openId(ali, "sara");
    await h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: ali.token, json: { clientId: crypto.randomUUID(), kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "bokhun" } });
    expect((await list(sara)).items[0]!.last).toMatchObject({ kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "bokhun", text: null });
    tick();
    const sent = (await (await send(ali, id, "oops")).json()) as { id: string };
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token });
    expect((await list(sara)).items[0]!.last).toMatchObject({ deleted: true, text: null });
  });

  it("shows online only when the other person allows it, and only while they are connected", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await send(sara, await openId(ali, "sara"), "hi");
    expect((await list(ali)).items[0]!.other.online).toBe(false);
    const conn = h.deps.hub.add(sara.id, () => {});
    expect((await list(ali)).items[0]!.other.online).toBe(true);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { showOnline: false } });
    expect((await list(ali)).items[0]!.other.online).toBeNull();
    conn.remove();
  });

  it("pages 50 at a time", async () => {
    const ali = await h.signUp("ali");
    await h.request("/v1/me/privacy", { method: "PUT", token: ali.token, json: { messagesFrom: "all" } });
    for (let i = 0; i < 52; i++) {
      const u = await h.signUp(`user${String(i).padStart(2, "0")}`);
      tick();
      await send(u, await openId(u, "ali"), "hi");
    }
    const first = await list(ali);
    expect(first.items).toHaveLength(50);
    expect(first.items[0]!.other.username).toBe("user51");
    const second = await list(ali, `?cursor=${encodeURIComponent(first.nextCursor!)}`);
    expect(second.items.map((i) => i.other.username)).toEqual(["user01", "user00"]);
    expect(second.nextCursor).toBeNull();
    expect((await h.request("/v1/conversations?cursor=junk", { token: ali.token })).status).toBe(400);
  });

  it("hides a blocked person's chat and its unread count", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await send(sara, await openId(ali, "sara"), "hi");
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    expect((await list(ali)).items).toEqual([]);
    expect((await list(sara)).items).toEqual([]);
    expect(((await (await h.request("/v1/me/unread", { token: ali.token })).json()) as { total: number }).total).toBe(0);
  });
});
