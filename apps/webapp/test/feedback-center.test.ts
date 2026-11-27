import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackCenter, feedbackCopy, recordingNote, type Browser } from "../lib/feedback/center";
import { FeedbackLog } from "../lib/feedback/log";
import { FeedbackModel } from "../lib/feedback/model";
import type { Mark } from "../lib/feedback/markup";
import { bitrate, maxBytes, maxSeconds, type Clip, type ScreenRecording, type StartResult } from "../lib/feedback/recorder";
import { FeedbackSender, offlineLine } from "../lib/feedback/sender";
import type { TechnicalInfo } from "../lib/feedback/technical";

const info: TechnicalInfo = { screen: "تنظیمات", textSettings: {}, network: "wifi", accountState: "guest", recentErrors: [], steps: ["خونه", "تنظیمات"] };
const device = { appVersion: "6a184da", deviceModel: "Chrome 130 · 375×667 · fa", osVersion: "Android 14" };
const id = "6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11";

class FakeRecorder implements ScreenRecording {
  isAvailable = true;
  result: StartResult = "started";
  clip?: Clip;
  stops = 0;
  ended = () => {};
  async start(ended: () => void) {
    this.ended = ended;
    return this.result;
  }
  async stop() {
    this.stops++;
    return this.clip;
  }
}

function fixture(answer: (call: { method: string; path: string }) => Response | "offline" = (call) => (call.method === "POST" ? Response.json({ id, uploadToken: "t" }, { status: 201 }) : new Response(null, { status: 204 }))) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { method: init?.method ?? "GET", path: String(input), body: init?.body };
    requests.push(call);
    const reply = answer(call);
    if (reply === "offline") throw new TypeError("offline");
    return reply;
  }) as typeof fetch;
  const recorder = new FakeRecorder();
  const said: string[] = [];
  const covers = { on: 0, off: 0 };
  const keyboard = { closed: 0 };
  const browser: Browser = {
    capture: async () => new Blob(["png"], { type: "image/png" }),
    recorder,
    info: () => info,
    device: () => device,
    say: (line) => void said.push(line),
    cover: () => (covers.on++, () => void covers.off++),
    drawn: async () => {},
    dismissKeyboard: () => void keyboard.closed++,
    sender: () => new FeedbackSender({ send, log: new FeedbackLog() }),
    encode: async () => new Blob(["jpeg"]),
  };
  return { center: new FeedbackCenter(browser), recorder, said, covers, keyboard, requests };
}

describe("opening and closing (FeedbackCenterTests)", () => {
  it("opens with the screenshot and the state of the moment, at the choices", async () => {
    const f = fixture();
    expect(await f.center.open()).toBe(true);
    const { moment, model } = f.center.snapshot();
    expect(f.center.isOpen && model === undefined).toBe(true);
    expect(moment?.info).toBe(info);
    expect(moment?.device).toBe(device);
    expect(moment?.screenshot?.type).toBe("image/png");
    expect(f.keyboard.closed).toBe(1);
  });

  it("a second ask while the sheet is open, or while the page is being drawn, does nothing", async () => {
    const f = fixture();
    const first = f.center.open();
    expect(await f.center.open()).toBe(false);
    expect(await first).toBe(true);
    expect(await f.center.open()).toBe(false);
    expect(f.keyboard.closed).toBe(1);
  });

  it("picking a type starts its draft, and closing drops it so it can open again", async () => {
    const f = fixture();
    await f.center.open();
    f.center.choose("idea");
    expect(f.center.snapshot().model?.snapshot().draft.screenshotOn).toBe(false);
    f.center.close();
    expect(f.center.snapshot().model).toBeUndefined();
    expect(f.center.isOpen).toBe(false);
    expect(await f.center.open("bug")).toBe(true);
    expect(f.center.snapshot().model?.type).toBe("bug");
  });

  it("a type picked twice keeps the first draft", async () => {
    const f = fixture();
    await f.center.open();
    f.center.choose("idea");
    f.center.snapshot().model?.edit({ text: "ایده" });
    f.center.choose("bug");
    expect(f.center.snapshot().model?.type).toBe("idea");
  });
});

