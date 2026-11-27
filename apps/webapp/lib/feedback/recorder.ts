import { devPagesEnabled } from "../dev";

/** How big a recording may get: at most 60 seconds, under the server's 25 MB (RecordingBudget in ScreenRecorder.swift). */
export const maxSeconds = 60;
export const maxBytes = 25_000_000;

/** Bits per second that keep a full-length recording at 80% of the size limit, and never above 2.5 Mbit. */
export const bitrate = (seconds = maxSeconds, bytes = maxBytes): number => Math.min(2_500_000, Math.floor((bytes * 8 * 8) / 10 / Math.max(seconds, 1)));

/** What was recorded: an MP4 or a WebM (the two kinds the server takes) and its length in seconds. */
export type Clip = { blob: Blob; seconds: number };

/** «elsewhere»: the person chose another tab, a window or the whole screen, which is refused (only this page is recorded). */
export type StartResult = "started" | "denied" | "failed" | "elsewhere";

/** What the feedback flow needs from a screen recorder (a fake one stands in for it in tests). */
export interface ScreenRecording {
  readonly isAvailable: boolean;
  /** Asks the browser's screen-capture prompt and starts; `ended` is told when the browser's own «stop sharing» ends it. «denied» is the person saying no. */
  start(ended: () => void): Promise<StartResult>;
  /** Stops and answers the clip, or undefined when nothing usable was recorded. */
  stop(): Promise<Clip | undefined>;
}

/** What the browser records, the one it likes best first: MP4 where it can (it plays everywhere), else WebM. */
const recordingTypes = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

const recordingType = (): string | undefined => (typeof MediaRecorder === "undefined" ? undefined : recordingTypes.find((type) => MediaRecorder.isTypeSupported(type)));

type Devices = MediaDevices & { setCaptureHandleConfig?: (config: { handle: string; exposeOrigin: boolean; permittedOrigins: string[] }) => void };
type CapturedTrack = MediaStreamTrack & { getCaptureHandle?: () => { handle?: string } | null | undefined };

/**
 * The browser's own screen capture (`getDisplayMedia`) recorded with `MediaRecorder`, no sound, of this page only: the prompt is asked for this tab (and offers no other
 * tab, window or screen where the browser lets it be so), and a stream that is not this tab is refused and stopped. A browser with no `getDisplayMedia` (iPhone Safari), none that
 * can record MP4 or WebM, or none that says which surface it captures (`displaySurface`, so it can't be checked) has no recording.
 */
export class BrowserRecorder implements ScreenRecording {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private started = 0;

  get isAvailable(): boolean {
    const devices = navigator.mediaDevices;
    return typeof devices?.getDisplayMedia === "function" && devices.getSupportedConstraints?.().displaySurface === true && recordingType() !== undefined;
  }

  async start(ended: () => void): Promise<StartResult> {
    const type = recordingType();
    if (!type) return "failed";
    const devices = navigator.mediaDevices as Devices;
    // Capture Handle, where there is one: this tab gives itself a name only it knows, and the captured tab must say it.
    const handle = crypto.randomUUID();
    try {
      devices.setCaptureHandleConfig?.({ handle, exposeOrigin: false, permittedOrigins: [location.origin] });
    } catch {
      // No handle: the surface is checked without it.
    }
    let stream: MediaStream;
    try {
      stream = await devices.getDisplayMedia({
        video: { frameRate: 30, displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude",
      } as DisplayMediaStreamOptions);
    } catch (error) {
      return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "failed";
    }
    const track = stream.getVideoTracks()[0] as CapturedTrack | undefined;
    const handled = typeof devices.setCaptureHandleConfig !== "function" || typeof track?.getCaptureHandle !== "function" || track.getCaptureHandle()?.handle === handle;
    if (!track || (track.getSettings() as { displaySurface?: string }).displaySurface !== "browser" || !handled) {
      stream.getTracks().forEach((each) => each.stop());
      return "elsewhere";
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate() });
      this.chunks = [];
      recorder.ondataavailable = ({ data }) => data.size > 0 && this.chunks.push(data);
      track.addEventListener("ended", ended);
      recorder.start(1000);
      this.started = Date.now();
      this.recorder = recorder;
      return "started";
    } catch {
      stream.getTracks().forEach((each) => each.stop());
      return "failed";
    }
  }

  async stop(): Promise<Clip | undefined> {
    const { recorder } = this;
    if (!recorder) return undefined;
    this.recorder = undefined;
    const seconds = Math.max(1, Math.round((Date.now() - this.started) / 1000));
    if (recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    recorder.stream.getTracks().forEach((track) => track.stop());
    try {
      (navigator.mediaDevices as Devices).setCaptureHandleConfig?.({ handle: "", exposeOrigin: false, permittedOrigins: [] });
    } catch {
      // Nothing to take back.
    }
    const blob = new Blob(this.chunks, { type: recorder.mimeType.split(";")[0] });
    this.chunks = [];
    return blob.size > 0 && blob.size <= maxBytes ? { blob, seconds } : undefined;
  }
}

/** The ftyp box an MP4 starts with: the first bytes the server checks. */
const fakeFile = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31]);

/** Stands in for the browser's recorder (`sessionStorage.beytFakeRecorder = "1"`, the phone's `-beytFakeRecorder 1`): it starts at once with no prompt and keeps a tiny file. */
export class FakeRecorder implements ScreenRecording {
  readonly isAvailable = true;
  private started = 0;

  async start(): Promise<StartResult> {
    this.started = Date.now();
    return "started";
  }

  async stop(): Promise<Clip | undefined> {
    return { blob: new Blob([fakeFile], { type: "video/mp4" }), seconds: Math.max(1, Math.round((Date.now() - this.started) / 1000)) };
  }
}

/** The recorder of this browser: the fake one when a debug build is asked for it, else the browser's own. */
export function currentRecorder(): ScreenRecording {
  try {
    if (devPagesEnabled() && sessionStorage.getItem("beytFakeRecorder") === "1") return new FakeRecorder();
  } catch {
    // No session storage: the browser's own.
  }
  return new BrowserRecorder();
}
