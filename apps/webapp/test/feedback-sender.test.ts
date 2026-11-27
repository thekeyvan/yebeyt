import { describe, expect, it } from "vitest";
import { FeedbackLog } from "../lib/feedback/log";
import { buildPayload } from "../lib/feedback/payload";
import { busyLine, FeedbackSender, offlineLine, rateLine } from "../lib/feedback/sender";
import { newDraft, type FeedbackType } from "../lib/feedback/types";
import { ApiError } from "../lib/account/api";

const id = "6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11";
const created = { id, uploadToken: "tok-1" };
const reportPath = "/api/v1/feedback";
const screenshotPath = `/api/v1/feedback/${id}/screenshot`;
const recordingPath = `/api/v1/feedback/${id}/recording`;

type Seen = { method: string; path: string; headers: Record<string, string>; body: unknown };
const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers });

/** A server that answers each call with `answer`, and what it was asked. */
function server(answer: (call: Seen) => Response | "offline") {
  const seen: Seen[] = [];
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Seen = { method: init?.method ?? "GET", path: String(input), headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body };
    seen.push(call);
    const reply = answer(call);
    if (reply === "offline") throw new TypeError("offline");
    return reply;
  }) as typeof fetch;
  return { send, seen, to: (path: string) => seen.filter((call) => call.path === path) };
}

const payload = (type: FeedbackType = "bug") => {
  const draft = newDraft(type);
  draft.text = "نوشته";
  return buildPayload(draft, { screen: "خونه", textSettings: {}, network: "wifi", accountState: "guest", recentErrors: [], steps: [] }, { appVersion: "x", deviceModel: "y", osVersion: "z" });
};

const shot = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])]);
const video = new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])]);
const happy = (call: Seen) => (call.method === "POST" ? json(201, created) : json(204));

describe("sending a report (FeedbackSenderTests)", () => {
  it("makes the report, then sends the screenshot and the recording with the upload token, in this order", async () => {
    const door = server(happy);
    const sender = new FeedbackSender({ send: door.send, log: new FeedbackLog() });
    expect(await sender.submit(payload(), { screenshot: shot, recording: video })).toEqual({ sent: true });
    expect(door.seen.map((call) => `${call.method} ${call.path}`)).toEqual([`POST ${reportPath}`, `PUT ${screenshotPath}`, `PUT ${recordingPath}`]);
    expect(door.seen[1]!.headers).toMatchObject({ "x-upload-token": "tok-1", "content-type": "image/jpeg" });
    expect(door.seen[1]!.body).toBe(shot);
    expect(door.seen[2]!.headers).toMatchObject({ "x-upload-token": "tok-1", "content-type": "video/mp4" });
    expect(door.seen[0]!.headers["content-type"]).toBe("application/json");
  });

  it("a report refused with 401 (a session the server no longer knows) is sent again, as a guest's", async () => {
    let first = true;
    const door = server((call) => (call.path === reportPath && first ? ((first = false), json(401, { error: "unauthorized" })) : happy(call)));
    expect(await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload("idea"), {})).toEqual({ sent: true });
    expect(door.to(reportPath)).toHaveLength(2);
  });

  it("a busy server is asked again once after its Retry-After, and not for a second report", async () => {
    let uploads = 0;
    const door = server((call) => (call.method === "POST" ? json(201, created) : ++uploads === 1 ? json(503, { error: "busy" }, { "retry-after": "4" }) : json(204)));
    const waits: number[] = [];
    const sender = new FeedbackSender({ send: door.send, log: new FeedbackLog(), pause: async (seconds) => void waits.push(seconds) });
    expect(await sender.submit(payload(), { screenshot: shot })).toEqual({ sent: true });
    expect(door.to(screenshotPath)).toHaveLength(2);
    expect(waits).toEqual([4]);
    expect(door.to(reportPath)).toHaveLength(1);
  });

  it("a server that stays busy fails, and sending again carries on with the same report", async () => {
    let busy = true;
    const door = server((call) => (call.method === "POST" ? json(201, created) : busy ? json(503, { error: "busy" }, { "retry-after": "1" }) : json(204)));
    const sender = new FeedbackSender({ send: door.send, log: new FeedbackLog(), pause: async () => {} });
    expect(await sender.submit(payload(), { screenshot: shot })).toEqual({ sent: false, line: busyLine });
    expect(sender.hasCreatedReport).toBe(true);
    busy = false;
    expect(await sender.submit(payload(), { screenshot: shot })).toEqual({ sent: true });
    expect(door.to(reportPath)).toHaveLength(1);
    expect(door.to(screenshotPath)).toHaveLength(3);
  });

  it("offline keeps the draft with the offline line, and sending later works", async () => {
    let online = false;
    const door = server((call) => (online ? happy(call) : "offline"));
    const log = new FeedbackLog();
    const sender = new FeedbackSender({ send: door.send, log });
    expect(await sender.submit(payload(), {})).toEqual({ sent: false, line: offlineLine });
    expect(sender.hasCreatedReport).toBe(false);
    expect(log.errors).toEqual(["network"]);
    online = true;
    expect(await sender.submit(payload(), {})).toEqual({ sent: true });
  });

  it("the door being unreachable (its 502) is offline too, and a timeout (408)", async () => {
    for (const status of [502, 408]) {
      const door = server(() => json(status));
      expect(await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload(), {})).toEqual({ sent: false, line: offlineLine });
    }
  });

  it("too many reports says to try a little later", async () => {
    const door = server(() => json(429, { error: "rate_limited" }));
    expect(await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload(), {})).toEqual({ sent: false, line: rateLine });
  });

  it("other failures show the generic line, never a code", async () => {
    const door = server(() => json(500, { error: "internal_error" }));
    const outcome = await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload(), {});
    expect(outcome).toEqual({ sent: false, line: new ApiError(500).persianMessage });
  });

  it("a file the server will never take does not stop the report", async () => {
    const door = server((call) => (call.method === "POST" ? json(201, created) : call.path === screenshotPath ? json(413, { error: "payload_too_large" }) : json(409, { error: "already_uploaded" })));
    const log = new FeedbackLog();
    expect(await new FeedbackSender({ send: door.send, log }).submit(payload(), { screenshot: shot, recording: video })).toEqual({ sent: true });
    expect(log.errors).toEqual(["413 payload_too_large", "409 already_uploaded"]);
  });

  it("an upload rate limit asks to try later", async () => {
    const door = server((call) => (call.method === "POST" ? json(201, created) : json(429, { error: "rate_limited" })));
    expect(await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload(), { screenshot: shot })).toEqual({ sent: false, line: rateLine });
  });

  it("an answer that is not a report is a failure, not a report", async () => {
    const door = server(() => json(201, { nothing: true }));
    expect((await new FeedbackSender({ send: door.send, log: new FeedbackLog() }).submit(payload(), {})).sent).toBe(false);
  });
});
