import { Store } from "../reader/store";
import type { DeviceInfo } from "./device";
import { FeedbackModel, type Moment } from "./model";
import { maxSeconds, type ScreenRecording } from "./recorder";
import { FeedbackSender, thanks } from "./sender";
import type { TechnicalInfo } from "./technical";
import { takesRecording, type FeedbackType } from "./types";

/** The question before a report with something written is closed (docs/yebeyt-2.md, «Asking before it hurts»). */
export const feedbackCopy = {
  title: "بازخوردت هنوز فرستاده نشده. ولش کنی؟",
  discard: "ول کن",
  stay: "بمون",
  /** The report is on the server and only a file did not go (it can still be sent again). */
  filesTitle: "فیلم یا عکست فرستاده نشده. ولش کنی؟",
  /** «حذف فیلم»: the recording can't be brought back. */
  recordingTitle: "فیلم پاک بشه؟",
  recordingDelete: "پاک کن",
  recordingKeep: "نه",
} as const;

export const recordingNote = "فیلم ضبط نشد؛ دوباره امتحان کن";
/** The person chose another tab, a window or the screen: only this page is recorded. */
export const wrongPageNote = "فقط همین صفحه رو انتخاب کن";

type State = {
  /** What was known when the sheet was asked for; there is a report open while it is there. */
  moment?: Moment;
  /** The form of the chosen type; none while the choices are shown. */
  model?: FeedbackModel;
  /** The page is being drawn for the screenshot: the sheet comes when that is done. */
  capturing: boolean;
  /** The recording is being asked for (the browser's prompt is up). */
  starting: boolean;
  isRecording: boolean;
  /** The question «بازخوردت هنوز فرستاده نشده. ولش کنی؟» is on screen. */
  isConfirmingClose: boolean;
  /** The person said no to the browser's prompt: the bug screen hides the option. */
  recordingRefused: boolean;
};

/** What the center needs from the browser (`lib/feedback/browser.ts`), so that a test can stand in for each. */
export type Browser = {
  capture: () => Promise<Blob | undefined>;
  recorder: ScreenRecording;
  info: () => TechnicalInfo;
  device: () => DeviceInfo;
  /** The little message over the app («رسید، ممنون!»). */
  say: (line: string) => void;
  /** Covers the private views; answers how to uncover them. */
  cover: () => () => void;
  /** Waits for the covers to be drawn (a frame) before the recording starts. */
  drawn: () => Promise<void>;
  dismissKeyboard: () => void;
  sender?: () => FeedbackSender;
  /** Makes the JPEG that is sent of the screenshot. */
  encode?: (picture: Blob) => Promise<Blob | undefined>;
};

/**
 * The feedback flow of the app (FeedbackCenter.swift): the menu, the settings row or the shortcut opens the sheet over the current screen, the person picks a type and writes,
 * a bug may be recorded in between, and the report is sent. One report is open at a time.
 */
export class FeedbackCenter extends Store<State> {
  private uncover = () => {};
  private limit?: ReturnType<typeof setTimeout>;

  constructor(private readonly browser: Browser) {
    super({ capturing: false, starting: false, isRecording: false, isConfirmingClose: false, recordingRefused: false });
  }

  private patch(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }

  get isOpen(): boolean {
    return this.snapshot().moment !== undefined;
  }

  get recordingAvailable(): boolean {
    return !this.snapshot().recordingRefused && this.browser.recorder.isAvailable;
  }

  /** What the question before closing says: the draft, or (when the report already reached the server) the files. */
  get closeQuestion(): string {
    return this.snapshot().model?.reportReachedServer ? feedbackCopy.filesTitle : feedbackCopy.title;
  }

  private makeModel(type: FeedbackType, moment: Moment): FeedbackModel {
    return new FeedbackModel(type, moment, this.browser.sender?.(), this.browser.encode);
  }

  // Opening

