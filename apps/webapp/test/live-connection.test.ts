import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { backoffMs, LiveConnection } from "../lib/messages/liveConnection";
import type { LiveEvent } from "../lib/messages/liveEvents";
import { decodeLive } from "../lib/messages/liveEvents";
import { fetchLiveToken } from "../lib/messages/liveToken";
import { eventually, FakeSockets, item, message, tick } from "./messages";

// The ports of LiveConnectionTests.swift: the socket opens with the token, reconnects with a growing wait, and stops where the server says so. Pings are the browser's.

function rig() {
  const sockets = new FakeSockets();
  const waits: number[] = [];
  const events: LiveEvent[] = [];
  let readyCount = 0;
  let tokenCalls = 0;
  let tokenError: unknown;
  let hold: (() => void) | undefined;
  let holdsToken = false;
  const connection = new LiveConnection({
    factory: sockets,
    token: async () => {
      if (tokenError) throw tokenError;
      tokenCalls += 1;
      const mine = `t${tokenCalls}`;
      if (holdsToken) {
        holdsToken = false;
        await new Promise<void>((resolve) => (hold = resolve));
      }
      return { token: mine, url: "wss://example.test/v1/live" };
    },
    onEvent: (event) => events.push(event),
    onReady: () => (readyCount += 1),
    wait: async (ms) => {
      waits.push(ms);
      await tick(2);
    },
    backoff: (failures) => backoffMs(failures, () => 1),
  });
  return {
    sockets,
    waits,
    events,
    connection,
    ready: () => readyCount,
    tokenCalls: () => tokenCalls,
    failTokens: (error: unknown) => (tokenError = error),
    holdToken: () => (holdsToken = true),
    releaseToken: () => hold?.(),
  };
}

describe("the live connection", () => {
  it("sends the token as the first message and is ready when the server says so", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1 && r.sockets.sockets[0]!.sent.length === 1)).toBe(true);
    const socket = r.sockets.sockets[0]!;
    expect(socket.authToken).toBe("t1");
    expect(socket.url).toBe("wss://example.test/v1/live");
    expect(r.connection.state).toBe("connecting");
    socket.ready();
    expect(r.connection.state).toBe("ready");
    expect(r.ready()).toBe(1);
    r.connection.stop();
  });

  it("sends a frame only while the socket is ready", async () => {
    const r = rig();
    expect(r.connection.send("early")).toBe(false);
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    const socket = r.sockets.sockets[0]!;
    expect(r.connection.send("not ready")).toBe(false);
    socket.ready();
    expect(r.connection.send('{"type":"duel.answer"}')).toBe(true);
    expect(socket.sent.at(-1)).toBe('{"type":"duel.answer"}');
    r.connection.stop();
    expect(r.connection.send("late")).toBe(false);
  });

  it("hands events on and skips frames it cannot read, and anything before ready", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    const socket = r.sockets.sockets[0]!;
    socket.push('{"type":"presence","username":"sara","online":true}'); // before ready: not handed on
    socket.ready();
    socket.push("not json");
    socket.push('{"type":"presence","username":"sara","online":true}');
    socket.push('{"type":"game.started","gameId":"g"}');
    expect(r.events).toEqual([
      { type: "presence", username: "sara", online: true },
      { type: "other", name: "game.started" },
    ]);
    r.connection.stop();
  });

  it("tries a lost connection again with a growing wait that starts over once it was ready", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.sockets.sockets[0]!.ready();
    r.sockets.sockets[0]!.end(); // was ready: 1 s
    expect(await eventually(() => r.sockets.sockets.length === 2)).toBe(true);
    r.sockets.sockets[1]!.end(1006); // never ready: 2 s
    expect(await eventually(() => r.sockets.sockets.length === 3)).toBe(true);
    r.sockets.sockets[2]!.end(); // 4 s
    expect(await eventually(() => r.sockets.sockets.length === 4)).toBe(true);
    r.sockets.sockets[3]!.ready();
    expect(r.ready()).toBe(2);
    expect(r.waits).toEqual([1000, 2000, 4000]);
    r.sockets.sockets[3]!.end();
    expect(await eventually(() => r.sockets.sockets.length === 5)).toBe(true);
    expect(r.waits.at(-1)).toBe(1000);
    r.connection.stop();
  });

  it("never waits longer than thirty seconds", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((failures) => backoffMs(failures, () => 1))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(backoffMs(0, () => 1)).toBe(1000);
  });

  it("asks for a new token at once when the token has expired (4401), and says nothing to wait for", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.sockets.sockets[0]!.ready();
    r.sockets.sockets[0]!.end(4401);
    expect(await eventually(() => r.sockets.sockets.length === 2 && r.sockets.sockets[1]!.sent.length === 1)).toBe(true);
    expect(r.sockets.sockets[1]!.authToken).toBe("t2");
    expect(r.waits).toEqual([]);
    r.connection.stop();
  });

  it("waits before the third try when a token is refused at the door twice in a row", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.sockets.sockets[0]!.end(4401);
    expect(await eventually(() => r.sockets.sockets.length === 2)).toBe(true);
    r.sockets.sockets[1]!.end(4401);
    expect(await eventually(() => r.sockets.sockets.length === 3)).toBe(true);
    expect(r.waits).toEqual([2000]);
    r.connection.stop();
  });

  it("stops for good when there is no session any more, and waits on a bad network", async () => {
    const r = rig();
    r.failTokens(new ApiError(401, "unauthorized"));
    r.connection.start();
    expect(await eventually(() => r.connection.state === "stopped")).toBe(true);
    expect(r.sockets.sockets).toEqual([]);
    r.failTokens(new ApiError(0));
    r.connection.start();
    expect(await eventually(() => r.waits.length >= 2)).toBe(true);
    expect(r.waits.slice(0, 2)).toEqual([1000, 2000]);
    r.connection.stop();
  });

  it("is replaced by a sixth socket: stops until the page comes back (stop, then start)", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.sockets.sockets[0]!.ready();
    r.sockets.sockets[0]!.end(4409);
    expect(await eventually(() => r.connection.state === "evicted")).toBe(true);
    r.connection.start(); // does not fight
    await tick(30);
    expect(r.sockets.sockets).toHaveLength(1);
    expect(r.waits).toEqual([]);
    r.connection.stop();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 2)).toBe(true);
    r.connection.stop();
  });

  it("stops when there is no username yet", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.sockets.sockets[0]!.end(4403);
    expect(await eventually(() => r.connection.state === "stopped")).toBe(true);
    expect(r.waits).toEqual([]);
  });

  it("closes the socket when stopped and says nothing more", async () => {
    const r = rig();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    const socket = r.sockets.sockets[0]!;
    socket.ready();
    r.connection.stop();
    expect(socket.closedByClient).toBe(true);
    expect(r.connection.state).toBe("stopped");
    socket.push('{"type":"presence","username":"sara","online":false}');
    await tick(30);
    expect(r.events).toEqual([]);
    expect(r.sockets.sockets).toHaveLength(1);
  });

  it("opens nothing for a run that was stopped while its token was coming, and leaves the new run alone", async () => {
    const r = rig();
    r.holdToken();
    r.connection.start(); // its token is held
    expect(await eventually(() => r.tokenCalls() === 1)).toBe(true);
    r.connection.stop(); // the page goes away …
    r.connection.start(); // … and comes back: a new run, with its own token
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    r.releaseToken(); // the old token arrives late
    await tick(50);
    expect(r.sockets.sockets).toHaveLength(1);
    r.sockets.sockets[0]!.ready();
    expect(r.connection.state).toBe("ready");
    r.connection.stop();
    expect(r.sockets.sockets[0]!.closedByClient).toBe(true);
  });

  it("opens one socket when started twice", async () => {
    const r = rig();
    r.connection.start();
    r.connection.start();
    expect(await eventually(() => r.sockets.sockets.length === 1)).toBe(true);
    await tick(30);
    expect(r.sockets.sockets).toHaveLength(1);
    r.connection.stop();
  });
});

