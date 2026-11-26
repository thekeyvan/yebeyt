import { describe, expect, it } from "vitest";
import { coupletKey, divanKey, divanRemoved, marksKey, ReaderMarks, type Mark } from "../lib/reader/marks";
import { isKept } from "../lib/reader/divan";
import { canChooseWeight, clampSize, defaultSettings, listFactor, listSize, parseSettings, readerFonts, settingsKey, sizeRange, spacingFactor, spacings, TextSettingsStore } from "../lib/reader/settings";

const memory = () => {
  const items = new Map<string, string>();
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
};

describe("ReaderMarks (Reader/ReaderMarks.swift)", () => {
  const marks = (storage = memory(), now = () => 1_700_000_000_000) => ({ storage, marks: new ReaderMarks(storage, now) });

  it("keys are the poem path and the couplet index", () => {
    expect(coupletKey("/hafez/ghazal/sh3", 1)).toBe("/hafez/ghazal/sh3#1");
  });

  it("marks nothing at first", () => {
    const { marks: fresh } = marks();
    for (const mark of ["liked", "reposted", "kept"] as Mark[]) expect(fresh.contains(mark, "/a/b/c", 0)).toBe(false);
  });

  it("turns a mark on and off", () => {
    const { marks: reader } = marks();
    expect(reader.toggle("liked", "/a/b/c", 2)).toBe(true);
    expect(reader.contains("liked", "/a/b/c", 2)).toBe(true);
    expect(reader.toggle("liked", "/a/b/c", 2)).toBe(false);
    expect(reader.contains("liked", "/a/b/c", 2)).toBe(false);
  });

  it("keeps the kinds, the couplets and the poems apart", () => {
    const { marks: reader } = marks();
    reader.toggle("kept", "/a/b/c", 2);
    expect(reader.contains("liked", "/a/b/c", 2)).toBe(false);
    expect(reader.contains("kept", "/a/b/c", 3)).toBe(false);
    expect(reader.contains("kept", "/a/b/d", 2)).toBe(false);
  });

  it("survives a restart", () => {
    const { storage, marks: reader } = marks();
    reader.toggle("liked", "/a/b/c", 0);
    reader.toggle("reposted", "/a/b/c", 1);
    reader.toggle("kept", "/a/b/c", 1);
    reader.toggle("kept", "/a/b/c", 4);
    reader.toggle("kept", "/a/b/c", 4);
    const reopened = new ReaderMarks(storage);
    expect(reopened.contains("liked", "/a/b/c", 0)).toBe(true);
    expect(reopened.contains("reposted", "/a/b/c", 1)).toBe(true);
    expect(reopened.contains("kept", "/a/b/c", 1)).toBe(true);
    expect(reopened.contains("kept", "/a/b/c", 4)).toBe(false);
    expect([...reopened.keys("kept")]).toEqual(["/a/b/c#1"]);
  });

  it("starts empty from unreadable saved data", () => {
    const storage = memory();
    storage.items.set(marksKey, "not json");
    storage.items.set(divanKey, "{");
    expect(new ReaderMarks(storage).contains("liked", "/a/b/c", 0)).toBe(false);
  });

  it("writes the divan as the phone does: key, keptAt and removedAt as ISO strings", () => {
    const { storage, marks: reader } = marks();
    reader.toggle("kept", "/a/b/c", 1);
    expect(JSON.parse(storage.items.get(divanKey)!)).toEqual([{ key: "/a/b/c#1", keptAt: "2023-11-14T22:13:20.000Z" }]);
    reader.toggle("kept", "/a/b/c", 1);
    expect(JSON.parse(storage.items.get(divanKey)!)).toEqual([{ key: "/a/b/c#1", keptAt: "2023-11-14T22:13:20.000Z", removedAt: "2023-11-14T22:13:20.000Z" }]);
  });

  it("keeps again after a removal even in the same millisecond, and the newest kept comes first", () => {
    const { marks: reader } = marks();
    reader.toggle("kept", "/a/b/c", 1);
    reader.toggle("kept", "/a/b/c", 1);
    expect(reader.contains("kept", "/a/b/c", 1)).toBe(false);
    reader.toggle("kept", "/a/b/c", 1);
    expect(reader.contains("kept", "/a/b/c", 1)).toBe(true);

    let time = 1000;
    const clock = marks(memory(), () => (time += 1000));
    clock.marks.toggle("kept", "/a/b/c", 0);
    clock.marks.toggle("kept", "/a/b/c", 5);
    expect(clock.marks.keptItems().map((item) => item.key)).toEqual(["/a/b/c#5", "/a/b/c#0"]);
  });

  it("takes a couplet out without asking, and the toast's way back keeps it again", () => {
    const { marks: reader } = marks();
    let offered: { text: string; run: () => void } | undefined;
    const offer = (text: string, undo: { run: () => void }) => (offered = { text, run: undo.run });
    reader.toggleKept("/a/b/c", 2, offer);
    expect(offered).toBeUndefined();
    expect(reader.contains("kept", "/a/b/c", 2)).toBe(true);
    reader.toggleKept("/a/b/c", 2, offer);
    expect(offered?.text).toBe(divanRemoved);
    expect(reader.contains("kept", "/a/b/c", 2)).toBe(false);
    offered?.run();
    expect(reader.contains("kept", "/a/b/c", 2)).toBe(true);
    // One kept again by hand stays as it is.
    reader.toggleKept("/a/b/c", 2, offer);
    reader.toggle("kept", "/a/b/c", 2);
    offered?.run();
    expect(reader.contains("kept", "/a/b/c", 2)).toBe(true);
  });

  it("tells the listeners, with a new state each time", () => {
    const { marks: reader } = marks();
    let calls = 0;
    reader.subscribe(() => calls++);
    const before = reader.snapshot();
    reader.toggle("liked", "/a/b/c", 0);
    expect(calls).toBe(1);
    expect(reader.snapshot()).not.toBe(before);
  });

  it("is kept when it was kept after it was last taken out", () => {
    expect(isKept({ key: "k", keptAt: 7, removedAt: 9 })).toBe(false);
    expect(isKept({ key: "k", keptAt: 10, removedAt: 9 })).toBe(true);
    expect(isKept({ key: "k" })).toBe(false);
  });
});

