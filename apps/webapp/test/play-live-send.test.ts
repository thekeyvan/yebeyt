import { describe, expect, it } from "vitest";
import { LiveConnection, maxFrameBytes } from "../lib/messages/liveConnection";
import { duelAnswerFrame } from "../lib/play/liveGameEvents";
import { eventually, FakeSockets } from "./messages";

// `sendLive` of the phone's MessagesCenter (a frame goes nowhere while the socket is closed) and the server's 4 KB limit on a frame.

function rig() {
  const sockets = new FakeSockets();
  const connection = new LiveConnection({ factory: sockets, token: async () => ({ token: "t1", url: "wss://example.test/v1/live" }), onEvent: () => {}, onReady: () => {}, wait: async () => {}, backoff: () => 0 });
  return { sockets, connection };
}

describe("sending a frame over the live socket", () => {
  it("sends the duel answer once the server said ready", async () => {
    const { sockets, connection } = rig();
    expect(connection.send("x")).toBe(false); // not started
    connection.start();
    expect(await eventually(() => sockets.sockets.length === 1)).toBe(true);
    const socket = sockets.sockets[0]!;
    expect(connection.send(duelAnswerFrame("g1", 2, 1))).toBe(false); // connecting: only the auth frame has gone
    socket.ready();
    expect(connection.send(duelAnswerFrame("g1", 2, 1))).toBe(true);
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({ type: "duel.answer", gameId: "g1", round: 2, option: 1 });
    connection.stop();
    expect(connection.send("x")).toBe(false);
  });

  it("sends nothing over 4 KB, which would close the socket, and counts bytes, not letters", async () => {
    const { sockets, connection } = rig();
    connection.start();
    expect(await eventually(() => sockets.sockets.length === 1)).toBe(true);
    const socket = sockets.sockets[0]!;
    socket.ready();
    const sentBefore = socket.sent.length;
    expect(connection.send("a".repeat(maxFrameBytes))).toBe(true);
    expect(connection.send("a".repeat(maxFrameBytes + 1))).toBe(false);
    expect(connection.send("د".repeat(maxFrameBytes / 2 + 1))).toBe(false); // two bytes a letter
    expect(connection.send("د".repeat(maxFrameBytes / 2))).toBe(true);
    expect(socket.sent.length).toBe(sentBefore + 2);
    connection.stop();
  });

  it("sends nothing while the socket is lost and waiting for the next try", async () => {
    const { sockets, connection } = rig();
    connection.start();
    expect(await eventually(() => sockets.sockets.length === 1)).toBe(true);
    sockets.sockets[0]!.ready();
    sockets.sockets[0]!.end(4409); // evicted: no next try
    expect(await eventually(() => connection.state === "evicted")).toBe(true);
    expect(connection.send("x")).toBe(false);
    connection.stop();
  });
});
