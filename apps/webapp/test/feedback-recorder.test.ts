import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRecorder } from "../lib/feedback/recorder";

/** A track of a stream the fake `getDisplayMedia` gives: `surface` is what `getSettings().displaySurface` says. */
type FakeTrack = { stopped: number; getSettings: () => object; getCaptureHandle?: () => { handle?: string } | null; addEventListener: (type: string, listener: () => void) => void; end: () => void; stop: () => void };

function fakeTrack(surface: string, handle?: string | null): FakeTrack {
  const listeners: Record<string, () => void> = {};
  return {
    stopped: 0,
    getSettings: () => (surface ? { displaySurface: surface } : {}), // none: a browser that does not say
    ...(handle === undefined ? {} : { getCaptureHandle: () => (handle === null ? null : { handle }) }),
    addEventListener: (type: string, listener: () => void) => void (listeners[type] = listener),
    end: () => listeners.ended?.(),
    stop() {
      this.stopped++;
    },
  };
}

class FakeRecorder {
  static supported = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  static isTypeSupported = (type: string) => FakeRecorder.supported.includes(type);
  static made: FakeRecorder[] = [];
  state = "inactive";
  mimeType: string;
  ondataavailable: (event: { data: Blob }) => void = () => {};
  onstop: () => void = () => {};
  constructor(
    readonly stream: { getTracks: () => unknown[] },
    options: { mimeType: string; videoBitsPerSecond: number },
  ) {
    this.mimeType = options.mimeType;
    FakeRecorder.made.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable({ data: new Blob(["frames"]) });
    this.onstop();
  }
}

type Config = { handle?: string; permittedOrigins?: string[] };

function setUp({ surface = "browser", handle, supportsSurface = true, handleApi = false }: { surface?: string; handle?: "same" | "other" | null; supportsSurface?: boolean; handleApi?: boolean } = {}) {
  const configs: Config[] = [];
  const asked: unknown[] = [];
  const track = fakeTrack(surface, handle === undefined ? undefined : handle === null ? null : handle === "same" ? "same" : "other");
  const devices: Record<string, unknown> = {
    getSupportedConstraints: () => ({ displaySurface: supportsSurface }),
    getDisplayMedia: vi.fn(async (options: unknown) => {
      asked.push(options);
      // A captured tab that is this one answers with the name this tab gave itself.
      if (handle === "same") track.getCaptureHandle = () => ({ handle: configs.at(-1)?.handle });
      return { getVideoTracks: () => [track], getTracks: () => [track] };
    }),
  };
  if (handleApi) devices.setCaptureHandleConfig = (config: Config) => void configs.push(config);
  Object.defineProperty(navigator, "mediaDevices", { value: devices, configurable: true });
  return { track, asked, configs, devices };
}

beforeEach(() => {
  FakeRecorder.supported = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  FakeRecorder.made = [];
  vi.stubGlobal("MediaRecorder", FakeRecorder);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("the browser's recorder asks for this page only (ScreenRecorder.swift's ReplayKit records the app's own screen)", () => {
  it("asks for this tab, offers no other surface, and records it when the browser says it is a tab", async () => {
    const { asked, track } = setUp();
    const recorder = new BrowserRecorder();
    expect(await recorder.start(() => {})).toBe("started");
    expect(asked[0]).toMatchObject({ video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", monitorTypeSurfaces: "exclude" });
    expect(track.stopped).toBe(0);
  });

  it.each(["monitor", "window", ""])("refuses a stream whose surface is «%s» (nothing: the browser does not say), and stops its tracks", async (surface) => {
    const { track } = setUp({ surface });
    const recorder = new BrowserRecorder();
    expect(await recorder.start(() => {})).toBe("elsewhere");
    expect(track.stopped).toBe(1);
    expect(FakeRecorder.made).toHaveLength(0);
    expect(await recorder.stop()).toBeUndefined();
  });

  it("with Capture Handle, the captured tab must give back the name this tab gave itself", async () => {
    const same = setUp({ handleApi: true, handle: "same" });
    expect(await new BrowserRecorder().start(() => {})).toBe("started");
    expect(same.configs[0]).toMatchObject({ permittedOrigins: [location.origin] });
    expect(same.configs[0]!.handle).toMatch(/^[0-9a-f-]{36}$/);

    const other = setUp({ handleApi: true, handle: "other" });
    expect(await new BrowserRecorder().start(() => {})).toBe("elsewhere");
    expect(other.track.stopped).toBe(1);

    const none = setUp({ handleApi: true, handle: null }); // a tab that gave no handle
    expect(await new BrowserRecorder().start(() => {})).toBe("elsewhere");
    expect(none.track.stopped).toBe(1);
  });

  it("without Capture Handle (no API, or a track that has none) the surface is all that is checked", async () => {
    setUp({ handleApi: false });
    expect(await new BrowserRecorder().start(() => {})).toBe("started");
    setUp({ handleApi: true }); // the API, but the track can't tell
    expect(await new BrowserRecorder().start(() => {})).toBe("started");
  });

  it("the person saying no is «denied», anything else that goes wrong is «failed»", async () => {
    const { devices } = setUp();
    devices.getDisplayMedia = vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError"));
    expect(await new BrowserRecorder().start(() => {})).toBe("denied");
    devices.getDisplayMedia = vi.fn().mockRejectedValue(new DOMException("busy", "NotReadableError"));
    expect(await new BrowserRecorder().start(() => {})).toBe("failed");
  });

  it("the browser's own «stop sharing» is told", async () => {
    const { track } = setUp();
    const ended = vi.fn();
    await new BrowserRecorder().start(ended);
    track.end();
    expect(ended).toHaveBeenCalledOnce();
  });
});

describe("what is recorded", () => {
  it("is MP4 where the browser can, else WebM, and the clip says which", async () => {
    setUp();
    const mp4 = new BrowserRecorder();
    await mp4.start(() => {});
    expect(FakeRecorder.made[0]!.mimeType).toBe("video/mp4;codecs=avc1");
    expect((await mp4.stop())?.blob.type).toBe("video/mp4");

    FakeRecorder.supported = ["video/webm;codecs=vp9", "video/webm"];
    const webm = new BrowserRecorder();
    await webm.start(() => {});
    expect(FakeRecorder.made[1]!.mimeType).toBe("video/webm;codecs=vp9");
    const clip = await webm.stop();
    expect(clip?.blob.type).toBe("video/webm");
    expect(clip?.seconds).toBeGreaterThanOrEqual(1);
  });

  it("stops the tracks when it stops, and takes the capture handle back", async () => {
    const { track, configs } = setUp({ handleApi: true, handle: "same" });
    const recorder = new BrowserRecorder();
    await recorder.start(() => {});
    await recorder.stop();
    expect(track.stopped).toBe(1);
    expect(configs.at(-1)).toMatchObject({ handle: "", permittedOrigins: [] });
  });
});

describe("where the option is offered", () => {
  it("needs getDisplayMedia, a type to record, and a browser that can say which surface it captures", () => {
    setUp();
    expect(new BrowserRecorder().isAvailable).toBe(true);
    FakeRecorder.supported = ["video/webm"];
    expect(new BrowserRecorder().isAvailable).toBe(true); // WebM will do
    FakeRecorder.supported = [];
    expect(new BrowserRecorder().isAvailable).toBe(false);
    FakeRecorder.supported = ["video/mp4"];
    setUp({ supportsSurface: false });
    expect(new BrowserRecorder().isAvailable).toBe(false);
    const { devices } = setUp();
    delete devices.getDisplayMedia;
    expect(new BrowserRecorder().isAvailable).toBe(false);
  });
});