describe("text settings (Reader/TextSettings.swift)", () => {
  it("starts with the board's selected options", () => {
    expect(defaultSettings).toEqual({ size: 21, font: "parastoo", bold: true, layout: "staggered", spacing: "loose", theme: "paper" });
  });

  it("offers the eight fonts in the board's order", () => {
    expect(readerFonts.map((font) => font.title)).toEqual(["پرستو", "نسخ", "نستعلیق", "گندم", "مرکزی", "شبنم", "ساحل", "وزیر"]);
  });

  it("lets only Parastoo choose a weight", () => {
    expect(canChooseWeight(defaultSettings)).toBe(true);
    expect(canChooseWeight({ ...defaultSettings, font: "naskh" })).toBe(false);
  });

  it("keeps the size in the slider's range", () => {
    expect([clampSize(99), clampSize(1), clampSize(20.6)]).toEqual([sizeRange.max, sizeRange.min, 21]);
    expect(parseSettings({ size: 99 }).size).toBe(25);
  });

  it("grows the line spacing from tight to loose, and the list is a little smaller and tighter", () => {
    const factors = spacings.map(({ factor }) => factor);
    expect(factors).toEqual([...factors].sort());
    expect(spacingFactor("loose")).toBe(2.1);
    expect([listSize(defaultSettings), listFactor(defaultSettings)]).toEqual([20, 1.9]);
  });

  it("starts from the defaults and keeps every change", () => {
    const storage = memory();
    const store = new TextSettingsStore(storage);
    expect(store.snapshot()).toEqual(defaultSettings);
    store.update({ font: "gandom", theme: "dark", layout: "centered", spacing: "tight", size: 18, bold: false });
    const reopened = new TextSettingsStore(storage);
    expect(reopened.snapshot()).toEqual({ font: "gandom", theme: "dark", layout: "centered", spacing: "tight", size: 18, bold: false });
    expect(JSON.parse(storage.items.get(settingsKey)!).font).toBe("gandom");
  });

  it("falls back to the defaults for what is unreadable or unknown, field by field", () => {
    const storage = memory();
    storage.items.set(settingsKey, "{");
    expect(new TextSettingsStore(storage).snapshot()).toEqual(defaultSettings);
    expect(parseSettings({ font: "comic", size: "big", theme: "dark", bold: 1 })).toEqual({ ...defaultSettings, theme: "dark" });
    expect(parseSettings(null)).toEqual(defaultSettings);
  });
});
