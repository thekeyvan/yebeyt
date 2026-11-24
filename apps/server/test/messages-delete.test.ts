import { beforeEach, describe, expect, it } from "vitest";
import { blocks, conversationReads, conversations, messages, reports, sharedDivanItems, sharedDivanLikes, sharedDivans } from "../src/db/schema.js";
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

describe("DELETE /v1/me with messages", () => {
  it("removes my blocks, reads, likes, chats, messages and shared divans, and keeps what is only between others", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const omid = await h.signUp("omid");
    const rude = await h.signUp("rude");
    await befriend(ali, sara);
    await befriend(sara, omid);

    // ali <-> sara: chat with messages from both, a read mark, a shared divan with items and likes, a system line.
    const chat = ((await (await h.request("/v1/conversations", { method: "POST", token: ali.token, json: { username: "sara" } })).json()) as { id: string }).id;
    const sent = async (u: User, text: string) =>
      (await (await h.request(`/v1/conversations/${chat}/messages`, { method: "POST", token: u.token, json: { clientId: crypto.randomUUID(), kind: "text", text } })).json()) as { id: string };
    const fromSara = await sent(sara, "hello ali");
    await sent(ali, "hello sara");
    await h.request(`/v1/conversations/${chat}/read`, { method: "PUT", token: ali.token, json: { messageId: fromSara.id } });
    const divan = ((await (await h.request("/v1/shared-divans", { method: "POST", token: ali.token, json: { username: "sara" } })).json()) as { id: string }).id;
    const item = (await (await h.request(`/v1/shared-divans/${divan}/items`, { method: "POST", token: ali.token, json: { key: "/a/b#1" } })).json()) as { id: string };
    await h.request(`/v1/shared-divans/${divan}/items/${item.id}/like`, { method: "PUT", token: sara.token });

    // sara <-> omid: stays whole.
    const other = ((await (await h.request("/v1/conversations", { method: "POST", token: sara.token, json: { username: "omid" } })).json()) as { id: string }).id;
    await h.request(`/v1/conversations/${other}/messages`, { method: "POST", token: omid.token, json: { clientId: crypto.randomUUID(), kind: "text", text: "hi sara" } });
    await h.request("/v1/shared-divans", { method: "POST", token: sara.token, json: { username: "omid" } });

    // blocks both ways, reports both ways.
    await h.request("/v1/blocks/rude", { method: "PUT", token: ali.token });
    await h.request("/v1/blocks/ali", { method: "PUT", token: rude.token });
    await h.request("/v1/blocks/rude", { method: "PUT", token: sara.token });
    await h.request("/v1/reports", { method: "POST", token: ali.token, json: { username: "rude", reason: "spam" } });
    await h.request("/v1/reports", { method: "POST", token: rude.token, json: { username: "ali", reason: "abuse" } });

    expect((await h.request("/v1/me", { method: "DELETE", token: ali.token })).status).toBe(204);

    // Gone: ali's blocks (both ways), the chat with sara and everything in it, the shared divan with its items and likes.
    expect((await h.db.select().from(blocks)).map((b) => `${b.blockerId}>${b.blockedId}`)).toEqual([`${sara.id}>${rude.id}`]);
    expect(await h.db.select().from(conversationReads)).toEqual([]);
    expect((await h.db.select().from(conversations)).map((c) => c.id)).toEqual([other]);
    expect((await h.db.select().from(messages)).map((m) => m.text)).toEqual(["hi sara"]);
    expect(await h.db.select().from(sharedDivanItems)).toEqual([]);
    expect(await h.db.select().from(sharedDivanLikes)).toEqual([]);
    expect(await h.db.select().from(sharedDivans)).toHaveLength(1);

    // Reports about ali are gone; the one ali filed stays, without a name.
    const filed = await h.db.select().from(reports);
    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ reporterId: null, reason: "spam" });

    // What sara sees: no chat with ali, the other chat is whole.
    const chats = (await (await h.request("/v1/conversations", { token: sara.token })).json()) as { items: { id: string }[] };
    expect(chats.items.map((c) => c.id)).toEqual([other]);
    expect((await h.request(`/v1/conversations/${chat}/messages`, { token: sara.token })).status).toBe(404);
    expect((await h.request(`/v1/shared-divans/${divan}/items`, { token: sara.token })).status).toBe(404);
  });
});
