import { ApiError } from "../account/api";
import { feedbackLog, type FeedbackLog } from "./log";
import type { Payload } from "./payload";

export type Files = { screenshot?: Blob; recording?: Blob };

/** `failed` carries the line to show; the button stays so the person can send again. */
export type Outcome = { sent: true } | { sent: false; line: string };

export const thanks = "رسید، ممنون!";
export const offlineLine = "الان نرسید، وقتی اینترنت اومد دوباره بفرست";
export const rateLine = "یه کم بعد دوباره بفرست";
export const busyLine = "الان سرور شلوغه؛ یه کم بعد دوباره بفرست";
const genericLine = new ApiError(500).persianMessage;
const maxRetryAfter = 10;

/** A refusal of the server; `retryAfter` is the seconds a busy one asked to wait (at least 1, at most 10). */
class Refused extends ApiError {
  readonly retryAfter: number;

  constructor(status: number, code: string | undefined, retryAfter: number) {
    super(status, code);
    this.retryAfter = Math.min(Math.max(Number.isFinite(retryAfter) ? retryAfter : 1, 1), maxRetryAfter);
  }
}

type Created = { id: string; uploadToken: string };
type Kind = "screenshot" | "recording";

/** The media type a file is sent as: what the server accepts. A screenshot is always the JPEG made of it; a recording is the WebM or MP4 it was recorded as (without its codecs). */
const mediaTypeOf = (kind: Kind, file: Blob): string => (kind === "screenshot" ? "image/jpeg" : file.type.startsWith("video/webm") ? "video/webm" : "video/mp4");

/** The line to show for a call that failed. */
export function lineFor(error: ApiError): string {
  if (error.status === 0 || error.status === 502 || error.status === 408) return offlineLine;
  if (error.status === 429) return rateLine;
  if (error.status === 503) return busyLine;
  return genericLine;
}

export type SenderOptions = {
  send?: typeof fetch;
  log?: FeedbackLog;
  /** Waits the seconds a busy server asked for. */
  pause?: (seconds: number) => Promise<void>;
};

/**
 * Sends a report: `POST /v1/feedback` (the door adds the session when there is one, and a guest's goes without), then the screenshot and the recording with the upload
 * token (FeedbackSender.swift). One sender belongs to one draft: when something fails half way, sending again carries on where it stopped and never makes a second report.
 */
export class FeedbackSender {
  private created?: Created;
  private screenshotSent = false;
  private recordingSent = false;
  private readonly send: typeof fetch;
  private readonly log: FeedbackLog;
  private readonly pause: (seconds: number) => Promise<void>;

  constructor({ send = (...args) => fetch(...args), log = feedbackLog, pause = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)) }: SenderOptions = {}) {
    this.send = send;
    this.log = log;
    this.pause = pause;
  }

  /** The report is already on the server: only the files are still on the way. */
  get hasCreatedReport(): boolean {
    return this.created !== undefined;
  }

  async submit(payload: Payload, files: Files): Promise<Outcome> {
    try {
      this.created ??= await this.post(payload);
      if (files.screenshot && !this.screenshotSent) {
        await this.attach("screenshot", files.screenshot, this.created);
        this.screenshotSent = true;
      }
      if (files.recording && !this.recordingSent) {
        await this.attach("recording", files.recording, this.created);
        this.recordingSent = true;
      }
      return { sent: true };
    } catch (error) {
      if (!(error instanceof ApiError)) return { sent: false, line: genericLine };
      this.log.record(error);
      return { sent: false, line: lineFor(error) };
    }
  }

  /** One call through the door: the answer, or an `ApiError` with the status and the server's code. */
  private async call(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.send(`/api${path}`, { ...init, method: init.method ?? "POST", credentials: "same-origin" });
    } catch {
      throw new ApiError(0);
    }
    if (response.ok) return response;
    const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined;
    throw new Refused(response.status, typeof body?.error === "string" ? body.error : undefined, Number(response.headers.get("retry-after")));
  }

  /** A signed-in person's report carries the session (the door sees to that); one whose sign-in the server refuses is sent as a guest's, which the cookies the door cleared make it. */
  private async post(payload: Payload): Promise<Created> {
    const ask = () => this.call("/v1/feedback", { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    let response: Response;
    try {
      response = await ask();
    } catch (error) {
      if (!(error instanceof ApiError && error.isUnauthorized)) throw error;
      response = await ask();
    }
    try {
      const body = (await response.json()) as Created;
      if (typeof body.id !== "string" || typeof body.uploadToken !== "string") throw new Error();
      return body;
    } catch {
      throw new ApiError(502);
    }
  }

  /** Busy servers are asked once more after their `Retry-After`. A file the server will never take (too big, the wrong kind, a token that ran out) or already has is left out: the report itself has arrived. */
  private async attach(kind: Kind, file: Blob, report: Created): Promise<void> {
    const put = () => this.call(`/v1/feedback/${report.id}/${kind}`, { method: "PUT", headers: { "content-type": mediaTypeOf(kind, file), "x-upload-token": report.uploadToken }, body: file });
    try {
      try {
        await put();
      } catch (error) {
        if (!(error instanceof Refused && error.status === 503)) throw error;
        await this.pause(error.retryAfter);
        await put();
      }
    } catch (error) {
      if (!(error instanceof ApiError) || ![400, 403, 404, 409, 413, 415].includes(error.status)) throw error;
      this.log.record(error);
    }
  }
}
