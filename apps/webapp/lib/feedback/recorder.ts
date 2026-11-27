import { devPagesEnabled } from "../dev";

/** How big a recording may get: at most 60 seconds, under the server's 25 MB (RecordingBudget in ScreenRecorder.swift). */
export const maxSeconds = 60;
export const maxBytes = 25_000_000;

/** Bits per second that keep a full-length recording at 80% of the size limit, and never above 2.5 Mbit. */
export const bitrate = (seconds = maxSeconds, bytes = maxBytes): number => Math.min(2_500_000, Math.floor((bytes * 8 * 8) / 10 / Math.max(seconds, 1)));

/** What was recorded: an MP4 (the only kind the server takes) and its length in seconds. */
export type Clip = { blob: Blob; seconds: number };

export type StartResult = "started" | "denied" | "failed";

/** What the feedback flow needs from a screen recorder (a fake one stands in for it in tests). */
export interface ScreenRecording {
  readonly isAvailable: boolean;
  /** Asks the browser's screen-capture prompt and starts; `ended` is told when the browser's own «stop sharing» ends it. «denied» is the person saying no. */
  start(ended: () => void): Promise<StartResult>;
  /** Stops and answers the clip, or undefined when nothing usable was recorded. */
  stop(): Promise<Clip | undefined>;
}

const mp4Types = ["video/mp4;codecs=avc1", "video/mp4"];

const mp4Type = (): string | undefined => (typeof MediaRecorder === "undefined" ? undefined : mp4Types.find((type) => MediaRecorder.isTypeSupported(type)));

/**
 * The browser's own screen capture (`getDisplayMedia`) recorded with `MediaRecorder`, no sound. The server takes only MP4, so a browser that can't record MP4 (Firefox, a
 * Chrome older than 126) has no recording; a browser with no `getDisplayMedia` (iPhone Safari) neither.
 */
export class BrowserRecorder implements ScreenRecording {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private started = 0;

  get isAvailable(): boolean {
    return typeof navigator.mediaDevices?.getDisplayMedia === "function" && mp4Type() !== undefined;
  }

  async start(ended: () => void): Promise<StartResult> {
    const type = mp4Type();
    if (!type) return "failed";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions);
    } catch (error) {
      return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "failed";
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate() });
      this.chunks = [];
      recorder.ondataavailable = ({ data }) => data.size > 0 && this.chunks.push(data);
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", ended));
      recorder.start(1000);
      this.started = Date.now();
      this.recorder = recorder;
      return "started";
    } catch {
      stream.getTracks().forEach((track) => track.stop());
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
    const blob = new Blob(this.chunks, { type: "video/mp4" });
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
