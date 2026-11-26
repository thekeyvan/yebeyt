import { beforeEach, describe, expect, it } from "vitest";
import type { Couplet, Recitation } from "../lib/poetry/models";
import { isPlaying, RecitationPlayer, type EngineEvents, type RecitationEngine } from "../lib/reader/player";
import { fixture, fixtureText } from "./files";

const couplets: Couplet[] = Array.from({ length: 4 }, (_, index) => ({ m1: `الف${index}`, m2: `ب${index}` }));
const recitations = fixture<Recitation[]>("recitations").sort((a, b) => a.audioOrder - b.audioOrder);

/** An engine that writes down what it is asked, and finishes a seek when the test says so. */
class FakeEngine implements RecitationEngine {
  seconds = 0;
  calls: string[] = [];
  private seeks: ((done: boolean) => void)[] = [];
  constructor(readonly url: string, readonly events: EngineEvents) {}
  play() { this.calls.push("play"); }
  pause() { this.calls.push("pause"); }
  stop() { this.calls.push("stop"); }
  seek(seconds: number) {
    this.calls.push(`seek ${seconds}`);
    return new Promise<boolean>((resolve) => this.seeks.push(resolve));
  }
  finishSeek(done = true) { this.seeks.shift()?.(done); }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let engines: FakeEngine[];
let failures: number;
const make = (fetchRecitations: () => Promise<Recitation[]> = async () => recitations, fetchTiming = async () => fixtureText("timing-2130-ff.xml")) =>
  new RecitationPlayer({
    couplets,
    fetchRecitations,
    fetchTiming,
    makeEngine: (url, events) => engines[engines.push(new FakeEngine(url, events)) - 1]!,
    onFailure: () => failures++,
  });
const engine = () => engines[engines.length - 1]!;
/** A player that is playing from couplet `couplet`, with its audio ready. */
async function playing(couplet?: number) {
  const player = make();
  player.toggle(couplet);
  await flush();
  return player;
}

beforeEach(() => {
  engines = [];
  failures = 0;
});

describe("RecitationPlayer (Reader/RecitationPlayer.swift)", () => {
  it("hides the play button when the poem has no recitation", async () => {
    const player = make(async () => []);
    expect(player.snapshot().isAvailable).toBe(true);
    await player.prefetch();
    expect(player.snapshot().isAvailable).toBe(false);
  });

  it("keeps the button after a failed prefetch", async () => {
    const player = make(() => Promise.reject(new TypeError("offline")));
    await player.prefetch();
    expect(player.snapshot().isAvailable).toBe(true);
  });

  it("hides the button, without a failure, when playing finds no recitation", async () => {
    const player = make(async () => []);
    player.toggle();
    await flush();
    expect(player.snapshot()).toMatchObject({ isAvailable: false, state: "idle" });
    expect(failures).toBe(0);
  });

  it("goes back to idle and says so when the recitations do not load", async () => {
    const player = make(() => Promise.reject(new TypeError("offline")));
    player.toggle();
    await flush();
    expect(failures).toBe(1);
    expect(player.snapshot().state).toBe("idle");
    expect(isPlaying(player.snapshot())).toBe(false);
  });

  it("says so when the audio fails", async () => {
    const player = await playing();
    engine().events.failed();
    expect(failures).toBe(1);
    expect(player.snapshot().state).toBe("idle");
    expect(engine().calls).toContain("stop");
  });

  it("treats a stop, or a second tap, while loading as a cancel, not a failure", async () => {
    let finish: (list: Recitation[]) => void = () => {};
    const slow = () => new Promise<Recitation[]>((resolve) => (finish = resolve));
    const stopped = make(slow);
    stopped.toggle();
    expect(stopped.snapshot().state).toBe("loading");
    stopped.stop();
    finish(recitations);
    await flush();
    expect(stopped.snapshot().state).toBe("idle");
    expect(engines).toHaveLength(0);

    const tapped = make(slow);
    tapped.toggle();
    tapped.toggle();
    finish(recitations);
    await flush();
    expect(tapped.snapshot().state).toBe("idle");
    expect(engines).toHaveLength(0);
    expect(failures).toBe(0);
  });

  it("does nothing when a late load comes back after a newer start", async () => {
    const finishes: ((list: Recitation[]) => void)[] = [];
    const player = make(() => new Promise<Recitation[]>((resolve) => finishes.push(resolve)));
    player.toggle();
    player.toggle(); // cancel
    player.toggle(); // a newer start
    finishes[0]!(recitations); // the first one finishes late
    await flush();
    expect(engines).toHaveLength(0);
    finishes[1]!(recitations);
    await flush();
    expect(engines).toHaveLength(1);
  });

  it("plays the poem's first recitation", async () => {
    await playing();
    expect(engine().url).toBe("https://i.ganjoor.net/a/2132-ff.mp3");
  });

  it("starts at the couplet that is shown, and plays only when the seek to it is done", async () => {
    const player = await playing(2);
    expect(engine().calls).toEqual([]); // not ready: nothing plays from the wrong place
    engine().events.ready();
    expect(engine().calls).toEqual(["seek 29.886"]);
    expect(player.snapshot().state).toBe("playing");
    engine().finishSeek();
    await flush();
    expect(engine().calls).toEqual(["seek 29.886", "play"]);
  });

  it("does not play after the seek when it was paused meanwhile", async () => {
    const player = await playing(2);
    engine().events.ready();
    player.toggle();
    engine().finishSeek();
    await flush();
    expect(engine().calls).not.toContain("play");
    player.toggle(); // a resume plays from the couplet
    expect(engine().calls.at(-1)).toBe("play");
  });

  it("starts the first couplet from the beginning, without a seek", async () => {
    await playing(0);
    expect(engine().calls).toEqual(["play"]);
  });

  it("starts from the beginning when the recitation has no timing", async () => {
    const player = make(async () => [recitations[2]!]);
    player.toggle(2);
    await flush();
    expect(engine().calls).toEqual(["play"]);
    expect(engine().url).toBe("https://i.ganjoor.net/a/2132-x.mp3");
    engine().events.tick(40, 100);
    expect(player.snapshot()).toMatchObject({ position: 40, duration: 100 });
    expect(player.snapshot().activeCouplet).toBeUndefined(); // nothing to follow
  });

  it("starts from the beginning when the timing file does not load", async () => {
    const player = make(undefined, () => Promise.reject(new TypeError("offline")));
    player.toggle(2);
    await flush();
    expect(engine().calls).toEqual(["play"]);
    expect(failures).toBe(0);
  });

  it("follows the audio: the text is on the couplet being read", async () => {
    const player = await playing();
    engine().events.tick(0.1, 60);
    expect(player.snapshot().activeCouplet).toBe(0);
    engine().events.tick(16, 60);
    expect(player.snapshot().activeCouplet).toBe(1);
    engine().events.tick(31, 60);
    expect(player.snapshot()).toMatchObject({ activeCouplet: 2, position: 31, duration: 60 });
  });

  it("resumes after a pause where it paused, whatever couplet is asked", async () => {
    const player = await playing();
    player.toggle();
    expect(player.snapshot().state).toBe("paused");
    player.toggle(3);
    expect(player.snapshot().state).toBe("playing");
    expect(engine().calls).toEqual(["play", "pause", "play"]);
  });

  it("moves to another couplet, seeks to its start and keeps playing", async () => {
    const player = await playing();
    player.seekToCouplet(2);
    expect(engine().calls).toEqual(["play", "seek 29.886"]);
    expect(player.snapshot().activeCouplet).toBe(2);
    engine().finishSeek();
    await flush();
    expect(engine().calls.at(-1)).toBe("play");
  });

  it("moves while paused: it seeks and stays paused", async () => {
    const player = await playing();
    player.toggle();
    player.seekToCouplet(1);
    engine().finishSeek();
    await flush();
    expect(engine().calls).toEqual(["play", "pause", "seek 15.486"]);
    expect(player.snapshot().state).toBe("paused");
  });

  it("does not let a position from before the seek move the reader back", async () => {
    const player = await playing();
    engine().events.tick(1, 60);
    player.seekToCouplet(2);
    engine().events.tick(1.5, 60); // still the old place
    expect(player.snapshot().activeCouplet).toBe(2);
    engine().finishSeek();
    await flush();
    engine().events.tick(30, 60);
    expect(player.snapshot().activeCouplet).toBe(2);
  });

  it("changes where it starts when the reader moves while it loads", async () => {
    const player = await playing(1);
    player.seekToCouplet(2); // not ready yet
    engine().events.ready();
    expect(engine().calls).toEqual(["seek 29.886"]);
    player.stop();
  });

  it("changes where it starts when the reader moves before the recitations arrive", async () => {
    let finish: (list: Recitation[]) => void = () => {};
    const player = make(() => new Promise<Recitation[]>((resolve) => (finish = resolve)));
    player.toggle(1);
    player.seekToCouplet(2);
    finish(recitations);
    await flush();
    engine().events.ready();
    expect(engine().calls).toEqual(["seek 29.886"]);
  });

  it("does nothing when the reader moves and nothing plays", () => {
    const player = make();
    player.seekToCouplet(2);
    expect(engines).toHaveLength(0);
    expect(player.snapshot().state).toBe("idle");
  });

  it("stops following when the user moves to a couplet the timing has no start for, until it has one again", async () => {
    const player = await playing();
    player.seekToCouplet(3); // verse 6: the file ends at verse 5
    expect(engine().calls).toEqual(["play"]);
    expect(player.snapshot().activeCouplet).toBeUndefined();
    engine().events.tick(1, 60);
    expect(player.snapshot().activeCouplet).toBeUndefined();
    player.seekToCouplet(1);
    engine().finishSeek();
    await flush();
    engine().events.tick(16, 60);
    expect(player.snapshot().activeCouplet).toBe(1);
  });

  it("follows again when the user presses play after a pause", async () => {
    const player = await playing();
    player.seekToCouplet(3);
    player.toggle();
    player.toggle();
    engine().events.tick(16, 60);
    expect(player.snapshot().activeCouplet).toBe(1);
  });

  it("plays from the top without following when the start couplet has no timing", async () => {
    const player = await playing(3);
    expect(engine().calls).toEqual(["play"]);
    engine().events.tick(1, 60);
    expect(player.snapshot().activeCouplet).toBeUndefined();
  });

  it("seeks to a position of the seek bar", async () => {
    const player = await playing();
    player.seekTo(20);
    expect(engine().calls).toEqual(["play", "seek 20"]);
    expect(player.snapshot().position).toBe(20);
    engine().finishSeek();
    await flush();
    engine().events.tick(20.1, 60);
    expect(player.snapshot().activeCouplet).toBe(1);
  });

  it("follows the browser pausing and resuming the audio itself", async () => {
    const player = await playing();
    engine().events.timeControl(false);
    expect(player.snapshot().state).toBe("paused");
    engine().events.timeControl(true);
    expect(player.snapshot().state).toBe("playing");
  });

  it("goes idle at the end and lets go of the audio", async () => {
    const player = await playing();
    engine().events.tick(10, 60);
    engine().events.ended();
    expect(player.snapshot()).toMatchObject({ state: "idle", position: 0 });
    expect(player.snapshot().activeCouplet).toBeUndefined();
    expect(engine().calls).toContain("stop");
  });

  it("changes to another voice at the couplet shown, and only sets it when idle", async () => {
    const player = make();
    await player.prefetch();
    expect(player.snapshot().voice?.audioArtist).toBe("فریدون فرح‌اندوز");
    player.choose(3344);
    expect(player.snapshot().voice?.audioArtist).toBe("امیرحسین شهپروصال");
    expect(engines).toHaveLength(0);
    player.toggle(2);
    await flush();
    expect(engine().url).toBe("https://i.ganjoor.net/a2/2132-as.mp3");
    player.choose(2842, 2);
    await flush();
    expect(engines).toHaveLength(2);
    expect(engines[0]!.calls).toContain("stop");
    expect(engine().url).toBe("https://i.ganjoor.net/a/2132-ff.mp3");
    player.choose(9999); // not one of the poem's
    expect(player.snapshot().voice?.id).toBe(2842);
  });

  it("starts in the tap's own turn once the recitations and the timing are known", async () => {
    const player = make();
    await player.prefetch();
    player.toggle(0);
    expect(engines).toHaveLength(1); // no await between the tap and the audio
  });
});
