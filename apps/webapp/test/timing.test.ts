import { describe, expect, it } from "vitest";
import type { Couplet } from "../lib/poetry/models";
import { RecitationTiming, TimingError } from "../lib/reader/timing";
import { fixtureText } from "./files";

const ghazal: Couplet[] = Array.from({ length: 4 }, (_, index) => ({ m1: `الف${index}`, m2: `ب${index}` }));
const mixed: Couplet[] = [{ m1: "نثر", m2: "" }, { m1: "الف", m2: "ب" }, { m1: "پ", m2: "ت" }];
const timing = () => RecitationTiming.parse(fixtureText("timing-2130-ff.xml"));
const wrap = (entries: string) => `<A><PoemAudio><SyncArray>${entries}</SyncArray></PoemAudio></A>`;
const info = (verse: number, milliseconds: number) => `<SyncInfo><VerseOrder>${verse}</VerseOrder><AudioMiliseconds>${milliseconds}</AudioMiliseconds></SyncInfo>`;

describe("RecitationTiming (Reader/RecitationTiming.swift)", () => {
  it("parses the start of every verse", () => {
    expect(timing().starts.map((start) => start.verse)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(timing().starts.map((start) => start.milliseconds)).toEqual([0, 7386, 15486, 21036, 29886, 34986]);
  });

  it("makes two verses one couplet", () => {
    const t = timing();
    expect(t.couplet(0, ghazal)).toBe(0);
    expect(t.couplet(7.385, ghazal)).toBe(0); // still the first hemistich
    expect(t.couplet(7.386, ghazal)).toBe(0); // second hemistich of the first couplet
    expect(t.couplet(15.5, ghazal)).toBe(1);
    expect(t.couplet(21.1, ghazal)).toBe(1);
    expect(t.couplet(30, ghazal)).toBe(2);
  });

  it("stays on the last verse's couplet after it", () => {
    expect(timing().couplet(500, ghazal)).toBe(2);
  });

  it("clamps a verse beyond the text to the last couplet", () => {
    expect(timing().couplet(40, [{ m1: "الف", m2: "ب" }])).toBe(0);
  });

  it("counts a single-line couplet as one verse", () => {
    expect(timing().couplet(7.4, mixed)).toBe(1); // verse 1 is the first of couplet 1
    expect(timing().couplet(21.1, mixed)).toBe(2); // verse 3 starts couplet 2
  });

  it("reads time before the first entry as the first couplet", () => {
    expect(new RecitationTiming([{ verse: 0, milliseconds: 1500 }]).couplet(0.2, ghazal)).toBe(0);
  });

  it("gives no answer when there are no couplets", () => {
    expect(timing().couplet(3, [])).toBeUndefined();
  });

  it("sorts entries that are out of order", () => {
    expect(RecitationTiming.parse(wrap(info(2, 9000) + info(0, 0))).couplet(10, ghazal)).toBe(1);
  });

  it("skips the negative end marker, which would read as verse -2 and send the text back to the first couplet", () => {
    const t = RecitationTiming.parse(wrap(info(0, 0) + info(2, 9000) + info(-2, 40000)));
    expect(t.starts.map((start) => start.verse)).toEqual([0, 2]);
    expect(t.couplet(45, ghazal)).toBe(1);
  });

  it("starts a couplet where its first verse does", () => {
    const t = timing();
    expect([t.start(0, ghazal), t.start(1, ghazal), t.start(2, ghazal)]).toEqual([0, 15.486, 29.886]);
  });

  it("counts a single-line couplet as one verse in a start", () => {
    const t = timing();
    expect([t.start(0, mixed), t.start(1, mixed), t.start(2, mixed)]).toEqual([0, 7.386, 21.036]);
  });

  it("has no start for a couplet past the file, outside the text or without a timing", () => {
    const t = timing();
    expect(t.start(3, ghazal)).toBeUndefined(); // verse 6: the file ends at verse 5
    for (const index of [4, 9, -1]) expect(t.start(index, ghazal)).toBeUndefined();
    expect(t.start(0, [])).toBeUndefined();
  });

  it("makes start and couplet each other's inverse", () => {
    const t = timing();
    for (const index of [0, 1, 2]) expect(t.couplet(t.start(index, ghazal)!, ghazal)).toBe(index);
  });

  it("reads a position at a start as that couplet, even where 1.001 × 1000 is 1000.9999…", () => {
    const t = new RecitationTiming([0, 1001, 3347, 5002].map((milliseconds, index) => ({ verse: index * 2, milliseconds })));
    const couplets = Array.from({ length: 4 }, (_, index) => ({ m1: `الف${index}`, m2: `ب${index}` }));
    for (const [index, milliseconds] of [0, 1001, 3347, 5002].entries()) expect(t.couplet(milliseconds / 1000, couplets)).toBe(index);
  });

  it("rejects a file without timings", () => {
    expect(() => RecitationTiming.parse("<A/>")).toThrow(TimingError);
    expect(() => RecitationTiming.parse("not xml")).toThrow(TimingError);
  });
});
