import { describe, expect, it } from "vitest";
import { DivanModel } from "../lib/me/divanModel";
import { relativeDay, shortDate } from "../lib/me/divanDays";
import { filterEntries, groupSections, poetCounts, type DivanEntry } from "../lib/me/divanLogic";
import { favouritePoet } from "../lib/me/favouritePoet";
import { seedDivan, seedItems, seedKeys } from "../lib/me/seed";
import { ReaderMarks } from "../lib/reader/marks";
import { memoryStorage } from "./storage";
import type { Mood } from "../lib/library/models";
import type { Poem } from "../lib/poetry/models";

// Ported from apps/ios/YebeytTests/DivanLogicTests.swift (DivanLogic, DivanModel), MeRulesTests.swift (FavouritePoet).

const entry = (path: string, index: number, m1: string, m2: string, keptAt: number, title = "غزل ۱"): DivanEntry => ({
  key: `${path}#${index}`,
  path,
  index,
  couplet: { m1, m2 },
  poetSlug: path.split("/")[0]!,
  title,
  keptAt,
});

const names: Record<string, string> = { hafez: "حافظ", saadi: "سعدی", moulavi: "مولانا" };
const poetName = (slug: string) => names[slug] ?? slug;
const moods: Mood[] = [
  { key: "love", title: "عشق", words: ["عشق", "عاشق"] },
  { key: "spring", title: "بهار", words: ["بهار", "گل"] },
];

const sample = [
  entry("hafez/g/sh1", 0, "الا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول ولی افتاد مشکل‌ها", 300),
  entry("hafez/g/sh3", 1, "بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را", 500),
  entry("saadi/g/sh207", 0, "ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", 100),
  entry("moulavi/m/sh1", 0, "بشنو این نی چون شکایت می‌کند", "از جدایی‌ها حکایت می‌کند", 400),
];

describe("DivanLogic: search", () => {
  it("matches words of the couplet after normalising", () => {
    expect(filterEntries(sample, "ساقی", undefined, poetName)).toHaveLength(2);
    // Arabic ي/ى and a missing half-space still match.
    expect(filterEntries(sample, "جدايى", undefined, poetName).map((e) => e.key)).toEqual(["moulavi/m/sh1#0"]);
    expect(filterEntries(sample, "  آرام ", undefined, poetName).map((e) => e.key)).toEqual(["saadi/g/sh207#0"]);
  });

  it("also matches the poet's name", () => {
    expect(filterEntries(sample, "سعدی", undefined, poetName).map((e) => e.key)).toEqual(["saadi/g/sh207#0"]);
  });

  it("keeps everything for an empty query, the newest first", () => {
    expect(filterEntries(sample, "  ", undefined, poetName).map((e) => e.keptAt)).toEqual([500, 400, 300, 100]);
  });

  it("keeps only the chosen poet", () => {
    expect(filterEntries(sample, "", "hafez", poetName)).toHaveLength(2);
    expect(filterEntries(sample, "عشق", "saadi", poetName)).toEqual([]);
  });
});

describe("DivanLogic: grouping", () => {
  it("counts each poet, the most first and equal counts by slug", () => {
    const chips = poetCounts(sample);
    expect(chips.map((chip) => chip.slug)).toEqual(["hafez", "moulavi", "saadi"]);
    expect(chips.map((chip) => chip.count)).toEqual([2, 1, 1]);
  });

  it("groups by poet: the biggest first, each section newest first", () => {
    const sections = groupSections(sample, "poet", moods, poetName);
    expect(sections.map((section) => section.title)).toEqual(["حافظ", "مولانا", "سعدی"]);
    expect(sections[0]!.poetSlug).toBe("hafez");
    expect(sections[0]!.entries.map((e) => e.keptAt)).toEqual([500, 300]);
    expect(sections.map((section) => section.entries.length)).toEqual([2, 1, 1]);
  });

  it("groups by topic with the first mood that matches, else «بقیه»", () => {
    const sections = groupSections(sample, "topic", moods, poetName);
    // «الا یا ایها…» has «عشق»; «بده ساقی…» has «گل» (in «گلگشت»); the others match nothing.
    expect(sections.map((section) => section.title)).toEqual(["عشق", "بهار", "بقیه"]);
    expect(sections[0]!.entries.map((e) => e.key)).toEqual(["hafez/g/sh1#0"]);
    expect(sections[1]!.entries.map((e) => e.key)).toEqual(["hafez/g/sh3#1"]);
    expect(sections[2]!.entries.map((e) => e.key)).toEqual(["moulavi/m/sh1#0", "saadi/g/sh207#0"]);
  });

  it("puts a couplet of two moods in the first only", () => {
    expect(groupSections([entry("a/b/c", 0, "عشق بهار", "", 1)], "topic", moods, poetName).map((section) => section.title)).toEqual(["عشق"]);
  });

  it("makes «تازه‌ترین» one list without a header", () => {
    const sections = groupSections(sample, "newest", moods, poetName);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe("");
    expect(sections[0]!.entries.map((e) => e.keptAt)).toEqual([500, 400, 300, 100]);
  });

  it("has no sections for an empty divan", () => {
    expect(groupSections([], "topic", moods, poetName)).toEqual([]);
    expect(groupSections([], "newest", moods, poetName)).toEqual([]);
  });
});

