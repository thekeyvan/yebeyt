import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { startServer, type RunningServer } from "../src/server.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
let server: RunningServer;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  h = await makeHarness();
  server = await startServer(h.deps, 0, { authTimeoutMs: 300, heartbeatMs: 100 });
});
afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await server.close();
});

type User = { token: string; id: string; username: string };
type Event = { type: string; [key: string]: unknown };

/** A client: events in order, waiting for the next, and the close code. */
function connect(options: ConstructorParameters<typeof WebSocket>[2] = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/v1/live`, options);
  sockets.push(ws);
  const queue: Event[] = [];
  const waiting: ((e: Event) => void)[] = [];
  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as Event;
    const next = waiting.shift();
    if (next) next(event);
    else queue.push(event);
  });
  const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
  const opened = new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  const next = (): Promise<Event> =>
    queue.length ? Promise.resolve(queue.shift()!) : new Promise((resolve, reject) => {
      waiting.push(resolve);
      setTimeout(() => reject(new Error("no event")), 2000);
    });
  /** Nothing more arrives within a moment. */
  const quiet = async () => {
    await new Promise((r) => setTimeout(r, 150));
    expect(queue).toEqual([]);
  };
  return { ws, opened, closed, next, quiet, send: (value: unknown) => ws.send(JSON.stringify(value)) };
}

async function live(user: User, options?: Parameters<typeof connect>[0]) {
  const c = connect(options);
  await c.opened;
  c.send({ type: "auth", token: user.token });
  expect(await c.next()).toEqual({ type: "ready" });
  return c;
}

const befriend = async (a: User, b: User) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
const chat = async (a: User, b: User) => {
  await befriend(a, b);
  const id = ((await (await h.request("/v1/conversations", { method: "POST", token: a.token, json: { username: b.username } })).json()) as { id: string }).id;
  return id;
};

describe("GET /v1/live", () => {
  it("accepts an access token as the first message and answers ready", async () => {
    const ali = await h.signUp("ali");
    const c = await live(ali);
    expect(h.deps.hub.isOnline(ali.id)).toBe(true);
    c.ws.close();
    await c.closed;
    await waitFor(() => !h.deps.hub.isOnline(ali.id));
  });

  it("closes a socket that sends a bad token, something else first, or nothing within the time", async () => {
    const bad = connect();
    await bad.opened;
    bad.send({ type: "auth", token: "not-a-token" });
    expect(await bad.closed).toBe(4401);

    const wrongFirst = connect();
    await wrongFirst.opened;
    wrongFirst.send({ type: "hello" });
    expect(await wrongFirst.closed).toBe(4401);

    const silent = connect();
    await silent.opened;
    expect(await silent.closed).toBe(4401);
  });

  it("closes a signed-in user who has no username yet", async () => {
    const session = await h.signIn("nameless");
    const c = connect();
    await c.opened;
    c.send({ type: "auth", token: session.accessToken });
    expect(await c.closed).toBe(4403);
  });

  it("delivers a new message to the other person, and to my own sockets", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const id = await chat(ali, sara);
    const toSara = await live(sara);
    const toAli = await live(ali);
    expect(await toSara.next()).toEqual({ type: "presence", username: "ali", online: true });
    await h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: ali.token, json: { clientId: crypto.randomUUID(), kind: "text", text: "salam" } });
    expect(await toSara.next()).toMatchObject({ type: "message", message: { conversationId: id, kind: "text", text: "salam", fromMe: false } });
    expect(await toAli.next()).toMatchObject({ type: "message", message: { text: "salam", fromMe: true } });
  });

  it("delivers read receipts", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const id = await chat(ali, sara);
    const toAli = await live(ali);
    const sent = (await (await h.request(`/v1/conversations/${id}/messages`, { method: "POST", token: ali.token, json: { clientId: crypto.randomUUID(), kind: "text", text: "hi" } })).json()) as { id: string };
    await toAli.next(); // my own message
    await h.request(`/v1/conversations/${id}/read`, { method: "PUT", token: sara.token, json: { messageId: sent.id } });
    expect(await toAli.next()).toEqual({ type: "read", conversationId: id, userId: sara.id, messageId: sent.id });
  });

  it("tells people I chat with when I come online and go offline", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await chat(ali, sara);
    const toAli = await live(ali);
    const first = await live(sara);
    expect(await toAli.next()).toEqual({ type: "presence", username: "sara", online: true });
    const second = await live(sara); // a second socket changes nothing
    first.ws.close();
    await first.closed;
    await toAli.quiet();
    second.ws.close();
    expect(await toAli.next()).toEqual({ type: "presence", username: "sara", online: false });
  });

  it("keeps presence from people I do not chat with, and from those who hide it", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const omid = await h.signUp("omid");
    await chat(ali, sara);
    await chat(ali, omid);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { showOnline: false } });
    const stranger = await h.signUp("stranger");
    const toAli = await live(ali);
    const toStranger = await live(stranger);
    await live(sara);
    await toAli.quiet();
    await live(omid);
    expect(await toAli.next()).toEqual({ type: "presence", username: "omid", online: true });
    await toStranger.quiet();
    // A block ends it too.
    await h.request("/v1/blocks/omid", { method: "PUT", token: ali.token });
    await live(omid);
    await toAli.quiet();
  });

  it("pings, and drops a socket that does not answer", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const alive = await live(ali);
    const pings: number[] = [];
    alive.ws.on("ping", () => pings.push(1));
    const dead = await live(sara, { autoPong: false });
    expect(await dead.closed).toBe(1006); // terminated by the server
    await waitFor(() => !h.deps.hub.isOnline(sara.id));
    await new Promise((r) => setTimeout(r, 250));
    expect(pings.length).toBeGreaterThanOrEqual(2);
    expect(h.deps.hub.isOnline(ali.id)).toBe(true);
  });
});

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  expect(check()).toBe(true);
}