  /**
   * Takes the screenshot and the state of the moment, then opens the sheet (straight at the form of `type` when given). Not while a sheet or a recording is on. A field in
   * focus loses it after the picture is taken (so the picture matches the places that were covered), and before the sheet comes.
   */
  async open(type?: FeedbackType): Promise<boolean> {
    const { moment, capturing, starting, isRecording } = this.snapshot();
    if (moment || capturing || starting || isRecording) return false;
    this.patch({ capturing: true });
    const info = this.browser.info();
    const device = this.browser.device();
    const next: Moment = { screenshot: await this.browser.capture(), info, device };
    this.browser.dismissKeyboard();
    this.patch({ capturing: false, moment: next, model: type ? this.makeModel(type, next) : undefined });
    return true;
  }

  /** A type was picked on the sheet. */
  choose(type: FeedbackType): void {
    const { moment, model } = this.snapshot();
    if (moment && !model) this.patch({ model: this.makeModel(type, moment) });
  }

  // Closing and sending

  /** The × or a swipe down: closes at once when nothing is written, otherwise asks first. «بمون» just closes the question (`confirm(false)`), and the form is as it was. */
  requestClose(): void {
    if (this.snapshot().model?.hasUnsentWork) {
      this.browser.dismissKeyboard(); // the keyboard goes first, so it doesn't come and go under the question
      this.patch({ isConfirmingClose: true });
    } else {
      this.close();
    }
  }

  confirm(asking: boolean): void {
    this.patch({ isConfirmingClose: asking });
  }

  /** The draft is dropped and the sheet goes. */
  close(): void {
    this.patch({ moment: undefined, model: undefined, isConfirmingClose: false });
  }

  async send(): Promise<void> {
    const { model } = this.snapshot();
    if (!model) return;
    await model.send();
    if (model.snapshot().phase !== "sent") return;
    this.close();
    this.browser.say(thanks);
  }

  // Recording

  /** «دوباره انجامش بده، ما فیلم می‌گیریم»: the sheet goes away, the private views are covered, the browser asks, and the recording starts. */
  async startRecording(): Promise<void> {
    const { model, isRecording, starting } = this.snapshot();
    if (!model || !takesRecording(model.type) || isRecording || starting) return;
    model.setRecording(undefined);
    this.patch({ starting: true });
    this.uncover = this.browser.cover();
    await this.browser.drawn(); // the covers are drawn before the first frame is recorded
    const result = await this.browser.recorder.start(() => void this.stopRecording());
    switch (result) {
      case "started":
        this.patch({ starting: false, isRecording: true });
        this.limit = setTimeout(() => void this.stopRecording(), maxSeconds * 1000);
        break;
      case "denied":
        this.uncover();
        this.patch({ starting: false, recordingRefused: true });
        break;
      case "failed":
      case "elsewhere":
        this.uncover();
        this.patch({ starting: false });
        this.browser.say(result === "failed" ? recordingNote : wrongPageNote);
        break;
    }
  }

  /** «تموم» on the pill (or the 60-second limit, or the browser's own «stop sharing»): the recording is kept and the bug screen comes back. */
  async stopRecording(): Promise<void> {
    if (!this.snapshot().isRecording) return;
    clearTimeout(this.limit);
    this.patch({ isRecording: false });
    const clip = await this.browser.recorder.stop();
    this.uncover(); // only now: the last frames are recorded covered too
    this.snapshot().model?.setRecording(clip);
    if (!clip) this.browser.say(recordingNote);
  }
}

/** The recording stops when the page is left or hidden (another tab, a locked phone, a closed page): the tab is not watched any more, and the covers are drawn by a page nobody sees. Answers the way to stop listening. */
export function stopWhenHidden(center: FeedbackCenter, doc: Document = document, win: Window = window): () => void {
  const stop = () => void center.stopRecording();
  const hidden = () => doc.visibilityState === "hidden" && stop();
  win.addEventListener("pagehide", stop);
  doc.addEventListener("visibilitychange", hidden);
  return () => {
    win.removeEventListener("pagehide", stop);
    doc.removeEventListener("visibilitychange", hidden);
  };
}
