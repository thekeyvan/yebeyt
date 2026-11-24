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
type Msg = { id: string; conversationId: string; kind: string; fromMe: boolean; text: string | null; key: string | null; note: string | null; payload: unknown; deleted: boolean; createdAt: string };
type Page = { items: Msg[]; nextBefore: string | null; otherReadMessageId: string | null };

const befriend = async (a: User, b: User) => {
  await h.befriend(a, b);
};
const pair = async () => {
  const ali = await h.signUp("ali");
  const sara = await h.signUp("sara");
  await befriend(ali, sara);
  const res = await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "sara" } });
  return { ali, sara, id: ((await res.json()) as { id: string }).id };
};
const post = (u: User, id: string, json: unknown) => h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: u.token, json });
const text = (u: User, id: string, body: string) => post(u, id, { clientId: crypto.randomUUID(), kind: "text", text: body });
const page = async (u: User, id: string, query = "") => (await (await h.request(`/v1/conversations/${id}/messages${query}`, { token: u.token })).json()) as Page;
const tick = () => (h.clock.time = new Date(h.clock.time.getTime() + 1000));
const listen = (u: User) => {
  const events: LiveEvent[] = [];
  h.deps.hub.add(u.id, (e) => events.push(e));
  return events;
};

describe("POST /v1/conversations/{id}/messages", () => {
  it("sends a text, as mine for me and theirs for them", async () => {
    const { ali, sara, id } = await pair();
    const res = await text(ali, id, "salam");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ conversationId: id, kind: "text", fromMe: true, text: "salam", key: null, note: null, payload: null, deleted: false });
    expect((await page(sara, id)).items[0]).toMatchObject({ text: "salam", fromMe: false });
  });

  it("sends a couplet with an optional note", async () => {
    const { ali, id } = await pair();
    const res = await post(ali, id, { clientId: crypto.randomUUID(), kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "bokhun" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "bokhun", text: null });
    const bare = await post(ali, id, { clientId: crypto.randomUUID(), kind: "couplet", key: "/hafez/ghazal/sh3#1" });
    expect(await bare.json()).toMatchObject({ kind: "couplet", note: null });
  });

  it("is idempotent per sender and client id", async () => {
    const { ali, sara, id } = await pair();
    const clientId = crypto.randomUUID();
    const first = await post(ali, id, { clientId, kind: "text", text: "one" });
    const again = await post(ali, id, { clientId, kind: "text", text: "one" });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(((await again.json()) as Msg).id).toBe(((await first.json()) as Msg).id);
    expect((await page(ali, id)).items).toHaveLength(1);
    // Another sender's same client id is a different message.
    expect((await post(sara, id, { clientId, kind: "text", text: "two" })).status).toBe(201);
    expect((await page(ali, id)).items).toHaveLength(2);
  });

  it("refuses bad bodies", async () => {
    const { ali, id } = await pair();
    const clientId = crypto.randomUUID();
    for (const bad of [
      { clientId, kind: "text", text: "" },
      { clientId, kind: "text", text: "   " },
      { clientId, kind: "text", text: "x".repeat(1001) },
      { clientId, kind: "text" },
      { clientId, kind: "couplet", key: "not a key" },
      { clientId, kind: "couplet", key: "/a/b#1", note: "x".repeat(201) },
      { clientId, kind: "system", text: "hi" },
      { clientId, kind: "game", text: "hi" },
      { clientId: "nope", kind: "text", text: "hi" },
      { kind: "text", text: "hi" },
    ]) {
      expect((await post(ali, id, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    expect((await post(ali, id, { clientId, kind: "text", text: "x".repeat(1000) })).status).toBe(201);
    expect((await page(ali, id)).items).toHaveLength(1);
  });

  it("is only for the two people of the chat", async () => {
    const { id } = await pair();
    const omid = await h.signUp("omid");
    expect((await text(omid, id, "hi")).status).toBe(404);
    expect((await h.request(`/v1/conversations/${id}/messages`, { token: omid.token })).status).toBe(404);
    expect((await h.request(`/v1/conversations/${crypto.randomUUID()}/messages`, { token: omid.token })).status).toBe(404);
    expect((await h.request(`/v1/conversations/bad/messages`, { token: omid.token })).status).toBe(400);
    expect((await h.request(`/v1/conversations/${id}/messages`)).status).toBe(401);
  });

  it("re-checks blocks and «بهم پیام بده» on every send", async () => {
    const { ali, sara, id } = await pair();
    await h.request("/v1/friends/ali", { method: "DELETE", token: sara.token });
    const closed = await text(ali, id, "hi");
    expect(closed.status).toBe(403);
    expect(await closed.json()).toEqual({ error: "messages_closed" });
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { messagesFrom: "all" } });
    expect((await text(ali, id, "hi")).status).toBe(201);
    await h.request("/v1/blocks/ali", { method: "PUT", token: sara.token });
    expect((await text(ali, id, "hi again")).status).toBe(403);
    expect((await text(sara, id, "hi")).status).toBe(403);
    expect((await h.request(`/v1/conversations/${id}/messages`, { token: ali.token })).status).toBe(404);
  });

  it("lets a person answer someone who wrote to them, even when «بهم پیام بده» would refuse", async () => {
    const { ali, sara, id } = await pair();
    await text(sara, id, "first"); // sara wrote while they were friends
    await h.request("/v1/friends/ali", { method: "DELETE", token: sara.token });
    // ali takes messages from friends only and sara is no friend; sara has written, but ali has not.
    expect((await text(sara, id, "again")).status).toBe(403);
    expect((await text(ali, id, "reply")).status).toBe(201); // ali answers sara, whose setting would refuse a stranger
    expect((await text(sara, id, "thanks")).status).toBe(201); // now ali has written here too
    await h.request("/v1/blocks/sara", { method: "PUT", token: ali.token });
    expect((await text(ali, id, "blocked")).status).toBe(403); // a block still stops a reply
  });

  it("limits sending to 30 a minute per user", async () => {
    const { ali, sara, id } = await pair();
    for (let i = 0; i < 30; i++) expect((await text(ali, id, `m${i}`)).status).toBe(201);
    expect((await text(ali, id, "too many")).status).toBe(429);
    expect((await text(sara, id, "still fine")).status).toBe(201);
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    expect((await text(ali, id, "later")).status).toBe(201);
  });

  it("tells both people live", async () => {
    const { ali, sara, id } = await pair();
    const toAli = listen(ali);
    const toSara = listen(sara);
    await text(ali, id, "salam");
    expect(toSara).toEqual([{ type: "message", message: expect.objectContaining({ text: "salam", fromMe: false, conversationId: id }) }]);
    expect(toAli).toEqual([{ type: "message", message: expect.objectContaining({ text: "salam", fromMe: true }) }]);
  });
});

