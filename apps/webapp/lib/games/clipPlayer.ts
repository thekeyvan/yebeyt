import { Store } from "../reader/store";
import { fadeRange } from "./listenClipRange";
import type { ListenClip } from "./quizQuestion";

export type ClipState = "idle" | "loading" | "playing" | "paused" | "ended";

export type ClipView = {
  state: ClipState;
  /** How far the clip has played, 0 to 1. */
  progress: number;
};

/** The volume of the clip: full, and falling to nothing over its last moments. The real one is a Web Audio gain on the `<audio>` element; where there is none the clip simply stops. */
export type Fade = {
  /** Called where a person has just pressed play: a Web Audio context starts only then. */
  unlock(): void;
  /** The clip is playing: the volume starts falling `from` seconds from now (full until then) and is nothing `to` seconds from now. */
  start(from: number, to: number): void;
  /** Nothing: the clip is over, and the tail of the audio past its end must not be heard before the next `start`. */
  silent(): void;
  /** Full volume again (paused, stopped). */
  full(): void;
  close(): void;
};

export type ClipOptions = { fade?: Fade; onFailure: () => void };

const events = ["playing", "waiting", "pause", "timeupdate", "ended", "error"] as const;

/**
 * The sound of گوش کن (Games/ListenAudio.swift): one `<audio>` for the clip of the question in play. It starts at the clip's start, stops at its end and
 * fades over its last moments; it can pause, resume and start again from the beginning. A browser lets sound start only after a gesture, so a clip waits
 * for the first press of play; once one has played, the next question's clip starts by itself. The end is watched by `timeupdate` and, while playing, on
 * every animation frame (`timeupdate` comes only four times a second, which could let the second hemistich begin); the fade, on the audio clock, keeps
 * a late check from being heard.
 */
export class ClipPlayer extends Store<ClipView> {
  private clip?: ListenClip;
  private source?: string;
  private frame?: number;
  private token = 0;
  private played = false;
  private readonly handlers = new Map<string, () => void>();

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly options: ClipOptions,
  ) {
    super({ state: "idle", progress: 0 });
    audio.preload = "auto";
    const handle: Record<(typeof events)[number], () => void> = {
      playing: () => this.began(),
      waiting: () => this.state === "playing" && this.patch({ state: "loading" }),
      // The browser paused it (headphones unplugged, the lock screen).
      pause: () => (this.state === "playing" || this.state === "loading") && this.hold(),
      timeupdate: () => void this.check(),
      ended: () => this.finish(),
      error: () => this.failed(),
    };
    for (const name of events) {
      this.handlers.set(name, handle[name]);
      audio.addEventListener(name, handle[name]);
    }
  }

  private get state(): ClipState {
    return this.snapshot().state;
  }

  private patch(change: Partial<ClipView>): void {
    this.set({ ...this.snapshot(), ...change });
  }

  /** The clip of the question in front of the player: nothing plays until a person presses play, but once one has, the clip starts at once. */
  load(clip: ListenClip | undefined): void {
    this.stop();
    this.clip = clip;
    if (clip && this.played) this.play();
  }

  /** From the start of the clip. */
  play(): void {
    const clip = this.clip;
    if (!clip) return;
    const token = ++this.token;
    this.played = true;
    this.options.fade?.unlock();
    if (this.source !== clip.audio) {
      this.source = clip.audio;
      this.audio.src = clip.audio;
    }
    this.audio.currentTime = clip.start; // before the audio is loaded this is where it will start
    this.patch({ state: "loading", progress: 0 });
    this.attempt(token);
  }

  /** Pause, resume, or (while loading) give up loading. */
  toggle(): void {
    if (this.state === "playing" || this.state === "loading") {
      this.token++;
      this.audio.pause();
      this.hold();
    } else if (this.state === "paused") {
      this.patch({ state: "loading" });
      this.attempt(++this.token);
    }
  }

  stop(): void {
    this.token++;
    this.cancelFrame();
    this.audio.pause();
    this.options.fade?.full();
    this.patch({ state: "idle", progress: 0 });
  }

  /** Lets go of the audio and everything watching it (the game closed). */
  destroy(): void {
    this.stop();
    for (const [name, handler] of this.handlers) this.audio.removeEventListener(name, handler);
    this.audio.removeAttribute("src");
    this.audio.load();
    this.options.fade?.close();
  }

  private attempt(token: number): void {
    this.audio.play().then(
      () => token === this.token && this.began(),
      (error: unknown) => token === this.token && this.refused(error),
    );
  }

  private began(): void {
    const clip = this.clip;
    if (!clip || this.state === "paused" || this.state === "idle" || this.state === "ended") return;
    this.patch({ state: "playing" });
    const [from, to] = fadeRange(clip.start, clip.end, clip.fade);
    this.options.fade?.start(from - this.audio.currentTime, to - this.audio.currentTime);
    this.watch();
  }

  private hold(): void {
    this.cancelFrame();
    this.options.fade?.full();
    this.patch({ state: "paused" });
  }

  /** `play()` was turned down: by a pause or a seek that came first (nothing wrong), by the browser's rules for sound (the play button waits for a press), or for real. */
  private refused(error: unknown): void {
    const name = (error as DOMException).name;
    if (name === "AbortError") return;
    if (name === "NotAllowedError") {
      this.played = false;
      this.patch({ state: "idle" });
    } else this.failed();
  }

  private failed(): void {
    this.stop();
    this.options.onFailure();
  }

  private watch(): void {
    if (this.frame !== undefined) return;
    const step = () => {
      this.frame = undefined;
      if (this.state !== "playing" || this.check()) return;
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private cancelFrame(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  /** Stops the clip when it has reached its end; true when it did. */
  private check(): boolean {
    const clip = this.clip;
    if (!clip || this.state !== "playing") return false;
    const time = this.audio.currentTime;
    if (time >= clip.end) {
      this.finish();
      return true;
    }
    this.patch({ progress: Math.min(1, Math.max(0, (time - clip.start) / Math.max(clip.end - clip.start, 0.1))) });
    return false;
  }

  private finish(): void {
    if (!this.clip || this.state === "idle") return;
    this.token++;
    this.cancelFrame();
    this.audio.pause();
    this.options.fade?.silent();
    this.patch({ state: "ended", progress: 1 });
  }
}