describe("closing with something written", () => {
  it("closing the choices or an empty form asks nothing, and spaces are not a report", async () => {
    const f = fixture();
    await f.center.open();
    f.center.requestClose();
    expect(f.center.isOpen).toBe(false);
    await f.center.open("idea");
    f.center.snapshot().model?.edit({ text: "  \n " });
    expect(f.center.snapshot().model?.hasUnsentWork).toBe(false);
    f.center.requestClose();
    expect(f.center.isOpen || f.center.snapshot().isConfirmingClose).toBe(false);
  });

  it("typed text, marks on the screenshot or a recording ask before closing, and nothing is dropped until the person says so", async () => {
    const f = fixture();
    await f.center.open("bug");
    const model = f.center.snapshot().model!;
    model.edit({ text: "یه چیزی شد" });
    expect(model.hasUnsentWork).toBe(true);
    model.edit({ text: "" });
    expect(model.hasUnsentWork).toBe(false);
    model.setEdited(new Blob(["x"]));
    expect(model.hasUnsentWork).toBe(true);
    model.setRecording({ blob: new Blob(["v"]), seconds: 3 });
    model.edit({ text: "نوشتم" });
    f.center.requestClose();
    expect(f.center.snapshot().isConfirmingClose && f.center.isOpen).toBe(true);
    expect(f.keyboard.closed).toBe(2);
    f.center.confirm(false); // «بمون»
    expect(f.center.snapshot().model?.snapshot().draft.text).toBe("نوشتم");
    expect(f.center.isOpen).toBe(true);
    f.center.requestClose();
    f.center.close(); // «ول کن»
    expect(f.center.isOpen || f.center.snapshot().isConfirmingClose).toBe(false);
  });

  it("a game idea with only a name counts as written", async () => {
    const f = fixture();
    await f.center.open("game");
    f.center.snapshot().model?.edit({ gameName: "بیت عوضی" });
    expect(f.center.snapshot().model?.hasUnsentWork).toBe(true);
  });

  it("the question is the lead's copy", () => {
    expect(feedbackCopy.title).toBe("بازخوردت هنوز فرستاده نشده. ولش کنی؟");
    expect([feedbackCopy.discard, feedbackCopy.stay]).toEqual(["ول کن", "بمون"]);
    expect(feedbackCopy.filesTitle).toBe("فیلم یا عکست فرستاده نشده. ولش کنی؟");
    expect([feedbackCopy.recordingTitle, feedbackCopy.recordingDelete, feedbackCopy.recordingKeep]).toEqual(["فیلم پاک بشه؟", "پاک کن", "نه"]);
  });

  it("when only a file did not go the question says so and still asks", async () => {
    const f = fixture((call) => (call.method === "POST" ? Response.json({ id, uploadToken: "t" }, { status: 201 }) : Response.json({ error: "busy" }, { status: 503, headers: { "retry-after": "1" } })));
    await f.center.open("bug");
    const model = f.center.snapshot().model!;
    expect(f.center.closeQuestion).toBe(feedbackCopy.title);
    model.edit({ text: "باگ" });
    model.setRecording({ blob: new Blob(["v"]), seconds: 2 });
    vi.useFakeTimers();
    const sending = f.center.send();
    await vi.runAllTimersAsync();
    await sending;
    vi.useRealTimers();
    expect(model.reportReachedServer && model.snapshot().failure !== undefined && f.center.isOpen).toBe(true);
    expect(f.center.closeQuestion).toBe("فیلم یا عکست فرستاده نشده. ولش کنی؟");
    f.center.requestClose();
    expect(f.center.snapshot().isConfirmingClose).toBe(true);
  });
});

describe("sending", () => {
  it("a sent report closes the sheet and thanks; nothing written sends nothing", async () => {
    const f = fixture();
    await f.center.open();
    f.center.choose("liked");
    await f.center.send();
    expect(f.requests).toEqual([]);
    f.center.snapshot().model?.edit({ text: "خیلی خوبه" });
    await f.center.send();
    expect(f.said).toEqual(["رسید، ممنون!"]);
    expect(f.center.isOpen).toBe(false);
    expect(JSON.parse(f.requests[0]!.body as string)).toMatchObject({ type: "liked", text: "خیلی خوبه" });
  });

  it("a failed send keeps the sheet, the draft and the button, and sending later works", async () => {
    let online = false;
    const f = fixture((call) => (online ? (call.method === "POST" ? Response.json({ id, uploadToken: "t" }, { status: 201 }) : new Response(null, { status: 204 })) : "offline"));
    await f.center.open();
    f.center.choose("idea");
    const model = f.center.snapshot().model!;
    model.edit({ text: "ایده" });
    await f.center.send();
    expect(model.snapshot().failure).toBe(offlineLine);
    expect(f.center.isOpen && f.said.length === 0 && model.canSend && !model.isLocked).toBe(true);
    online = true;
    await f.center.send();
    expect(f.said).toEqual(["رسید، ممنون!"]);
  });
});

