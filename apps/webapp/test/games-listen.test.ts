import { describe, expect, it } from "vitest";
import { GameDeck, parseDeck, type GameCouplet } from "../lib/games/couplet";
import { clipEnd, fadeRange, listenClipRange } from "../lib/games/listenClipRange";
import { clipFor, listenQuestions, type ListenLoader } from "../lib/games/listenLoader";
import { plain } from "../lib/library/normalize";
import { SeededGenerator } from "../lib/games/seeded";
import type { Couplet, Poem, Recitation } from "../lib/poetry/models";
import { RecitationTiming } from "../lib/reader/timing";
import { bundledFile, fixture, fixtureText } from "./files";
import { couplets as quizCouplets, ends } from "./quizFixtures";

const generator = (seed: number) => new SeededGenerator(BigInt(seed));
const near = (actual: number | undefined, expected: number) => expect(actual).toBeCloseTo(expected, 4);

const ghazal: Couplet[] = Array.from({ length: 4 }, (_, index) => ({ m1: `الف${index}`, m2: `ب${index}` }));
const timingXML = fixtureText("timing-2130-ff.xml");
const recitations = fixture<Recitation[]>("recitations").sort((a, b) => a.audioOrder - b.audioOrder);

describe("the timing of the first hemistich", () => {
  const timing = RecitationTiming.parse(timingXML);

  it("runs from its verse to the start of the next", () => {
    expect([0, 1, 2].map((index) => timing.firstHemistich(index, ghazal))).toEqual([[0, 7.386], [15.486, 21.036], [29.886, 34.986]]);
  });

  it("shifts the verses after a single-line couplet before it", () => {
    const mixed: Couplet[] = [{ m1: "نثر", m2: "" }, { m1: "الف", m2: "ب" }, { m1: "پ", m2: "ت" }];
    expect(timing.firstHemistich(1, mixed)).toEqual([7.386, 15.486]);
    expect(timing.firstHemistich(2, mixed)).toEqual([21.036, 29.886]);
    expect(timing.firstHemistich(0, mixed)).toBeUndefined(); // a single line has no second hemistich to guess
  });

  it("has no range for a couplet whose second verse is not timed or that is not there", () => {
    expect([timing.firstHemistich(3, ghazal), timing.firstHemistich(9, ghazal), timing.firstHemistich(-1, ghazal)]).toEqual([undefined, undefined, undefined]);
  });
});