describe("DivanDays", () => {
  const zone = "Asia/Tehran";
  const now = new Date("2026-11-23T15:00:00+03:30");
  const line = (daysAgo: number, hour = 9) => relativeDay(new Date(`2026-11-${String(23 - daysAgo).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+03:30`).getTime(), now, zone);

  it("says today, yesterday, last week, then the date", () => {
    expect(line(0, 1)).toBe("امروز");
    expect(line(1, 23)).toBe("دیروز");
    expect(line(2)).toBe("هفته‌ی پیش");
    expect(line(7)).toBe("هفته‌ی پیش");
    expect(line(8)).toBe("۲۴ آبان"); // 2026-11-15
  });

  it("writes the short date in the Persian calendar with Persian digits", () => {
    expect(shortDate(new Date("2026-11-23T09:00:00+03:30"), zone)).toBe("۲ آذر");
  });
});

describe("DivanModel", () => {
  const poem = (title: string, count: number): Poem => ({ id: 1, title, path: "/hafez/ghazal/sh3", couplets: Array.from({ length: count }, (_, n) => ({ m1: `الف${n}`, m2: `ب${n}` })) });
  const load = (poems: Record<string, Poem>) => async (path: string) => {
    const found = poems[path];
    if (!found) throw new Error("no such poem");
    return found;
  };

  it("turns kept couplets into entries with their text, poet and short title, the newest first", async () => {
    const model = new DivanModel(load({ "/hafez/ghazal/sh3": poem("غزل شمارهٔ ۳", 9) }));
    const entries = await model.load([
      { key: "/hafez/ghazal/sh3#0", keptAt: 5_000 },
      { key: "/hafez/ghazal/sh3#1", keptAt: 9_000 },
    ]);
    expect(entries.map((e) => e.key)).toEqual(["/hafez/ghazal/sh3#1", "/hafez/ghazal/sh3#0"]);
    const first = entries.at(-1)!;
    expect(first).toMatchObject({ poetSlug: "hafez", title: "غزل ۳", keptAt: 5_000, path: "/hafez/ghazal/sh3", index: 0 });
    expect(first.couplet.m1).toBe("الف0");
  });

  it("leaves out a couplet whose poem can't be loaded or whose index is not in it", async () => {
    const model = new DivanModel(load({ "/hafez/ghazal/sh3": poem("غزل ۳", 9) }));
    const entries = await model.load([
      { key: "/hafez/ghazal/sh3#0", keptAt: 1 },
      { key: "/nobody/book/sh9#0", keptAt: 2 },
      { key: "/hafez/ghazal/sh3#99", keptAt: 3 },
      { key: "broken", keptAt: 4 },
    ]);
    expect(entries.map((e) => e.key)).toEqual(["/hafez/ghazal/sh3#0"]);
  });

  it("asks for each poem once, and not again after it failed", async () => {
    const asked: string[] = [];
    const model = new DivanModel(async (path) => {
      asked.push(path);
      if (path.startsWith("/gone")) throw new Error("no");
      return poem("غزل ۳", 9);
    });
    await model.load([
      { key: "/hafez/ghazal/sh3#0", keptAt: 1 },
      { key: "/hafez/ghazal/sh3#1", keptAt: 2 },
      { key: "/gone/x/y#0", keptAt: 3 },
      { key: "/gone/x/y#1", keptAt: 4 },
    ]);
    expect(asked).toEqual(["/hafez/ghazal/sh3", "/gone/x/y"]);
  });
});

describe("FavouritePoet", () => {
  const kept = ["/hafez/g/sh1#0", "/hafez/g/sh1#1", "/saadi/g/sh1#0", "/saadi/g/sh2#0", "/moulavi/m/sh1#0"];

  it("has the most kept couplets, then the most read poems", () => {
    // A tie in kept couplets goes to the poet read more.
    expect(favouritePoet(kept, ["/saadi/g/sh1", "/saadi/g/sh2", "/hafez/g/sh1"])).toBe("saadi");
    expect(favouritePoet(kept, ["/hafez/g/sh1", "/hafez/g/sh9", "/saadi/g/sh1"])).toBe("hafez");
  });

  it("is the most read when nothing is kept, and nobody when there is nothing", () => {
    expect(favouritePoet([], ["/moulavi/m/sh1", "/moulavi/m/sh2", "/hafez/g/sh1"])).toBe("moulavi");
    expect(favouritePoet([], [])).toBeUndefined();
  });
});

describe("the debug divan (the phone's -beytSeedDivan)", () => {
  const now = Date.UTC(2026, 10, 23, 12);

  it("keeps twenty couplets of the bundled books on different days", () => {
    const keys = seedKeys();
    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(20);
    expect(keys.every((key) => /^\/(hafez\/ghazal|khayyam\/robaee|babataher\/2beytiha)\/sh\d+#\d+$/.test(key))).toBe(true);
    const items = seedItems(now);
    expect(new Set(items.map((item) => Math.floor((now - item.keptAt) / 86_400_000))).size).toBeGreaterThan(5);
    expect(items.every((item) => item.keptAt <= now)).toBe(true);
  });

  it("adds only what the divan does not know, even a couplet that was taken out", () => {
    const marks = new ReaderMarks(memoryStorage(), () => now);
    seedDivan(marks, now);
    expect(marks.keptItems()).toHaveLength(20);
    marks.toggle("kept", "/hafez/ghazal/sh1", 0); // taken out
    seedDivan(marks, now + 1000);
    expect(marks.keptItems()).toHaveLength(19);
  });
});
