import { describe, expect, it } from "vitest";
import { GameDeck, parseDeck } from "../lib/games/couplet";
import { DailyGame } from "../lib/games/dailyGame";
import { DailySession } from "../lib/games/dailySession";
import { candidates, hemistichOf, keyCount, keysFor, letterRange, pickPuzzle, stopWords } from "../lib/games/dailyPuzzle";
import { alphabet } from "../lib/games/letters";
import { letterMarks, newRecord, type DailyRecord } from "../lib/games/letterMarks";
import { SeededGenerator } from "../lib/games/seeded";
import { GameStats } from "../lib/games/stats";
import { TehranDay } from "../lib/games/tehranDay";
import { wordsOf } from "../lib/games/letters";
import { bundledFile } from "./files";
import { couplet, tehran } from "./games";
import { memoryStorage } from "./storage";

const marks = (guess: string, answer: string) => letterMarks([...guess], [...answer]);

describe("LetterFeedback", () => {
  it("is green for the right place, yellow for elsewhere, grey for none", () => {
    expect(marks("مقام", "مرام")).toEqual(["green", "grey", "green", "green"]);
    expect(marks("ابرو", "مرام")).toEqual(["yellow", "grey", "yellow", "grey"]);
    expect(marks("بابا", "مرام")).toEqual(["grey", "yellow", "grey", "grey"]);
  });

  it("marks a repeated letter yellow only as many times as the word has it", () => {
    expect(marks("ممنا", "نامه")).toEqual(["yellow", "grey", "yellow", "yellow"]);
    expect(marks("مممم", "ناره")).toEqual(["grey", "grey", "grey", "grey"]);
    expect(marks("ااب", "ابا")).toEqual(["green", "yellow", "yellow"]);
  });

  it("lets a green take the letter before an earlier yellow", () => {
    expect(marks("ابا", "ببا")).toEqual(["grey", "green", "green"]);
    expect(marks("اببا", "بباا")).toEqual(["yellow", "green", "yellow", "green"]);
  });

  it("is all green for the whole word", () => {
    expect(marks("عشق", "عشق")).toEqual(["green", "green", "green"]);
  });
});