describe("ListenLoader", () => {
  const poemOf = (path: string, lines: Couplet[]): Poem => ({ id: Number(path.split("p").at(-1)) || 0, title: "", path, couplets: lines });
  const loaderOf = ({ recited = (_id: number) => true, timing = timingXML, failing = false, lines = ghazal.slice(0, 3) }: { recited?: (id: number) => boolean; timing?: string; failing?: boolean; lines?: Couplet[] } = {}): ListenLoader => ({
    poem: async (path) => (failing ? Promise.reject(new TypeError("offline")) : poemOf(path, lines)),
    recitations: async (id) => (failing ? Promise.reject(new TypeError("offline")) : recited(id) ? recitations : []),
    timing: async () => timing,
  });

  const hafez = (poem: number, index = 0): GameCouplet => ({
    ...quizCouplets("hafez", 1)[0]!,
    poem: `/hafez/p${poem}`,
    index,
    m2: `مصراع دوم ${poem} ${index} گوهر${ends[(poem + index) % ends.length]}`,
  });
  const deck = (poems = 14) => new GameDeck([...Array.from({ length: poems }, (_, poem) => [0, 1, 2].map((index) => hafez(poem, index))).flat(), ...quizCouplets("saadi", 30)]);

  it("is the first recitation in sync and the first hemistich up to the margin", async () => {
    const clip = await clipFor(loaderOf(), hafez(1, 1));
    expect(clip?.audio).toBe("https://i.ganjoor.net/a/2132-ff.mp3");
    expect(clip?.start).toBe(15.486);
    near(clip?.end, 21.036 - listenClipRange.margin); // it stops before the next hemistich's mark, not at it
  });

  it("gets the last couplet a clip ending before its second hemistich's mark", async () => {
    const clip = await clipFor(loaderOf(), hafez(1, 2));
    expect(clip?.start).toBe(29.886);
    near(clip?.end, 34.986 - listenClipRange.margin);
  });

  it("has no clip for a single line or an untimed second hemistich", async () => {
    const loader = loaderOf({ lines: [{ m1: "نثر", m2: "" }, { m1: "الف", m2: "ب" }, { m1: "پ", m2: "ت" }, { m1: "ث", m2: "ج" }] });
    expect(await clipFor(loader, hafez(1, 0))).toBeUndefined(); // a single line
    const shifted = await clipFor(loader, hafez(1, 1)); // the verses shift after the single line
    expect(shifted?.start).toBe(7.386);
    near(shifted?.end, 15.486 - listenClipRange.margin);
    expect(await clipFor(loader, hafez(1, 3))).toBeUndefined(); // no mark for the verse after the last
  });

  it("has no clip when there is no recitation in sync, no timing, or nothing loads", async () => {
    expect(await clipFor(loaderOf({ recited: () => false }), hafez(1))).toBeUndefined();
    expect(await clipFor(loaderOf({ timing: "<nope/>" }), hafez(1))).toBeUndefined();
    expect(await clipFor(loaderOf({ failing: true }), hafez(1))).toBeUndefined();
    expect(await clipFor(loaderOf(), hafez(1, 5))).toBeUndefined(); // the couplet is not in the poem
  });

  it("skips a recitation without a timing file", async () => {
    const unsynced = recitations.filter((item) => !item.inSyncWithText);
    const loader: ListenLoader = { poem: async (path) => poemOf(path, [{ m1: "الف", m2: "ب" }]), recitations: async () => unsynced, timing: async () => "" };
    expect(await clipFor(loader, hafez(1))).toBeUndefined();
  });

  it("plays a measured range of the same recitation as it is, without asking for the timing", async () => {
    const couplet = { ...hafez(1, 1), listenRange: { recitation: 2842, start: 15.2, end: 19.9 } };
    const loader: ListenLoader = { ...loaderOf(), timing: () => Promise.reject(new TypeError("offline")) };
    expect(await clipFor(loader, couplet)).toEqual({ audio: "https://i.ganjoor.net/a/2132-ff.mp3", start: 15.2, end: 19.9, fade: listenClipRange.measuredFade });
  });

  it("falls back to the margin rule for a measured range of another recitation", async () => {
    const clip = await clipFor(loaderOf(), { ...hafez(1, 1), listenRange: { recitation: 9999, start: 15.2, end: 19.9 } });
    expect(clip?.start).toBe(15.486);
    near(clip?.end, 21.036 - listenClipRange.margin);
  });

  it("uses the margin rule for a couplet without a range", async () => {
    near((await clipFor(loaderOf(), hafez(1, 1)))?.end, 21.036 - listenClipRange.margin);
  });

  it("still needs a recitation in sync for a measured range", async () => {
    const couplet = { ...hafez(1), listenRange: { recitation: 2842, start: 0, end: 5 } };
    expect(await clipFor(loaderOf({ recited: () => false }), couplet)).toBeUndefined();
    expect(await clipFor(loaderOf({ failing: true }), couplet)).toBeUndefined();
  });

  it("carries the measured ranges of most Hafez couplets of the bundled deck", () => {
    const bundled = parseDeck(bundledFile("games"), () => undefined);
    const own = bundled.couplets.filter((couplet) => couplet.poetSlug === "hafez");
    const ranges = own.flatMap((couplet) => couplet.listenRange ?? []);
    expect(own.length).toBeGreaterThan(150);
    expect(ranges.length).toBeGreaterThan(150); // a few couplets have no clean silence and keep the margin rule
    expect(ranges.every((range) => range.recitation > 0 && range.start >= 0 && range.end - range.start >= 1)).toBe(true);
    expect(bundled.couplets.filter((couplet) => couplet.poetSlug !== "hafez").every((couplet) => couplet.listenRange === undefined)).toBe(true);
  });

  it("makes five questions from Hafez poems that have a recitation", async () => {
    const all = deck();
    const questions = await listenQuestions(loaderOf({ recited: (id) => id % 2 === 0 }), all, 5, generator(2));
    expect(questions).toHaveLength(5);
    expect(questions.every((q) => q.kind === "listen" && q.clip !== undefined && q.options.length === 3 && q.couplet.poetSlug === "hafez")).toBe(true);
    expect(new Set(questions.map((q) => q.couplet.poem)).size).toBe(5); // one question for each poem
    expect(questions.every((q) => Number(q.couplet.poem.split("p").at(-1)) % 2 === 0)).toBe(true);
    for (const q of questions) {
      expect(q.options[q.correct]!.title).toBe(plain(q.couplet.m2));
      expect(q.options.every((option) => all.couplets.find((c) => `${c.poem}#${c.index}` === option.id)?.poetSlug === "hafez")).toBe(true);
    }
  });

  it("makes fewer questions when few poems are recited", async () => {
    expect(await listenQuestions(loaderOf({ recited: (id) => id < 2 }), deck(), 5, generator(2))).toHaveLength(2);
  });

  it("makes nothing when no recitation can be loaded", async () => {
    expect(await listenQuestions(loaderOf({ failing: true }), deck(), 5, generator(2))).toEqual([]);
    expect(await listenQuestions(loaderOf({ recited: () => false }), deck(), 5, generator(2))).toEqual([]);
  });

  it("makes the same questions for the same seed", async () => {
    const loader = loaderOf();
    expect(await listenQuestions(loader, deck(), 5, generator(8))).toEqual(await listenQuestions(loader, deck(), 5, generator(8)));
  });

  it("points the word hint at a word of the right option", async () => {
    for (const q of await listenQuestions(loaderOf(), deck(), 5, generator(2))) {
      const words = q.options[q.correct]!.title.split(/\s+/).filter(Boolean);
      expect(q.hintWord).toBeGreaterThanOrEqual(0);
      expect(q.hintWord).toBeLessThan(words.length);
    }
  });
});

describe("the clip range", () => {
  it("ends the margin before the next hemistich", () => {
    near(clipEnd(15.486, 21.036), 20.236);
    near(clipEnd(0, 7.386), 6.586);
  });

  it("keeps the minimum length for a short hemistich", () => {
    near(clipEnd(10, 12.0), 11.2); // 2 s − 0.8 s is 1.2 s: just the minimum
    near(clipEnd(10, 11.5), 11.2); // 1.5 s − 0.8 s would be 0.7 s
  });

  it("never runs past the mark even when the hemistich is shorter than the minimum", () => {
    expect(clipEnd(10, 10.9)).toBe(10.9);
  });

  it("fades over the last quarter second", () => {
    const [from, to] = fadeRange(15.486, 20.236);
    near(from, 19.986);
    expect(to).toBe(20.236);
    expect(listenClipRange.fade).toBe(0.25);
  });

  it("never starts the fade before the clip", () => {
    expect(fadeRange(10, 10.1)).toEqual([10, 10.1]);
  });

  it("fades a measured clip only over the silence it ends in", () => {
    expect(listenClipRange.measuredFade).toBe(0.08); // the 80 ms after the silence begins
    const [from, to] = fadeRange(15.2, 19.9, listenClipRange.measuredFade);
    near(from, 19.82);
    expect(to).toBe(19.9);
  });
});
