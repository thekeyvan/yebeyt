import { describe, expect, it } from "vitest";
import { singlePoet, sourceOf } from "../lib/games/couplet";
import { backgroundOf, allKinds, aboutOf, metaOf, nameOf, opening, tabCards, taglineOf } from "../lib/games/kinds";
import { newRecord, type DailyRecord } from "../lib/games/letterMarks";
import { GameStats, statsKey } from "../lib/games/stats";
import { roundSeed, tehranNow } from "../lib/games/debug";
import { TehranDay } from "../lib/games/tehranDay";
import { couplet, tehran } from "./games";
import { memoryStorage } from "./storage";

const solved = (): DailyRecord => ({ tries: ["مصام"], hinted: [], outcome: "solved", points: 100 });
const statsOn = (iso: string, storage = memoryStorage()) => new GameStats(storage, () => tehran(iso));

describe("GameStats", () => {
  it("starts empty", () => {
    const stats = statsOn("2026-11-23T10:00:00Z");
    expect([stats.points, stats.streak, stats.best("jigsaw")]).toEqual([0, 0, 0]);
  });

  it("counts solving today once and adds the points", () => {
    const stats = statsOn("2026-11-23T10:00:00Z");
    stats.record(solved(), stats.today);
    stats.record(solved(), stats.today);
    expect([stats.points, stats.streak, stats.best("daily")]).toEqual([100, 1, 100]);
  });

  it("earns nothing and keeps no streak for a failed or unfinished puzzle", () => {
    const stats = statsOn("2026-11-23T10:00:00Z");
    stats.record({ ...newRecord(), tries: ["ا"] }, stats.today);
    stats.record({ ...newRecord(), tries: ["ا", "ب", "پ"], outcome: "failed" }, stats.today);
    expect([stats.points, stats.streak]).toEqual([0, 0]);
    expect(stats.daily(stats.today)?.outcome).toBe("failed");
  });

  it("counts days in a row and stops at a missed day", () => {
    const stats = statsOn("2026-11-20T10:00:00Z");
    for (const back of [0, 1, 3, 4]) stats.record(solved(), new TehranDay(stats.today.number - back)); // the 18th was missed
    expect(stats.streak).toBe(2);
  });

  it("keeps yesterday's streak until the day not played yet is over", () => {
    let clock = tehran("2026-11-22T10:00:00Z");
    const stats = new GameStats(memoryStorage(), () => clock);
    stats.record(solved(), stats.today);
    expect(stats.streak).toBe(1);
    clock = tehran("2026-11-23T10:00:00Z"); // the next day, not played yet
    stats.refreshToday();
    expect(stats.streak).toBe(1);
    clock = tehran("2026-11-24T10:00:00Z"); // a whole day missed
    stats.refreshToday();
    expect(stats.streak).toBe(0);
  });

  it("counts to Tehran midnight", () => {
    expect(statsOn("2026-11-22T20:29:00Z").secondsUntilNextDay).toBe(60);
    expect(statsOn("2026-11-23T08:30:00Z").secondsUntilNextDay).toBe(12 * 3600); // noon in Tehran
  });

  it("turns the day at Tehran midnight", () => {
    let clock = tehran("2026-11-22T20:29:00Z");
    const stats = new GameStats(memoryStorage(), () => clock);
    expect(stats.today.key).toBe("2026-11-22");
    clock = tehran("2026-11-22T20:31:00Z");
    stats.refreshToday();
    expect(stats.today.key).toBe("2026-11-23");
  });

  it("only lets points and the best go up", () => {
    const stats = statsOn("2026-11-23T10:00:00Z");
    stats.award(60);
    stats.award(0);
    stats.award(-5);
    stats.raiseBest("jigsaw", 300);
    stats.raiseBest("jigsaw", 120);
    expect([stats.points, stats.best("jigsaw")]).toEqual([60, 300]);
  });

  it("survives a restart, in the phone's shape", () => {
    const storage = memoryStorage();
    const first = statsOn("2026-11-23T10:00:00Z", storage);
    first.record(solved(), first.today);
    first.award(40);
    const second = statsOn("2026-11-23T10:00:00Z", storage);
    expect([second.points, second.streak]).toEqual([140, 1]);
    expect(second.daily(second.today)).toEqual(solved());
    expect(Object.keys(JSON.parse(storage.getItem(statsKey)!)).sort()).toEqual(["best", "daily", "points", "solvedDays"]);
  });

  it("starts over from something unreadable", () => {
    const stats = statsOn("2026-11-23T10:00:00Z", memoryStorage({ [statsKey]: '{"points":"many","solvedDays":3,"best":[1],"daily":null}' }));
    expect([stats.points, stats.streak, stats.best("daily")]).toEqual([0, 0, 0]);
  });
});

