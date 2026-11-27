import { describe, expect, it } from "vitest";
import { upstream } from "../lib/api/upstream";

// The debug server's messages (Debug/MessagesBackend.swift): the answers the screenshots and the end-to-end tests rely on are what the app reads.

const spec = (account: object) => `debug-${Buffer.from(JSON.stringify(account)).toString("base64url")}`;

async function signIn() {
  const answer = await upstream({ method: "POST", path: "/v1/auth/apple", body: JSON.stringify({ identityToken: spec({ id: crypto.randomUUID(), username: "niloofar" }), nonce: "n" }) });
  return (await answer.json()) as { accessToken: string };
}

async function account() {
  const session = await signIn();
  const call = async (method: string, path: string, body?: unknown) => {
    const answer = await upstream({ method, path, credential: session.accessToken, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: answer.status, json: answer.status === 204 ? undefined : ((await answer.json()) as any) };
  };
  return call;
}

describe("the debug server's chats", () => {
  it("the inbox has the five chats of the boards, newest first, with the unread ones and the badge's total", async () => {
    const call = await account();
    const { json } = await call("GET", "/v1/conversations");
    expect(json.items.map((row: any) => row.other.username)).toEqual(["sara.ghazal", "aryan", "kian_k", "mahsa.m", "bardia"]);
    expect(json.items.map((row: any) => row.unread)).toEqual([1, 1, 0, 0, 0]);
    expect(json.items.map((row: any) => row.last.kind)).toEqual(["game", "game", "text", "text", "couplet"]);
    expect(json.items.every((row: any) => row.other.canPlay === true)).toBe(true);
    expect((await call("GET", "/v1/me/unread")).json).toEqual({ total: 2, friendRequests: 2 });
  });

  it("opening a chat answers its id, and the demo friend cannot play; a stranger is refused", async () => {
    const call = await account();
    expect((await call("POST", "/v1/conversations", { username: "sara.ghazal" })).json.id).toBe("c-sara_ghazal");
    expect((await call("POST", "/v1/conversations", { username: "yebeyt" })).json.other.canPlay).toBe(false);
    expect(await call("POST", "/v1/conversations", { username: "raha" })).toMatchObject({ status: 403, json: { error: "messages_closed" } });
  });

  it("Sara's chat has a game line, a text of mine «دیده شد» and a couplet with a note; Kian's has a divan line", async () => {
    const call = await account();
    const sara = (await call("GET", "/v1/conversations/c-sara_ghazal/messages")).json;
    expect(sara.items.map((one: any) => one.kind)).toEqual(["game", "text", "couplet"]);
    expect(sara.otherReadMessageId).toBe("m3");
    expect(sara.items[2]).toMatchObject({ key: "/hafez/ghazal/sh8#4", note: "اینو دیدم یاد تو افتادم" });
    const kian = (await call("GET", "/v1/conversations/c-kian_k/messages")).json;
    expect(kian.items.some((one: any) => one.payload?.event === "divan_add")).toBe(true);
    expect((await call("GET", "/v1/conversations/c-yebeyt/messages")).json.items).toEqual([]);
  });

  it("what is sent stays in the chat (the same clientId only once), and reading clears the unread count", async () => {
    const call = await account();
    const sent = await call("POST", "/v1/conversations/c-sara_ghazal/messages", { clientId: "k1", kind: "text", text: "سلام" });
    expect(sent.status).toBe(201);
    expect(sent.json).toMatchObject({ fromMe: true, text: "سلام" });
    expect((await call("POST", "/v1/conversations/c-sara_ghazal/messages", { clientId: "k1", kind: "text", text: "سلام" })).json.id).toBe(sent.json.id);
    const couplet = await call("POST", "/v1/conversations/c-sara_ghazal/messages", { clientId: "k2", kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "n" });
    expect(couplet.json).toMatchObject({ kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "n" });
    expect((await call("GET", "/v1/conversations/c-sara_ghazal/messages")).json.items).toHaveLength(5);
    expect((await call("GET", "/v1/conversations")).json.items[0].last.fromMe).toBe(true);
    expect((await call("PUT", "/v1/conversations/c-sara_ghazal/read", { messageId: "g1" })).status).toBe(204);
    expect((await call("GET", "/v1/me/unread")).json.total).toBe(1);
  });
});

describe("the debug server's shared divans", () => {
  it("Sara's divan has 24 couplets (13 hers, 11 mine), three of them listed, and the chips filter by who added", async () => {
    const call = await account();
    const list = (await call("GET", "/v1/shared-divans")).json;
    expect(list.items.map((one: any) => one.id)).toEqual(["d-sara_ghazal", "d-kian_k"]);
    expect(list.items[0].counts).toEqual({ total: 24, mine: 11, theirs: 13 });
    const all = (await call("GET", "/v1/shared-divans/d-sara_ghazal/items")).json;
    expect(all.items.map((one: any) => one.id)).toEqual(["i1", "i2", "i3"]);
    expect(all.counts).toEqual({ total: 24, mine: 11, theirs: 13 });
    expect((await call("GET", "/v1/shared-divans/d-sara_ghazal/items?by=me")).json.items.map((one: any) => one.id)).toEqual(["i2"]);
    expect((await call("GET", "/v1/shared-divans/d-sara_ghazal/items?by=them")).json.items.map((one: any) => one.id)).toEqual(["i1", "i3"]);
  });

  it("likes flip, only my own couplet can be taken out, and the counts follow", async () => {
    const call = await account();
    expect((await call("PUT", "/v1/shared-divans/d-sara_ghazal/items/i3/like")).json.likedByMe).toBe(true);
    expect((await call("DELETE", "/v1/shared-divans/d-sara_ghazal/items/i1/like")).json.likedByMe).toBe(false);
    expect((await call("DELETE", "/v1/shared-divans/d-sara_ghazal/items/i1")).status).toBe(403); // hers
    expect((await call("DELETE", "/v1/shared-divans/d-sara_ghazal/items/i2")).status).toBe(204);
    expect((await call("DELETE", "/v1/shared-divans/d-sara_ghazal/items/i2")).status).toBe(404); // already gone
    const after = (await call("GET", "/v1/shared-divans/d-sara_ghazal/items")).json;
    expect(after.items.map((one: any) => one.id)).toEqual(["i1", "i3"]);
    expect(after.counts).toEqual({ total: 23, mine: 10, theirs: 13 });
  });

  it("adding puts the couplet first and a line in the chat; the same couplet again changes nothing; only friends have a divan", async () => {
    const call = await account();
    const added = await call("POST", "/v1/shared-divans/d-sara_ghazal/items", { key: "/hafez/ghazal/sh3#0", note: "یاد تو" });
    expect(added.status).toBe(201);
    expect(added.json).toMatchObject({ addedByMe: true, note: "یاد تو" });
    expect((await call("POST", "/v1/shared-divans/d-sara_ghazal/items", { key: "/hafez/ghazal/sh3#0" })).status).toBe(200);
    const items = (await call("GET", "/v1/shared-divans/d-sara_ghazal/items")).json;
    expect(items.items[0].key).toBe("/hafez/ghazal/sh3#0");
    expect(items.counts).toEqual({ total: 25, mine: 12, theirs: 13 });
    expect((await call("GET", "/v1/conversations/c-sara_ghazal/messages")).json.items[0].payload).toEqual({ event: "divan_add", key: "/hafez/ghazal/sh3#0" });
    const made = await call("POST", "/v1/shared-divans", { username: "mahsa.m" });
    expect(made.json).toMatchObject({ id: "d-mahsa_m", counts: { total: 0, mine: 0, theirs: 0 } });
    expect((await call("POST", "/v1/shared-divans", { username: "raha" })).status).toBe(403);
    expect((await call("GET", "/v1/shared-divans")).json.items.map((one: any) => one.id)).toEqual(["d-sara_ghazal", "d-kian_k", "d-mahsa_m"]);
  });

  it("is the debug server only: a path that is not messages is still answered by the friends' stub, and the unknown by a 404", async () => {
    const call = await account();
    expect((await call("GET", "/v1/me/friends")).json.items.map((one: any) => one.username)).toContain("sara.ghazal");
    expect((await call("GET", "/v1/something/else")).status).toBe(404);
  });
});
