import { describe, expect, it } from "vitest";
import { Achievements, achievementsKey } from "../lib/me/achievements";
import { allBadges, levelName } from "../lib/me/badges";
import { QuizRound } from "../lib/games/quizRound";
import { QuizSession } from "../lib/games/quizSession";
import { GameStats } from "../lib/games/stats";
import { TehranDay } from "../lib/games/tehranDay";
import { ReadingProgress } from "../lib/library/progress";
import { couplets, question } from "./quizFixtures";
import { tehran } from "./games";
import { solved } from "./me";
import { memoryStorage } from "./storage";

// Ported from apps/ios/YebeytTests/MeRulesTests.swift (Level, MeBadge, Achievements, bestStreak, couplets read).

describe("Level", () => {
  it("comes from the total points", () => {
    expect([0, 499, 500, 1999, 2000, 2480, 4999, 5000, 11_999, 12_000, 999_999].map(levelName)).toEqual([
      "نوآموز",
      "نوآموز",
      "بیت‌خوان",
      "بیت‌خوان",
      "غزل‌باز",
      "غزل‌باز",
      "غزل‌باز",
      "سخن‌دان",
      "سخن‌دان",
      "استاد سخن",
      "استاد سخن",
    ]);
  });
});

describe("Badges", () => {
  it("are four in the board's order, all locked at first, each with its rule", () => {
    const badges = allBadges({ bestStreak: 0, hafezRight: 0, coupletsRead: 0 });
    expect(badges.map((badge) => badge.title)).toEqual(["۷ روز", "اولین مشاعره", "حافظ‌شناس", "۱۰۰ بیت"]);
    expect(badges.every((badge) => !badge.earned)).toBe(true);
    expect(badges.map((badge) => badge.rule)).toEqual(["۷ روز پشت‌سرهم معمای روز رو حل کن", "اولین مشاعره‌ت رو بازی کن", "به ۵۰ بیت حافظ درست جواب بده", "۱۰۰ بیت بخون"]);
  });

  it("are earned at their thresholds", () => {
    const earned = (progress: { bestStreak?: number; hafezRight?: number; coupletsRead?: number }) =>
      allBadges({ bestStreak: 0, hafezRight: 0, coupletsRead: 0, ...progress })
        .filter((badge) => badge.earned)
        .map((badge) => badge.id);
    expect(earned({ bestStreak: 6, hafezRight: 49, coupletsRead: 99 })).toEqual([]);
    expect(earned({ bestStreak: 7 })).toEqual(["streak7"]);
    expect(earned({ hafezRight: 50 })).toEqual(["hafez"]);
    expect(earned({ coupletsRead: 100 })).toEqual(["read100"]);
    // The first مشاعره waits for friends: it stays locked whatever else is done.
    expect(earned({ bestStreak: 30, hafezRight: 500, coupletsRead: 5000 })).not.toContain("firstMosh");
  });
});

describe("Achievements", () => {
  it("counts the Hafez answers and the book wins and keeps them", () => {
    const storage = memoryStorage();
    const counters = new Achievements(storage);
    counters.recordRight("hafez");
    counters.recordRight("saadi");
    counters.recordRight("hafez");
    counters.recordRound("book", 7, 10);
    counters.recordRound("book", 6, 10); // not a win
    counters.recordRound("poet", 10, 10); // only از کدوم کتاب؟ counts
    counters.recordRound("book", 10, 10);
    expect([counters.hafezRight, counters.bookWins]).toEqual([2, 2]);
    const reopened = new Achievements(storage);
    expect([reopened.hafezRight, reopened.bookWins]).toEqual([2, 2]);
    expect(storage.getItem(achievementsKey)).toBe('{"hafezRight":2,"bookWins":2}');
  });

  it("starts from nothing when what is kept is unreadable", () => {
    expect(new Achievements(memoryStorage({ [achievementsKey]: "{oops" })).hafezRight).toBe(0);
  });

  /** A round of 10 in از کدوم کتاب؟ with `right` right answers (Hafez couplets), played through the stats hooks. */
  function playBookRound(right: number, counters: Achievements) {
    const stats = new GameStats(memoryStorage());
    stats.onRightAnswer = (slug) => counters.recordRight(slug);
    stats.onRoundEnd = (game, rightCount, total) => counters.recordRound(game, rightCount, total);
    const questions = Array.from({ length: 10 }, (_, number) => question("book", { correct: 1, options: 3, couplet: couplets("hafez", 10)[number]! }));
    const session = new QuizSession(QuizRound.of("book", questions)!, stats);
    questions.forEach((asked, index) => {
      session.select(index < right ? asked.correct : (asked.correct + 1) % asked.options.length);
      session.confirm();
      session.next();
    });
  }

  it("counts the Hafez answers of a book round and a win at seven of ten", () => {
    const counters = new Achievements(memoryStorage());
    playBookRound(6, counters);
    expect([counters.bookWins, counters.hafezRight]).toEqual([0, 6]);
    playBookRound(7, counters);
    expect([counters.bookWins, counters.hafezRight]).toEqual([1, 13]);
  });
});

describe("The best streak", () => {
  it("is the longest run ever, not the current one", () => {
    const stats = new GameStats(memoryStorage(), () => tehran("2026-11-23T10:00:00Z"));
    for (const day of [100, 101, 102, 103, 104, 105, 106, 150, 151]) stats.record(solved(), new TehranDay(day));
    expect(stats.streak).toBe(0);
    expect(stats.bestStreak).toBe(7);
  });
});

describe("Couplets read", () => {
  it("are counted once each, and kept", () => {
    const storage = memoryStorage();
    const progress = new ReadingProgress(storage);
    progress.opened("/a/b/c", 0, 5, "غزل ۱");
    progress.opened("/a/b/c", 1, 5, "غزل ۱");
    progress.opened("/a/b/c", 1, 5, "غزل ۱");
    progress.reachedEnd("/a/b/d", 3);
    expect(progress.coupletsRead).toBe(5);
    expect(new ReadingProgress(storage).coupletsRead).toBe(5);
  });
});