describe("the Tehran day a debug page is told", () => {
  it("is the day in beytToday, at noon in Tehran, whatever the clock of the device", () => {
    const told = tehranNow(memoryStorage({ beytToday: "2026-11-23" }));
    expect(TehranDay.of(told).key).toBe("2026-11-23");
    expect(told.toISOString()).toBe("2026-11-23T08:30:00.000Z");
  });

  it("is now without it, or with a day that does not exist", () => {
    expect(Math.abs(tehranNow(memoryStorage()).getTime() - Date.now())).toBeLessThan(1000);
    expect(Math.abs(tehranNow(memoryStorage({ beytToday: "2026-02-30" })).getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe("the seed a debug page is given", () => {
  it("is the number in beytSeed, nothing else", () => {
    expect(roundSeed(memoryStorage({ beytSeed: "7" }))).toBe(7n);
    expect(roundSeed(memoryStorage({ beytSeed: "123456" }))).toBe(123456n);
    for (const seed of ["", "-1", "1e3", "seven", "99999999999999999999"]) expect(roundSeed(memoryStorage({ beytSeed: seed })), seed).toBeUndefined();
    expect(roundSeed(memoryStorage())).toBeUndefined();
  });
});

describe("the games", () => {
  it("has nine, in the order of the catalog", () => {
    expect(allKinds).toEqual(["daily", "jigsaw", "poet", "misra", "book", "match", "listen", "mosh", "duel"]);
    expect(allKinds.map(nameOf)).toEqual(["معمای امروز", "جورچین بیت", "حدس شاعر", "مصراع دوم", "از کدوم کتاب؟", "معنی‌یاب", "گوش کن", "مشاعره", "بازی رودررو"]);
    expect(metaOf("jigsaw")).toBe("تکی · ۱۰ بیت · ۲ دقیقه");
    expect(aboutOf("daily")).toContain("۳ فرصت");
  });

  it("has four cards on the tab, with a line each", () => {
    expect(tabCards).toEqual(["jigsaw", "poet", "misra", "book"]);
    expect(tabCards.map(taglineOf)).toEqual(["کلمه‌ها رو بچین", "کی گفته؟ ۴ گزینه", "مصراع دوم رو پیدا کن", "کدوم کتابِ شاعره؟"]);
    expect(taglineOf("daily")).toBeUndefined();
  });

  it("splits the sticker of a game with a friend on the diagonal", () => {
    expect(backgroundOf("daily")).toHaveLength(1);
    expect(backgroundOf("mosh")).toHaveLength(2);
    expect(backgroundOf("duel")).toHaveLength(2);
  });

  it("opens the two that are on the web, asks an account for the friends' games and says the rest is coming", () => {
    expect(opening("daily")).toEqual({ page: "/games/daily" });
    expect(opening("jigsaw")).toEqual({ page: "/games/jigsaw" });
    expect(["poet", "misra", "book", "match", "listen"].map((kind) => opening(kind as never))).toEqual(Array(5).fill("soon"));
    expect([opening("mosh"), opening("duel")]).toEqual(["account", "account"]);
  });

  it("names a couplet's source and the poet of a set", () => {
    expect(sourceOf(couplet(1))).toBe("سعدی · گلستان");
    expect(sourceOf({ poetName: "سعدی", bookTitle: "" })).toBe("سعدی");
    expect(singlePoet([couplet(1), couplet(2)])).toBe("سعدی");
    expect(singlePoet([couplet(1), couplet(2, { poet: "hafez" })])).toBeUndefined();
  });
});
