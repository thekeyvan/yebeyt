import type { Couplet, Recitation } from "../poetry/models";
import { Store } from "./store";
import { RecitationTiming } from "./timing";

export type PlayerState = "idle" | "loading" | "playing" | "paused";

/** What the player shows: the state, whether there is a recitation at all, the couplet being read, and where the audio is. */
export type PlayerView = {
  state: PlayerState;
  /** False once Ganjoor is known to have no recitation of the poem: the play buttons are hidden. */
  isAvailable: boolean;
  /** The couplet being read; undefined while nothing plays or the text cannot follow the audio. */
  activeCouplet?: number;
  /** Seconds from the start of the recitation, and its length (0 until the audio knows it). */
  position: number;
  duration: number;
  recitations: Recitation[];
  /** The voice that plays: the poem's first recitation until another is chosen. */
  voice?: Recitation;
};

export const isPlaying = ({ state }: PlayerView): boolean => state === "playing" || state === "loading";

/** What `RecitationPlayer` asks of the audio underneath it (Reader/RecitationEngine.swift). The real one is an `<audio>` element; the tests use a fake. */
export type RecitationEngine = {
  /** Where the audio is, in seconds from the start of the recording. */
  readonly seconds: number;
  play(): void;
  pause(): void;
  /** Seeks to `seconds`; false when another seek cut this one short. */
  seek(seconds: number): Promise<boolean>;
  /** Pauses and lets go of the audio and everything watching it. */
  stop(): void;
};

/** What the engine tells the player. */
export type EngineEvents = {
  /** The playback position, a few times a second while playing. */
  tick(seconds: number, duration: number): void;
  ended(): void;
  failed(): void;
  /** The audio can play (a start part-way in seeks now). */
  ready(): void;
  /** The browser started or paused the audio itself (headphones unplugged, the lock screen), or the user did. */
  timeControl(playing: boolean): void;
};

export type MakeEngine = (url: string, events: EngineEvents) => RecitationEngine;

export type PlayerOptions = {
  couplets: Couplet[];
  fetchRecitations: () => Promise<Recitation[]>;
  /** The timing file's text. */
  fetchTiming: (url: string) => Promise<string>;
  makeEngine: MakeEngine;
  onFailure: () => void;
};

const idle: PlayerView = { state: "idle", isAvailable: true, position: 0, duration: 0, recitations: [] };

/**
 * Plays a poem's recitation from Ganjoor and follows along with the text when the recitation comes with a timing file
 * (Reader/RecitationPlayer.swift). It starts at the couplet being shown, and moves the audio when the reader moves by hand.
 */
export class RecitationPlayer extends Store<PlayerView> {
  private recitations?: Recitation[];
  private readonly timings = new Map<number, RecitationTiming>();
  private chosen?: number;
  private timing?: RecitationTiming;
  private engine?: RecitationEngine;
  /** The couplet a start from idle begins at, kept up to date when the reader moves while the audio loads. */
  private wanted?: number;
  /** Where the audio goes once it is ready (a couplet's start); undefined when it plays from 0. */
  private pendingStart?: number;
  /** Seeks under way. Until they are done the position is not where the audio is going, so it does not move `activeCouplet`. */
  private seeksInFlight = 0;
  /**
   * The user moved to a couplet the timing has no start for, so the audio could not follow. Until the user presses play again or
   * moves to a couplet with a start, the audio does not move the page: it would snap back.
   */
  private apart = false;
  /** Counts starts and cancels, so a load that was cancelled and finishes late can tell it is stale and does nothing. */
  private generation = 0;

  constructor(private readonly options: PlayerOptions) {
    super(idle);
  }

  /** Asks Ganjoor for the recitations as soon as the poem is open, to know whether to show the play button. A failure here is not final: the button stays and playing tries again. */
  async prefetch(): Promise<void> {
    if (this.recitations) return;
    try {
      const list = await this.options.fetchRecitations();
      this.recitations = list;
      this.patch({ recitations: list, isAvailable: list.length > 0, voice: this.voice() });
      const voice = this.voice();
      if (voice) await this.timingOf(voice); // ready before the tap, so that play starts in the tap's own turn (a browser asks for that)
    } catch {
      // The button stays; playing tries again.
    }
  }

  /**
   * Play / pause. From idle it starts at `couplet` when the recitation has timing (from the beginning otherwise); a resume after a
   * pause continues where the audio paused, whatever `couplet` is.
   */
  toggle(couplet?: number): void {
    switch (this.snapshot().state) {
      case "playing":
        this.engine?.pause();
        this.patch({ state: "paused" });
        break;
      case "paused":
        this.apart = false;
        this.engine?.play();
        this.patch({ state: "playing" });
        break;
      case "loading":
        this.generation++;
        this.patch({ state: "idle" });
        break;
      case "idle": {
        this.generation++;
        this.wanted = couplet;
        this.apart = false;
        this.patch({ state: "loading" }); // at once, so a second tap before the load is done cancels instead of starting another
        void this.start(this.generation);
      }
    }
  }

  /**
   * The reader moved to another couplet by the user's hand: the audio goes to where that couplet starts and keeps playing or staying
   * paused. Does nothing when idle or when the recitation has no timing. Never called for the reader following the audio
   * (`activeCouplet`), which would loop.
   */
  seekToCouplet(couplet: number): void {
    const { state } = this.snapshot();
    if (state === "idle") return;
    if (state === "loading") {
      this.wanted = couplet;
      return;
    }
    const seconds = this.timing?.start(couplet, this.options.couplets);
    if (!this.engine || !this.timing) return;
    if (seconds === undefined) {
      this.apart = true;
      this.patch({ activeCouplet: undefined });
      return;
    }
    this.apart = false;
    this.patch({ activeCouplet: couplet });
    this.moveTo(seconds);
  }