describe("GET /v1/conversations/{id}/messages", () => {
  it("pages newest first with before and limit", async () => {
    const { ali, sara, id } = await pair();
    for (let i = 1; i <= 5; i++) {
      tick();
      await text(i % 2 ? ali : sara, id, `m${i}`);
    }
    const first = await page(ali, id, "?limit=2");
    expect(first.items.map((m) => m.text)).toEqual(["m5", "m4"]);
    expect(first.nextBefore).not.toBeNull();
    const second = await page(ali, id, `?limit=2&before=${encodeURIComponent(first.nextBefore!)}`);
    expect(second.items.map((m) => m.text)).toEqual(["m3", "m2"]);
    const third = await page(ali, id, `?limit=2&before=${encodeURIComponent(second.nextBefore!)}`);
    expect(third.items.map((m) => m.text)).toEqual(["m1"]);
    expect(third.nextBefore).toBeNull();
    expect((await page(ali, id)).items).toHaveLength(5);
    for (const bad of ["?limit=51", "?limit=0", "?before=junk"]) expect((await h.request(`/v1/conversations/${id}/messages${bad}`, { token: ali.token })).status).toBe(400);
  });

  it("shows a deleted message with its content gone", async () => {
    const { ali, id } = await pair();
    const sent = (await (await text(ali, id, "secret")).json()) as Msg;
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token });
    expect((await page(ali, id)).items[0]).toMatchObject({ id: sent.id, deleted: true, text: null, key: null, note: null });
  });
});

describe("read receipts", () => {
  it("marks up to a message, lowers the unread count, tells the other person and shows in the page", async () => {
    const { ali, sara, id } = await pair();
    const ids: string[] = [];
    for (const t of ["a", "b", "c"]) {
      tick();
      ids.push(((await (await text(ali, id, t)).json()) as Msg).id);
    }
    const unread = async (u: User) => ((await (await h.request("/v1/me/unread", { token: u.token })).json()) as { total: number }).total;
    expect(await unread(sara)).toBe(3);
    const toAli = listen(ali);
    const res = await h.request(`/v1/conversations/${id}/read`, { method: "PUT", token: sara.token, json: { messageId: ids[1] } });
    expect(res.status).toBe(204);
    expect(await unread(sara)).toBe(1);
    expect(toAli).toEqual([{ type: "read", conversationId: id, username: "sara", messageId: ids[1] }]);
    expect((await page(ali, id)).otherReadMessageId).toBe(ids[1]);
    expect((await page(sara, id)).otherReadMessageId).toBeNull();
    // It never goes back, and nothing is announced for it.
    toAli.length = 0;
    await h.request(`/v1/conversations/${id}/read`, { method: "PUT", token: sara.token, json: { messageId: ids[0] } });
    await h.request(`/v1/conversations/${id}/read`, { method: "PUT", token: sara.token, json: { messageId: ids[1] } });
    expect(toAli).toEqual([]);
    expect(await unread(sara)).toBe(1);
    expect((await page(ali, id)).otherReadMessageId).toBe(ids[1]);
    await h.request(`/v1/conversations/${id}/read`, { method: "PUT", token: sara.token, json: { messageId: ids[2] } });
    expect(await unread(sara)).toBe(0);
  });

  it("refuses a message of another chat, and outsiders", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    await befriend(ali, omid);
    const other = ((await (await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "omid" } })).json()) as { id: string }).id;
    const elsewhere = ((await (await text(ali, other, "hi")).json()) as Msg).id;
    const put = (u: User, conv: string, messageId: string) => h.request(`/v1/conversations/${conv}/read`, { method: "PUT", token: u.token, json: { messageId } });
    expect((await put(sara, id, elsewhere)).status).toBe(404);
    expect((await put(omid, id, elsewhere)).status).toBe(404);
    expect((await put(sara, id, "nope")).status).toBe(400);
  });
});

