import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClipPlayer, type Fade } from "../lib/games/clipPlayer";
import { listenClipRange } from "../lib/games/listenClipRange";
import type { ListenClip } from "../lib/games/quizQuestion";

/** An `<audio>` that plays when it is told to, and whose time the test moves. */
class FakeAudio extends EventTarget {
  currentTime = 0;
  src = "";
  preload = "";
  paused = true;
  refuse?: string;
  plays = 0;
  play() {
    this.plays++;
    if (this.refuse) return Promise.reject(Object.assign(new Error(this.refuse), { name: this.refuse }));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {}
  load() {}
  at(seconds: number, event = "timeupdate") {
    this.currentTime = seconds;
    this.dispatchEvent(new Event(event));
  }
}

const clip = (extra: Partial<ListenClip> = {}): ListenClip => ({ audio: "https://i.ganjoor.net/a/1.mp3", start: 15.2, end: 19.9, fade: listenClipRange.measuredFade, ...extra });

function setup() {
  const audio = new FakeAudio();
  const calls: string[] = [];
  const fade: Fade = {
    unlock: () => calls.push("unlock"),
    start: (from, to) => calls.push(`start ${from.toFixed(2)} ${to.toFixed(2)}`),
    silent: () => calls.push("silent"),
    full: () => calls.push("full"),
    close: () => calls.push("close"),
  };
  const onFailure = vi.fn();
  const player = new ClipPlayer(audio as unknown as HTMLAudioElement, { fade, onFailure });
  return { audio, calls, onFailure, player };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ClipPlayer", () => {
  let frames: (() => void)[] = [];
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => vi.unstubAllGlobals());
  const frame = () => frames.splice(0).forEach((callback) => callback());

  it("waits for a press, then starts at the start of the clip and fades over its last moments", async () => {
    const { audio, calls, player } = setup();
    player.load(clip());
    expect([player.snapshot().state, audio.plays]).toEqual(["idle", 0]); // no sound before a gesture
    player.play();
    expect(player.snapshot().state).toBe("loading");
    await settled();
    expect([player.snapshot().state, audio.currentTime, audio.src]).toEqual(["playing", 15.2, "https://i.ganjoor.net/a/1.mp3"]);
    expect(calls.slice(-2)).toEqual(["unlock", "start 4.62 4.70"]);
  });

  it("stops at its end, before the second hemistich, and is idle for a replay", async () => {
    const { audio, calls, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    audio.currentTime = 17.55;
    frame();
    expect(player.snapshot().progress).toBeCloseTo(0.5, 2);
    audio.currentTime = 19.91;
    frame();
    expect([player.snapshot().state, player.snapshot().progress, audio.paused]).toEqual(["ended", 1, true]);
    expect(calls.at(-1)).toBe("silent"); // the gain stays at nothing until the next start
    expect(frames).toHaveLength(0); // nothing keeps watching
  });

  it("also stops when `timeupdate` is the first to see the end", async () => {
    const { audio, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    audio.at(19.95);
    expect([player.snapshot().state, audio.paused]).toEqual(["ended", true]);
  });

  it("starts again from the beginning of the clip", async () => {
    const { audio, calls, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    audio.currentTime = 19.95;
    frame();
    player.play();
    await settled();
    expect([player.snapshot().state, audio.currentTime]).toEqual(["playing", 15.2]);
    expect(calls.filter((call) => call.startsWith("start"))).toHaveLength(2);
  });

  it("pauses and resumes", async () => {
    const { audio, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    player.toggle();
    expect([player.snapshot().state, audio.paused]).toEqual(["paused", true]);
    player.toggle();
    await settled();
    expect([player.snapshot().state, audio.paused]).toEqual(["playing", false]);
  });

  it("starts the next clip by itself once one has played, but not before", async () => {
    const { audio, player } = setup();
    player.load(clip());
    player.load(clip({ audio: "https://i.ganjoor.net/a/2.mp3", start: 3, end: 7 }));
    expect(audio.plays).toBe(0);
    player.play();
    await settled();
    player.load(clip({ audio: "https://i.ganjoor.net/a/3.mp3", start: 9, end: 12.5 }));
    await settled();
    expect([player.snapshot().state, audio.src, audio.currentTime]).toEqual(["playing", "https://i.ganjoor.net/a/3.mp3", 9]);
  });

  it("counts a press that has not finished loading: the next clip still starts by itself", async () => {
    const { audio, player } = setup();
    player.load(clip());
    player.play();
    player.load(clip({ audio: "https://i.ganjoor.net/a/2.mp3", start: 3, end: 7 })); // answered before the first began
    await settled();
    expect([player.snapshot().state, audio.src, audio.currentTime]).toEqual(["playing", "https://i.ganjoor.net/a/2.mp3", 3]);
  });

  it("waits for a press when the browser turns the sound down", async () => {
    const { audio, onFailure, player } = setup();
    audio.refuse = "NotAllowedError";
    player.load(clip());
    player.play();
    await settled();
    expect([player.snapshot().state, onFailure.mock.calls.length]).toEqual(["idle", 0]);
  });

  it("tells when the audio fails, and lets go of it", async () => {
    const { audio, onFailure, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    audio.dispatchEvent(new Event("error"));
    expect([player.snapshot().state, onFailure.mock.calls.length]).toEqual(["idle", 1]);
  });

  it("is quiet and full volume when stopped, and lets go on destroy", async () => {
    const { audio, calls, player } = setup();
    player.load(clip());
    player.play();
    await settled();
    player.stop();
    expect([player.snapshot().state, audio.paused, calls.at(-1)]).toEqual(["idle", true, "full"]);
    player.destroy();
    expect(calls.at(-1)).toBe("close");
    audio.at(30);
    expect(player.snapshot().state).toBe("idle");
  });
});