describe("the token of the socket", () => {
  it("is asked of the web app's own route, and a 401 says signed out", async () => {
    const asked: [string, RequestInit | undefined][] = [];
    const answer = (status: number, body: unknown) => (async (url: string, init?: RequestInit) => (asked.push([url, init]), Response.json(body, { status }))) as unknown as typeof fetch;
    expect(await fetchLiveToken(answer(200, { token: "a.b.c", url: "wss://x/v1/live" }))).toEqual({ token: "a.b.c", url: "wss://x/v1/live" });
    expect(asked[0]).toEqual(["/auth/live", { method: "POST", credentials: "same-origin" }]);
    await expect(fetchLiveToken(answer(401, { error: "unauthorized" }))).rejects.toMatchObject({ status: 401 });
    await expect(fetchLiveToken(answer(200, { nope: 1 }))).rejects.toMatchObject({ status: 502 });
    await expect(fetchLiveToken((async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch)).rejects.toMatchObject({ status: 0 });
  });
});

describe("the events of the contract", () => {
  it("every one is decoded, and what lacks a field is not", () => {
    const sent = message("m1", { text: "سلام" });
    expect(decodeLive('{"type":"ready"}')).toEqual({ type: "ready" });
    expect(decodeLive(JSON.stringify({ type: "message", message: sent }))).toEqual({ type: "message", message: sent });
    expect(decodeLive('{"type":"read","conversationId":"c1","username":"sara","messageId":"m1"}')).toEqual({ type: "read", conversationId: "c1", username: "sara", messageId: "m1" });
    expect(decodeLive('{"type":"deleted","conversationId":"c1","messageId":"m1"}')).toEqual({ type: "deleted", conversationId: "c1", messageId: "m1" });
    expect(decodeLive('{"type":"presence","username":"sara","online":false}')).toEqual({ type: "presence", username: "sara", online: false });
    const added = item("i1", "/hafez/ghazal/sh3#0", false);
    expect(decodeLive(JSON.stringify({ type: "divan", sharedDivanId: "d1", item: added }))).toEqual({ type: "divan", sharedDivanId: "d1", item: added });
    expect(decodeLive('{"type":"divan.removed","sharedDivanId":"d1","itemId":"i1"}')).toEqual({ type: "divan.removed", sharedDivanId: "d1", itemId: "i1" });
    expect(decodeLive('{"type":"friend.request","from":{"username":"aryan","displayName":"آرین","avatar":null}}')).toEqual({ type: "friend.request", from: { username: "aryan", displayName: "آرین", avatar: null } });
    expect(decodeLive('{"type":"friend.accepted","from":{"username":"sara","displayName":null,"avatar":null}}')?.type).toBe("friend.accepted");
    expect(decodeLive('{"type":"duel.round","round":1}')).toEqual({ type: "other", name: "duel.round" });
    for (const text of ['{"type":"divan.removed","sharedDivanId":"d1"}', '{"type":"read","conversationId":"c1"}', '{"type":"friend.request"}', '{"type":"message","message":{"id":"m"}}', "[]", "{}", "nope", '{"type":3}']) {
      expect(decodeLive(text), text).toBeUndefined();
    }
  });

  it("reads a message of a kind it does not know as a system line", () => {
    const event = decodeLive(JSON.stringify({ type: "message", message: message("m1", { kind: "sticker" as never }) }));
    expect(event?.type === "message" && event.message.kind).toBe("system");
  });
});
