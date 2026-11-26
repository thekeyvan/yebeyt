import { describe, expect, it } from "vitest";
import { persianDigits, persianClock } from "../lib/persian";
import { alphabet, lettersOf } from "../lib/games/letters";
import { SeededGenerator } from "../lib/games/seeded";
import * as scoring from "../lib/games/scoring";
import { TehranDay } from "../lib/games/tehranDay";
import { leaveGame } from "../lib/games/leave";
import { capOf, clipped, scoreGameOf } from "../lib/games/scoreGame";
import { tehran } from "./games";

describe("PersianLetters", () => {
  it("folds diacritics and Arabic forms", () => {
    expect(lettersOf("عِشْقٌ")).toEqual([..."عشق"]);
    expect(lettersOf("كتاب")).toEqual([..."کتاب"]);
    expect(lettersOf("يار")).toEqual([..."یار"]);
    expect(lettersOf("مُصَلّا")).toEqual([..."مصلا"]);
  });

  it("keeps آ its own letter", () => {
    expect(lettersOf("آب")).toEqual([..."آب"]);
    expect(lettersOf("آب")).not.toEqual(lettersOf("اب"));
  });

  it("ignores punctuation around the word but refuses it inside", () => {
    expect(lettersOf("«عشق»،")).toEqual([..."عشق"]);
    expect(lettersOf("می\u200Cرود")).toBeUndefined();
    expect(lettersOf("عشق۲")).toBeUndefined();
    expect(lettersOf("—")).toBeUndefined();
  });

  it("has the alphabet of the keyboard", () => {
    expect(alphabet).toHaveLength(35);
  });
});

describe("SeededGenerator", () => {
  it("shuffles the same way for the same seed", () => {
    const a = new SeededGenerator(7n);
    const b = new SeededGenerator(7n);
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(a.shuffled(items)).toEqual(b.shuffled(items));
    expect(new SeededGenerator(7n).shuffled(items).sort((x, y) => x - y)).toEqual(items);
  });

  it("is splitmix64: the first numbers of seed 0", () => {
    const generator = new SeededGenerator(0n);
    expect(generator.next()).toBe(0xe220a8397b1dcdafn);
    expect(generator.next()).toBe(0x6e789e6aa1b965f4n);
  });
});

describe("TehranDay", () => {
  it("changes at Tehran midnight, not UTC", () => {
    // Tehran is UTC+3:30 all year: 20:29:59 UTC is 23:59:59 on the 22nd, one second later it is the 23rd.
    expect(TehranDay.of(tehran("2026-11-22T20:29:59Z")).key).toBe("2026-11-22");
    expect(TehranDay.of(tehran("2026-11-22T20:30:00Z")).key).toBe("2026-11-23");
    expect(TehranDay.of(tehran("2026-07-01T20:29:59Z")).key).toBe("2026-07-01");
  });

  it("round-trips a key", () => {
    const day = TehranDay.fromKey("2026-11-23")!;
    expect(day.key).toBe("2026-11-23");
    expect(day.previous.key).toBe("2026-11-22");
    expect(day.number).toBe(day.previous.number + 1);
    expect(TehranDay.fromKey("2026-12-01")!.previous.key).toBe("2026-11-30");
  });

  it("refuses bad keys", () => {
    for (const key of ["", "2026-13-01", "2026-02-30", "yesterday", "2026-11", "2026-1-1-1"]) expect(TehranDay.fromKey(key), key).toBeUndefined();
  });

  it("starts at midnight in Tehran", () => {
    expect(TehranDay.fromKey("2026-11-23")!.start.toISOString()).toBe("2026-11-22T20:30:00.000Z");
  });

  it("shows the Persian date", () => {
    const day = TehranDay.fromKey("2026-11-23")!;
    expect(day.stickerParts).toEqual({ day: "۲", month: "آذر" });
    expect(day.line).toBe("دوشنبه ۲ آذر");
  });
});

describe("Scoring", () => {
  it("has the table from the docs", () => {
    expect(scoring.dailyByTry).toEqual([100, 70, 40]);
    expect(scoring.dailyHintCost).toBe(30);
    expect(scoring.jigsawHintCost).toBe(20);
    expect(scoring.jigsawWord).toBe(20);
    expect(scoring.jigsawSecondLeft).toBe(1);
  });

  it("gives the daily points by the try, less the hints", () => {
    expect(scoring.daily(1, 0)).toBe(100);
    expect(scoring.daily(2, 0)).toBe(70);
    expect(scoring.daily(3, 0)).toBe(40);
    expect(scoring.daily(2, 1)).toBe(40);
    expect(scoring.daily(3, 2)).toBe(0);
    expect(scoring.daily(1, 3)).toBe(10);
    expect(scoring.daily(4, 0)).toBe(0);
  });

  it("gives جورچین 20 a word, less the hints, and a bonus for the seconds left", () => {
    expect(scoring.jigsaw(3, 0)).toBe(60);
    expect(scoring.jigsaw(2, 1)).toBe(20);
    expect(scoring.jigsaw(0, 2)).toBe(0);
    expect(scoring.jigsawTimeBonus(42)).toBe(42);
    expect(scoring.jigsawTimeBonus(-3)).toBe(0);
  });
});

describe("ScoreGame", () => {
  it("has the server's caps", () => {
    expect(["daily", "jigsaw", "poet", "second", "book", "match", "listen", "onboarding"].map((game) => capOf(game as never))).toEqual([100, 320, 440, 440, 440, 50, 100, 50]);
  });

  it("clips a round to its cap and never below zero", () => {
    expect(clipped("jigsaw", 999)).toBe(320);
    expect(clipped("daily", -4)).toBe(0);
    expect(clipped("daily", 70)).toBe(70);
  });

  it("is nothing for the games with friends", () => {
    expect(scoreGameOf("misra")).toBe("second");
    expect(scoreGameOf("daily")).toBe("daily");
    expect(scoreGameOf("mosh")).toBeUndefined();
    expect(scoreGameOf("duel")).toBeUndefined();
  });
});

describe("leaving a game", () => {
  it("asks only for a round that has started and is not over", () => {
    expect(leaveGame.asks({ answered: 0, clockRuns: false, finished: false })).toBe(false);
    expect(leaveGame.asks({ answered: 1, clockRuns: false, finished: false })).toBe(true);
    expect(leaveGame.asks({ answered: 0, clockRuns: true, finished: false })).toBe(true);
    expect(leaveGame.asks({ answered: 10, clockRuns: true, finished: true })).toBe(false);
    expect(leaveGame.asks({ answered: 3, clockRuns: false, finished: true })).toBe(false);
  });

  it("has the lead's words", () => {
    expect(leaveGame.title).toBe("از بازی بری بیرون؟");
    expect(leaveGame.message).toBe("نتیجه‌ی این دور ثبت نمی‌شه.");
    expect(leaveGame.leave).toBe("برو بیرون");
    expect(leaveGame.stay).toBe("بمون");
  });
});

describe("persianClock", () => {
  it("reads like the board", () => {
    expect(persianClock(120)).toBe("۲:۰۰");
    expect(persianClock(42)).toBe("۰:۴۲");
    expect(persianClock(125)).toBe("۲:۰۵");
    expect(persianDigits(3)).toBe("۳");
  });
});