describe("DELETE /v1/messages/{id}", () => {
  it("lets the sender delete: the row stays, its content is cleared, repeats are fine", async () => {
    const { ali, id } = await pair();
    const sent = (await (await post(ali, id, { clientId: crypto.randomUUID(), kind: "couplet", key: "/a/b#1", note: "n" })).json()) as Msg;
    expect((await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token })).status).toBe(204);
    expect((await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token })).status).toBe(204);
    const [row] = await h.db.select().from(messages).where(eq(messages.id, sent.id));
    expect(row).toMatchObject({ text: null, coupletKey: null, note: null, payload: null });
    expect(row!.deletedAt).not.toBeNull();
  });

  it("refuses anyone but the sender, strangers and system lines", async () => {
    const { ali, sara, id } = await pair();
    const omid = await h.signUp("omid");
    const sent = (await (await text(ali, id, "hi")).json()) as Msg;
    expect((await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: sara.token })).status).toBe(403);
    expect((await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: omid.token })).status).toBe(404);
    expect((await h.request(`/v1/messages/${crypto.randomUUID()}`, { method: "DELETE", token: ali.token })).status).toBe(404);
    expect((await h.request(`/v1/messages/${sent.id}`, { method: "DELETE" })).status).toBe(401);
    expect((await page(sara, id)).items[0]).toMatchObject({ deleted: false, text: "hi" });
    const [system] = await h.db.insert(messages).values({ conversationId: id, kind: "system", payload: { event: "divan_add", key: "/a/b#1", by: ali.id } }).returning();
    expect((await h.request(`/v1/messages/${system!.id}`, { method: "DELETE", token: ali.token })).status).toBe(403);
  });

  it("tells both people live, once", async () => {
    const { ali, sara, id } = await pair();
    const sent = (await (await text(ali, id, "oops")).json()) as Msg;
    const toAli = listen(ali);
    const toSara = listen(sara);
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token });
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token });
    const event = { type: "deleted", conversationId: id, messageId: sent.id };
    expect(toAli).toEqual([event]);
    expect(toSara).toEqual([event]);
  });

  it("takes a deleted message out of the unread count", async () => {
    const { ali, sara, id } = await pair();
    const sent = (await (await text(ali, id, "hi")).json()) as Msg;
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: ali.token });
    expect(((await (await h.request("/v1/me/unread", { token: sara.token })).json()) as { total: number }).total).toBe(0);
  });
});

describe("reporting a message", () => {
  it("accepts a message of the person in a chat I am in, and shows it to the admin", async () => {
    const { ali, sara, id } = await pair();
    const sent = (await (await text(sara, id, "rude words")).json()) as Msg;
    const report = (u: User, username: string, messageId: string) =>
      h.request("/v1/reports", { method: "POST", token: u.token, json: { username, messageId, reason: "abuse" } });
    expect((await report(ali, "sara", sent.id)).status).toBe(204);
    expect((await report(ali, "ali", sent.id)).status).toBe(400);
    expect((await report(sara, "ali", sent.id)).status).toBe(404); // not ali's message
    expect((await report(await h.signUp("omid"), "sara", sent.id)).status).toBe(404); // not in the chat
    const list = (await (await h.request("/v1/admin/reports", { headers: { authorization: "Bearer admin-token-for-tests" } })).json()) as { items: { message: unknown }[] };
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.message).toEqual({ id: sent.id, kind: "text", text: "rude words", key: null, note: null, deleted: false });
  });

  it("keeps what the message said when its sender deletes it afterwards", async () => {
    const { ali, sara, id } = await pair();
    const sent = (await (await post(sara, id, { clientId: crypto.randomUUID(), kind: "couplet", key: "/a/b#1", note: "look" })).json()) as Msg;
    await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "sara", messageId: sent.id, reason: "abuse" } });
    await h.request(`/v1/messages/${sent.id}`, { method: "DELETE", token: sara.token });
    const list = (await (await h.request("/v1/admin/reports", { headers: { authorization: "Bearer admin-token-for-tests" } })).json()) as { items: { message: unknown }[] };
    expect(list.items[0]!.message).toEqual({ id: sent.id, kind: "couplet", text: null, key: "/a/b#1", note: "look", deleted: true });
  });
});