  /** The seek bar: the audio goes to `seconds`; the text follows from there. */
  seekTo(seconds: number): void {
    if (!this.engine) return;
    this.apart = false;
    this.patch({ position: seconds });
    this.moveTo(seconds);
  }

  /** Another voice: when one is playing or paused, the new one starts at the couplet being shown. */
  choose(id: number, couplet?: number): void {
    if (!this.recitations?.some((item) => item.id === id) || id === this.voice()?.id) return;
    const active = this.snapshot().state !== "idle";
    this.chosen = id;
    this.patch({ voice: this.voice() });
    if (!active) return;
    this.stop();
    this.toggle(couplet);
  }

  /** Stops and lets go of the audio (the reader closed). */
  stop(): void {
    this.generation++;
    this.teardown();
    this.patch({ state: "idle", activeCouplet: undefined, position: 0 });
  }

  private patch(change: Partial<PlayerView>): void {
    this.set({ ...this.snapshot(), ...change });
  }

  private voice(): Recitation | undefined {
    return this.recitations?.find((item) => item.id === this.chosen) ?? this.recitations?.[0];
  }

  /** A recitation's timing; undefined when it has none, or the file would not load or read (it is asked for again next time). */
  private async timingOf(recitation: Recitation): Promise<RecitationTiming | undefined> {
    if (!recitation.inSyncWithText || !recitation.xmlUrl) return undefined;
    const known = this.timings.get(recitation.id);
    if (known) return known;
    try {
      const timing = RecitationTiming.parse(await this.options.fetchTiming(recitation.xmlUrl));
      this.timings.set(recitation.id, timing);
      return timing;
    } catch {
      return undefined;
    }
  }

  private async start(current: number): Promise<void> {
    try {
      const list = this.recitations ?? (await this.options.fetchRecitations());
      if (current !== this.generation) return;
      this.recitations = list;
      const recitation = this.voice();
      if (!recitation) {
        this.patch({ recitations: list, isAvailable: false, state: "idle" });
        return;
      }
      const timing = this.timings.get(recitation.id) ?? (await this.timingOf(recitation));
      if (current !== this.generation) return;
      this.timing = timing;
      const wanted = this.wanted ?? 0;
      // Couplet 0 starts the poem from the beginning, as an untimed recitation does.
      const start = wanted > 0 ? timing?.start(wanted, this.options.couplets) : undefined;
      this.patch({ recitations: list, isAvailable: true, voice: recitation });
      this.begin(recitation.mp3Url, start);
      this.apart = start === undefined && wanted > 0 && timing !== undefined; // after `begin`, whose teardown clears it
    } catch {
      if (current === this.generation) this.fail();
    }
  }

  private begin(url: string, start?: number): void {
    this.teardown(); // never two players at once
    this.pendingStart = start;
    const started = this.generation;
    this.engine = this.options.makeEngine(url, {
      tick: (seconds, duration) => this.tick(seconds, duration),
      ended: () => this.finish(),
      failed: () => this.fail(),
      ready: () => this.startPlayback(started),
      // The browser can pause the audio itself (headphones unplugged, the lock screen) and resume it; follow it.
      timeControl: (playing) => this.timeControlChanged(playing),
    });
    // A start part-way in waits for the audio to be ready, seeks, and plays only when the seek is done (see `startPlayback`).
    if (this.pendingStart === undefined) this.engine.play();
    this.patch({ state: "playing", position: 0, duration: 0 });
  }

  /** The audio is ready: seek to where it starts (the couplet), then play, if that is still wanted. */
  private startPlayback(started: number): void {
    const engine = this.engine;
    const start = this.pendingStart;
    if (!engine || start === undefined) return;
    this.pendingStart = undefined;
    this.seeksInFlight++;
    void engine.seek(start).then((done) => {
      if (this.engine !== engine) return;
      this.seeksInFlight--;
      if (done && started === this.generation && this.snapshot().state === "playing") engine.play();
    });
  }

  private moveTo(seconds: number): void {
    const engine = this.engine;
    if (!engine) return;
    if (this.pendingStart !== undefined) {
      this.pendingStart = seconds; // the audio is not ready yet: it will seek there
      return;
    }
    const started = this.generation;
    this.seeksInFlight++;
    void engine.seek(seconds).then((done) => {
      if (this.engine !== engine) return;
      this.seeksInFlight--;
      if (done && started === this.generation && this.snapshot().state === "playing") engine.play();
    });
  }

  private timeControlChanged(playing: boolean): void {
    const { state } = this.snapshot();
    if (!playing && state === "playing") this.patch({ state: "paused" });
    else if (playing && state === "paused") this.patch({ state: "playing" });
  }

  private tick(seconds: number, duration: number): void {
    if (!Number.isFinite(seconds)) return;
    const change: Partial<PlayerView> = { position: seconds, duration: Number.isFinite(duration) ? duration : 0 };
    // While the audio is still going to where it was asked to, its position says nothing about the reader.
    if (this.timing && !this.apart && this.pendingStart === undefined && this.seeksInFlight === 0) change.activeCouplet = this.timing.couplet(seconds, this.options.couplets);
    this.patch(change);
  }

  private finish(): void {
    this.teardown();
    this.patch({ state: "idle", activeCouplet: undefined, position: 0 });
  }

  private fail(): void {
    this.teardown();
    this.patch({ state: "idle", activeCouplet: undefined, position: 0 });
    this.options.onFailure();
  }

  private teardown(): void {
    this.apart = false;
    this.pendingStart = undefined;
    this.seeksInFlight = 0;
    this.engine?.stop();
    this.engine = undefined;
  }
}
