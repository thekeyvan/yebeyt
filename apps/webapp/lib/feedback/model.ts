import { Store } from "../reader/store";
import type { DeviceInfo } from "./device";
import { buildPayload } from "./payload";
import type { Mark } from "./markup";
import { FeedbackSender, type Files } from "./sender";
import { toJpeg, withMarks } from "./screenshot";
import type { TechnicalInfo } from "./technical";
import { canSendDraft, hasTypedText, newDraft, sendsScreenshot, takesRecording, type Draft, type FeedbackType } from "./types";

/** What the browser knew at the moment the person asked to give feedback, before the sheet opened: the screenshot, the state for a bug report and the device. It stays in memory only. */
export type Moment = { screenshot?: Blob; info: TechnicalInfo; device: DeviceInfo };

export type Recording = { blob: Blob; seconds: number };

export type Phase = "editing" | "sending" | "failed" | "sent";

type State = {
  draft: Draft;
  /** The screenshot with the person's marks, once the editor was used. */
  edited?: Blob;
  recording?: Recording;
  technicalOpen: boolean;
  /** What is over the form: the editor of the screenshot, or the question before the recording is deleted. These are the sheet's own business, so the host shows them beside it, not inside it. */
  over?: "editor" | "recording";
  phase: Phase;
  /** The line to show after a send that failed; the button is still there. */
  failure?: string;
};

/** One report being written: the draft, the screenshot (and its marks), the recording and how sending went (FeedbackModel.swift). */
export class FeedbackModel extends Store<State> {
  constructor(
    type: FeedbackType,
    readonly moment: Moment,
    private readonly sender: FeedbackSender = new FeedbackSender(),
    private readonly jpeg: (picture: Blob) => Promise<Blob | undefined> = toJpeg,
    private readonly mark: (picture: Blob, marks: readonly Mark[]) => Promise<Blob | undefined> = withMarks,
  ) {
    super({ draft: newDraft(type), technicalOpen: false, phase: "editing" });
  }

  private patch(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }

  get type(): FeedbackType {
    return this.snapshot().draft.type;
  }

  /** The screenshot that would go: the marked one, else the one taken. */
  get image(): Blob | undefined {
    return this.snapshot().edited ?? this.moment.screenshot;
  }

  get canSend(): boolean {
    const { draft, phase } = this.snapshot();
    return canSendDraft(draft) && phase !== "sending";
  }

  /** The report is on the server; only a file may be missing. */
  get reportReachedServer(): boolean {
    return this.sender.hasCreatedReport;
  }

  /** Typed text, a screenshot with marks or a recording that has not been sent: closing would throw it away. Once the report is on the server a file that did not go is what is left. */
  get hasUnsentWork(): boolean {
    const { draft, edited, recording, phase } = this.snapshot();
    return phase !== "sent" && (this.reportReachedServer || hasTypedText(draft) || edited !== undefined || recording !== undefined);
  }

  /** The report is sending, or has reached the server (only a file failed): what was written can no longer change. */
  get isLocked(): boolean {
    return this.snapshot().phase === "sending" || this.reportReachedServer;
  }

  edit(change: Partial<Draft>): void {
    this.patch({ draft: { ...this.snapshot().draft, ...change } });
  }

  setEdited(picture: Blob): void {
    this.patch({ edited: picture });
  }

  setRecording(recording: Recording | undefined): void {
    this.patch({ recording });
  }

  toggleTechnical(): void {
    this.patch({ technicalOpen: !this.snapshot().technicalOpen });
  }

  show(over: State["over"]): void {
    this.patch({ over });
  }

  /** The editor was closed: «تمام» gives the marks (the picture with them drawn is what is sent from now on), × gives none. */
  async finishEditing(marks: readonly Mark[]): Promise<void> {
    this.patch({ over: undefined });
    const picture = this.image;
    const marked = picture && marks.length > 0 ? await this.mark(picture, marks) : undefined;
    if (marked) this.setEdited(marked);
  }

  async send(): Promise<void> {
    if (!this.canSend) return;
    this.patch({ phase: "sending", failure: undefined });
    const { draft, recording } = this.snapshot();
    const files: Files = {};
    const picture = this.image;
    if (sendsScreenshot(draft) && picture) files.screenshot = await this.jpeg(picture);
    if (takesRecording(draft.type) && recording) files.recording = recording.blob;
    const outcome = await this.sender.submit(buildPayload(draft, this.moment.info, this.moment.device), files);
    this.patch(outcome.sent ? { phase: "sent" } : { phase: "failed", failure: outcome.line });
  }
}