describe("DailyGame", () => {
  const game = (word = "مرام", record: DailyRecord = newRecord()) => new DailyGame([...word], record);
  const play = (g: DailyGame, guess: string) => {
    for (const letter of guess) g.type(letter);
    g.submit();
  };

  it("fills the row in order and erase takes the letters back", () => {
    const g = game();
    g.type("م");
    g.type("ق");
    expect(g.entry).toEqual(["م", "ق", undefined, undefined]);
    expect(g.cursor).toBe(2);
    g.erase();
    expect(g.entry).toEqual(["م", undefined, undefined, undefined]);
    g.erase();
    g.erase();
    expect(g.entry).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("wants a full row to submit and ignores too many letters", () => {
    const g = game();
    g.type("م");
    expect(g.submit()).toBe(false);
    expect(g.tries).toEqual([]);
    for (const letter of "قام") g.type(letter);
    g.type("ز");
    expect(g.entry).toEqual([..."مقام"]);
    expect(g.submit()).toBe(true);
    expect(g.tries).toEqual([[..."مقام"]]);
    expect(g.entry).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("does not count the solving try as a miss", () => {
    const g = game();
    play(g, "مقام");
    expect(g.misses).toBe(1);
    play(g, "مرام");
    expect(g.outcome).toBe("solved");
    expect(g.misses).toBe(1);
  });

  it("earns 70 for solving on the second try", () => {
    const g = game();
    play(g, "مقام");
    expect(g.outcome).toBe("playing");
    expect(g.points).toBe(0);
    play(g, "مرام");
    expect([g.outcome, g.solvedOnTry, g.points]).toEqual(["solved", 2, 70]);
  });

  it("fails after three wrong tries and takes nothing more", () => {
    const g = game();
    play(g, "مقام");
    play(g, "مصام");
    play(g, "ممام");
    expect([g.outcome, g.points, g.misses]).toEqual(["failed", 0, 3]);
    g.type("م");
    expect(g.submit()).toBe(false);
    expect(g.entry).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("colours each key with the best mark of its letter", () => {
    const g = game();
    play(g, "مقام");
    expect(g.keyMarks.get("م")).toBe("green");
    expect(g.keyMarks.get("ق")).toBe("grey");
    play(g, "رمام");
    expect(g.keyMarks.get("ر")).toBe("yellow");
    expect(g.keyMarks.get("ب")).toBeUndefined();
  });

  it("gives with the bulb the first letter not found yet, for 30", () => {
    const g = game();
    expect(g.canHint).toBe(true);
    expect(g.hint()).toBe(true);
    expect(g.entry).toEqual(["م", undefined, undefined, undefined]);
    expect(g.hinted).toEqual([0]);
    for (const letter of "قام") g.type(letter);
    g.submit();
    expect(g.tries).toEqual([[..."مقام"]]);
    expect(g.entry).toEqual(["م", undefined, undefined, undefined]); // the given letter is there for the next row too
    g.erase();
    expect(g.entry).toEqual(["م", undefined, undefined, undefined]); // and can't be erased
    for (const letter of "رام") g.type(letter);
    g.submit();
    expect([g.outcome, g.points]).toEqual(["solved", 70 - 30]);
  });

  it("skips letters already green and runs out", () => {
    const g = game();
    play(g, "مقام"); // positions 0, 2, 3 are green
    expect(g.hint()).toBe(true);
    expect(g.hinted).toEqual([1]);
    expect(g.hint()).toBe(false);
    expect(g.canHint).toBe(false);
    expect(g.hinted).toEqual([1]);
  });

  it("restores from a record", () => {
    const first = game();
    play(first, "مقام");
    first.hint();
    const restored = game("مرام", first.record);
    expect(restored.record).toEqual(first.record);
    expect(restored.entry).toEqual(first.entry);
    expect(restored.record).toEqual({ tries: ["مقام"], hinted: [1], outcome: "playing", points: 0 });
    for (const letter of "مام") restored.type(letter);
    expect(restored.entry).toEqual([..."مرام"]);
    restored.submit();
    expect(restored.record).toMatchObject({ outcome: "solved", points: 40 });
  });
});

describe("DailySession", () => {
  const day = TehranDay.fromKey("2026-11-23")!;
  const puzzle = pickPuzzle(day, new GameDeck([couplet(1, { m2: "کنار آب رکن آباد و گلگشت مصلا را" })]))!;

  it("keeps every try at once, so a new session finds the same state", () => {
    const storage = memoryStorage();
    const stats = new GameStats(storage, () => tehran("2026-11-23T10:00:00Z"));
    const session = new DailySession(puzzle, day, stats);
    for (const letter of puzzle.letters) session.type(letter);
    session.submit();
    expect(session.isOver).toBe(true);
    expect(stats.points).toBe(100);
    const again = new DailySession(puzzle, day, new GameStats(storage, () => tehran("2026-11-23T10:00:00Z")));
    expect(again.isOver).toBe(true);
    expect(again.game.record).toEqual(session.game.record);
  });

  it("keeps a hint too", () => {
    const stats = new GameStats(memoryStorage(), () => tehran("2026-11-23T10:00:00Z"));
    const session = new DailySession(puzzle, day, stats);
    session.hint();
    expect(stats.daily(day)?.hinted).toEqual([0]);
  });
});

describe("DailyPuzzle", () => {
  const poetNames = new Map(bundledFile<{ poets: { slug: string; name: string }[] }>("poets").poets.map((poet) => [poet.slug, poet.name]));
  const deck = parseDeck(bundledFile("games"), (slug) => poetNames.get(slug));
  const puzzleOf = (number: number) => pickPuzzle(new TehranDay(number), deck)!;

  it("loads the bundled deck", () => {
    expect(deck.couplets.length).toBeGreaterThan(1000);
    expect(deck.couplets.every((c) => c.poem.startsWith(`/${c.poetSlug}/`) && c.bookTitle !== "")).toBe(true);
    expect(deck.couplets.some((c) => c.meaningIsAI) && deck.couplets.some((c) => !c.meaningIsAI)).toBe(true);
  });

  it("gives the same puzzle for the same day and other days usually differ", () => {
    const day = TehranDay.fromKey("2026-11-23")!;
    expect(pickPuzzle(day, deck)).toEqual(pickPuzzle(day, deck));
    const week = Array.from({ length: 7 }, (_, index) => puzzleOf(day.number + index).couplet.poem + puzzleOf(day.number + index).couplet.index);
    expect(new Set(week).size).toBe(7);
  });

  it("is the puzzle the phone gives for the same day", () => {
    // Worked out with the Swift code (SeededGenerator and DailyPuzzle.pick) on the same games.json.
    const phone: [number, string, number, string, number, string][] = [
      [20_000, "/ferdousi/shahname/fereydoon/sh10", 3, "پیش", 4, "ژفشپتجبظطزکی"],
      [20_001, "/rahi/ghazalha1/sh12", 2, "آشنای", 5, "اشوضآتیجسنظف"],
      [20_414, "/eraghi/divane/ghazale/sh288", 2, "اینک", 4, "نگاهژزفیئکذش"],
      [5, "/khayyam/robaee/sh112", 1, "مغز", 0, "پغسئاخآمیژزه"],
    ];
    for (const [number, poem, index, word, wordIndex, keys] of phone) {
      const puzzle = puzzleOf(number);
      expect([puzzle.couplet.poem, puzzle.couplet.index, puzzle.word, puzzle.wordIndex, puzzle.keys.join("")]).toEqual([poem, index, word, wordIndex, keys]);
    }
  });

  it("hides a word of 3 to 6 letters that is not a stop word, from the second hemistich", () => {
    for (let number = 20_000; number < 20_200; number++) {
      const puzzle = puzzleOf(number);
      expect(puzzle.letters.length).toBeGreaterThanOrEqual(letterRange.min);
      expect(puzzle.letters.length).toBeLessThanOrEqual(letterRange.max);
      expect(stopWords.has(puzzle.letters.join(""))).toBe(false);
      expect(hemistichOf(puzzle)).toContain(puzzle.word);
      expect(puzzle.inSecondHemistich).toBe(true);
    }
  });

  it("puts the word at its index among the words of its hemistich", () => {
    const fitted = couplet(1, { m2: "کنار آب رکن آباد و گلگشت مصلا را" });
    const puzzle = pickPuzzle(new TehranDay(5), new GameDeck([fitted]))!;
    expect(wordsOf(fitted.m2)[puzzle.wordIndex]).toBe(puzzle.word);
    expect(puzzle.couplet).toEqual(fitted);
  });

  it("uses the first hemistich only when the second has no fitting word", () => {
    const fitted = couplet(1, { m1: "کنار آب رکن آباد و", m2: "که از در تا به او" });
    const puzzle = pickPuzzle(new TehranDay(5), new GameDeck([fitted]))!;
    expect(puzzle.inSecondHemistich).toBe(false);
    expect(fitted.m1).toContain(puzzle.word);
  });

  it("gives no puzzle when no word fits", () => {
    expect(pickPuzzle(new TehranDay(5), new GameDeck([couplet(1, { m1: "که از در تا به او", m2: "این آن هم هر که" })]))).toBeUndefined();
    expect(pickPuzzle(new TehranDay(5), new GameDeck([]))).toBeUndefined();
  });

  it("tests stop words as letters", () => {
    expect(candidates("که این اگر همه")).toEqual([]);
    expect(candidates("آن اینَک عشق").map((c) => c.word)).toEqual(["اینَک", "عشق"]);
    expect(candidates("بسیار دل می\u200Cرود").map((c) => c.word)).toEqual(["بسیار"]); // 5 letters; «دل» too short; half-space words skipped
    expect(candidates("عاشقانه")).toEqual([]); // 7 letters
  });

  it("has a keyboard of the word's letters and distractors, the same all day", () => {
    for (let number = 20_000; number < 20_100; number++) {
      const puzzle = puzzleOf(number);
      expect(puzzle.keys).toHaveLength(keyCount);
      expect(new Set(puzzle.keys).size).toBe(puzzle.keys.length);
      expect(puzzle.letters.every((letter) => puzzle.keys.includes(letter))).toBe(true);
      expect(puzzle.keys.every((key) => alphabet.includes(key))).toBe(true);
    }
    expect(puzzleOf(20_001).keys).toEqual(puzzleOf(20_001).keys);
  });

  it("makes the keys from the generator", () => {
    expect(keysFor([..."مرام"], new SeededGenerator(1n))).toEqual(keysFor([..."مرام"], new SeededGenerator(1n)));
  });
});