describe("which files go with a report", () => {
  const files = async (type: "bug" | "idea" | "game", edit: { screenshotOn?: boolean }, recording = false) => {
    const requests: string[] = [];
    const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method} ${String(input).replace(id, "<id>")}`);
      return init?.method === "POST" ? Response.json({ id, uploadToken: "t" }, { status: 201 }) : new Response(null, { status: 204 });
    }) as typeof fetch;
    const model = new FeedbackModel(type, { screenshot: new Blob(["png"]), info, device }, new FeedbackSender({ send, log: new FeedbackLog() }), async () => new Blob(["jpeg"]));
    model.edit({ text: "نوشته", ...edit });
    if (recording) model.setRecording({ blob: new Blob(["v"]), seconds: 2 });
    await model.send();
    return requests.slice(1);
  };

  it("the screenshot goes when the type takes one and the switch is on", async () => {
    expect(await files("bug", {})).toEqual(["PUT /api/v1/feedback/<id>/screenshot"]);
    expect(await files("bug", { screenshotOn: false })).toEqual([]);
    expect(await files("idea", {})).toEqual([]);
    expect(await files("idea", { screenshotOn: true })).toEqual(["PUT /api/v1/feedback/<id>/screenshot"]);
    expect(await files("game", { screenshotOn: true })).toEqual([]);
  });

  it("the recording goes with a bug, after the screenshot", async () => {
    expect(await files("bug", {}, true)).toEqual(["PUT /api/v1/feedback/<id>/screenshot", "PUT /api/v1/feedback/<id>/recording"]);
    expect(await files("idea", {}, true)).toEqual([]);
  });
});

describe("the editor's marks", () => {
  const model = () => new FeedbackModel("bug", { screenshot: new Blob(["png"]), info, device }, undefined, undefined, async () => new Blob(["marked"]));
  const box: Mark = { kind: "cover", rect: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } };

  it("«تمام» with marks makes the marked picture the one that is sent, and it is work that closing asks about", async () => {
    const draft = model();
    draft.show("editor");
    expect(draft.snapshot().over).toBe("editor");
    expect(draft.hasUnsentWork).toBe(false);
    await draft.finishEditing([box]);
    expect(draft.snapshot().over).toBeUndefined();
    expect(await draft.image?.text()).toBe("marked");
    expect(draft.hasUnsentWork).toBe(true);
  });

  it("× or «تمام» with no marks leaves the picture as it was", async () => {
    const draft = model();
    draft.show("editor");
    await draft.finishEditing([]);
    expect(draft.snapshot().over).toBeUndefined();
    expect(await draft.image?.text()).toBe("png");
    expect(draft.hasUnsentWork).toBe(false);
  });
});

describe("recording", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const start = async (f: ReturnType<typeof fixture>) => {
    await f.center.open("bug");
    await f.center.startRecording();
  };

  it("the sheet goes, the private views are covered, and the pill is on", async () => {
    const f = fixture();
    await start(f);
    expect(f.center.snapshot()).toMatchObject({ isRecording: true, starting: false });
    expect(f.covers).toEqual({ on: 1, off: 0 });
  });

  it("«تموم» keeps the clip on the form and uncovers only after the recorder has stopped", async () => {
    const f = fixture();
    f.recorder.clip = { blob: new Blob(["v"]), seconds: 9 };
    await start(f);
    await f.center.stopRecording();
    expect(f.center.snapshot().isRecording).toBe(false);
    expect(f.recorder.stops).toBe(1);
    expect(f.covers).toEqual({ on: 1, off: 1 });
    expect(f.center.snapshot().model?.snapshot().recording?.seconds).toBe(9);
    await f.center.stopRecording(); // nothing is recording any more
    expect(f.recorder.stops).toBe(1);
  });

  it("the browser's own «stop sharing» ends it the same way", async () => {
    const f = fixture();
    f.recorder.clip = { blob: new Blob(["v"]), seconds: 2 };
    await start(f);
    f.recorder.ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.center.snapshot().isRecording).toBe(false);
    expect(f.center.snapshot().model?.snapshot().recording).toBeDefined();
  });

  it("stops by itself at the limit", async () => {
    const f = fixture();
    f.recorder.clip = { blob: new Blob(["v"]), seconds: maxSeconds };
    await start(f);
    await vi.advanceTimersByTimeAsync(maxSeconds * 1000 - 1);
    expect(f.center.snapshot().isRecording).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.center.snapshot().isRecording).toBe(false);
  });

  it("a recording that gave nothing says so", async () => {
    const f = fixture();
    await start(f);
    await f.center.stopRecording();
    expect(f.said).toEqual([recordingNote]);
    expect(f.center.snapshot().model?.snapshot().recording).toBeUndefined();
  });

  it("the option is hidden only when the person said no, or the browser can't", async () => {
    const denied = fixture();
    denied.recorder.result = "denied";
    await start(denied);
    expect(denied.center.snapshot()).toMatchObject({ recordingRefused: true, isRecording: false, starting: false });
    expect(denied.center.recordingAvailable).toBe(false);
    expect(denied.covers).toEqual({ on: 1, off: 1 });

    const broken = fixture();
    broken.recorder.result = "failed";
    await start(broken);
    expect(broken.center.snapshot().recordingRefused).toBe(false);
    expect(broken.center.recordingAvailable).toBe(true);
    expect(broken.said).toEqual([recordingNote]);
    expect(broken.covers).toEqual({ on: 1, off: 1 });

    const none = fixture();
    none.recorder.isAvailable = false;
    expect(none.center.recordingAvailable).toBe(false);
  });

  it("only a bug takes a recording, and not while one is on", async () => {
    const f = fixture();
    await f.center.open("annoyed");
    await f.center.startRecording();
    expect(f.covers.on).toBe(0);
    const g = fixture();
    await start(g);
    await g.center.startRecording();
    expect(g.covers.on).toBe(1);
    expect(await g.center.open()).toBe(false);
  });

  it("the recording fits the limits by design", () => {
    expect(maxSeconds).toBe(60);
    expect((bitrate() * maxSeconds) / 8).toBeLessThanOrEqual(maxBytes);
    expect(bitrate(60, 5_000_000)).toBeLessThan(bitrate());
  });
});
