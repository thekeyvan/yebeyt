import { describe, expect, it } from "vitest";
import { slotAt } from "../lib/games/drop";
import { attemptWords, JigsawBoard, statusOf, type SlotMark } from "../lib/games/jigsawBoard";
import { deckStart, jigsawURL, openingCouplets, parseStart, type JigsawStart } from "../lib/games/jigsawStart";
import { canPlay, makeQuestion, missingCount, type JigsawQuestion } from "../lib/games/jigsawQuestion";
import { comboLength, JigsawRound } from "../lib/games/jigsawRound";
import { JigsawSession } from "../lib/games/jigsawSession";
import { SeededGenerator } from "../lib/games/seeded";
import { GameStats } from "../lib/games/stats";
import { celebrates, jigsawSummary } from "../lib/games/summary";
import { couplet, deck, tehran } from "./games";
import { memoryStorage } from "./storage";

const question = (c = couplet(1), distractors = ["جان", "جوهرند", "دیگر"], seed = 1n): JigsawQuestion => makeQuestion(c, distractors, new SeededGenerator(seed))!;

describe("JigsawQuestion", () => {
  it("lets half the words go missing, at least two and at most six", () => {
    expect([3, 4, 5, 6, 7, 10, 12, 14].map(missingCount)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });

  it("splits the second hemistich into words", () => {
    const q = question();
    expect(q.words).toEqual(["که", "در", "آفرینش", "ز", "یک", "گوهرند"]);
    expect(q.missing).toHaveLength(3);
    expect(q.missing).toEqual([...q.missing].sort((a, b) => a - b));
    expect(q.missing.every((position) => position >= 0 && position < q.words.length)).toBe(true);
  });

  it("puts the missing words and two others on the sheet", () => {
    const q = question();
    const missingWords = q.missing.map((position) => q.words[position]!);
    expect(q.stickers).toHaveLength(5);
    expect(new Set(q.stickers.map((sticker) => sticker.id)).size).toBe(5);
    expect(q.stickers.map((sticker) => sticker.word).sort()).toEqual([...missingWords, "جان", "جوهرند"].sort());
  });

  it("never lends a word of the couplet as an extra, diacritics ignored", () => {
    const q = question(couplet(1), ["گُوهَرند", "که", "آفرینش", "زیبا", "زیبا", "دیگر"]);
    expect(q.stickers.map((sticker) => sticker.word).filter((word) => !q.words.includes(word)).sort()).toEqual(["دیگر", "زیبا"].sort());
  });

  it("is the same for the same seed", () => {
    expect(question(couplet(1), undefined, 9n)).toEqual(question(couplet(1), undefined, 9n));
  });

  it("has fewer extras when the pool is small", () => {
    expect(question(couplet(1), ["دیگر"]).stickers).toHaveLength(4);
  });

  it("refuses couplets that cannot be played", () => {
    const generator = new SeededGenerator(1n);
    expect(makeQuestion(couplet(1, { m2: "" }), [], generator)).toBeUndefined();
    expect(makeQuestion(couplet(1, { m2: "یک دو" }), [], generator)).toBeUndefined();
    expect(makeQuestion(couplet(1, { m1: " " }), [], generator)).toBeUndefined();
    expect(makeQuestion(couplet(1, { m2: Array(15).fill("ک").join(" ") }), [], generator)).toBeUndefined();
    expect(canPlay(couplet(1))).toBe(true);
  });
});

describe("JigsawBoard", () => {
  const board = (seed = 1n) => new JigsawBoard(question(couplet(1), ["جان", "جوهرند"], seed));
  const stickerOf = (b: JigsawBoard, word: string) => b.question.stickers.find((sticker) => sticker.word === word)!;
  const extraOf = (b: JigsawBoard) => b.question.stickers.find((sticker) => !b.question.words.includes(sticker.word))!;
  /** Puts the right sticker in every empty slot. */
  const solve = (b: JigsawBoard) => {
    for (const position of b.question.missing) b.place(stickerOf(b, b.question.words[position]!), position);
  };

  it("starts with the given words in and the others empty", () => {
    const b = board();
    b.question.words.forEach((word, position) => expect(b.word(position)).toBe(b.question.missing.includes(position) ? undefined : word));
    expect(b.isFull).toBe(false);
    expect(b.onSheet).toHaveLength(5);
  });

  it("places a tapped sticker in the tapped slot", () => {
    const b = board();
    const position = b.question.missing[0]!;
    const word = b.question.words[position]!;
    const sticker = stickerOf(b, word);
    b.select(sticker);
    expect(b.selected).toEqual(sticker);
    b.tapSlot(position);
    expect(b.word(position)).toBe(word);
    expect(b.selected).toBeUndefined();
    expect(b.onSheet).not.toContainEqual(sticker);
  });

  it("puts down the sticker in hand when it is tapped again", () => {
    const b = board();
    b.select(b.question.stickers[0]!);
    b.select(b.question.stickers[0]!);
    expect(b.selected).toBeUndefined();
  });

  it("takes a sticker back to the sheet when a filled slot is tapped with nothing in hand", () => {
    const b = board();
    const position = b.question.missing[0]!;
    b.place(b.question.stickers[0]!, position);
    b.tapSlot(position);
    expect(b.word(position)).toBeUndefined();
    expect(b.onSheet).toHaveLength(5);
  });

  it("sends the old sticker back when another is placed, and a moved sticker leaves its old slot", () => {
    const b = board();
    const [a, c] = [b.question.missing[0]!, b.question.missing[1]!];
    const [first, second] = [b.question.stickers[0]!, b.question.stickers[1]!];
    b.place(first, a);
    b.place(second, a);
    expect(b.placed.get(a)).toEqual(second);
    expect(b.onSheet).toContainEqual(first);
    b.place(second, c);
    expect(b.placed.has(a)).toBe(false);
    expect(b.placed.get(c)).toEqual(second);
  });

  it("does not replace the given words", () => {
    const b = board();
    const given = b.question.words.findIndex((_, position) => !b.question.missing.includes(position));
    b.place(b.question.stickers[0]!, given);
    expect(b.placed.has(given)).toBe(false);
  });

  it("only reorders the sheet when shuffled", () => {
    const b = board();
    b.shuffle(new SeededGenerator(3n));
    expect(b.onSheet.map((sticker) => sticker.id).sort()).toEqual(b.question.stickers.map((sticker) => sticker.id).sort());
  });

  it("is right with the right word in every slot, 20 each", () => {
    const b = board();
    solve(b);
    expect(b.isFull).toBe(true);
    expect(b.check()).toEqual({ correctWords: 3, hints: 0, isRight: true, points: 60 });
  });

  it("is wrong with one wrong word, but the right ones still earn", () => {
    const b = board();
    solve(b);
    b.place(extraOf(b), b.question.missing[0]!);
    expect(b.check()).toEqual({ correctWords: 2, hints: 0, isRight: false, points: 40 });
  });

  it("marks each slot of a checked couplet given, hinted, right or wrong", () => {
    const b = board();
    b.hint();
    const hinted = [...b.hinted][0]!;
    const wrong = b.question.missing.find((position) => position !== hinted)!;
    for (const position of b.question.missing) if (position !== hinted && position !== wrong) b.place(stickerOf(b, b.question.words[position]!), position);
    b.place(extraOf(b), wrong);
    b.question.words.forEach((_, position) => {
      const expected: SlotMark = position === hinted ? "hinted" : position === wrong ? "wrong" : b.question.missing.includes(position) ? "right" : "given";
      expect(b.mark(position)).toBe(expected);
    });
  });

  it("shows in a wrong slot what was placed, not the right word", () => {
    const b = board();
    solve(b);
    const wrong = b.question.missing[0]!;
    b.place(extraOf(b), wrong);
    expect(b.mark(wrong)).toBe("wrong");
    expect(b.word(wrong)).toBe(extraOf(b).word);
    expect(b.question.missing.slice(1).every((position) => b.mark(position) === "right")).toBe(true);
    expect(b.check().isRight).toBe(false);
  });

  it("gives the sheet every word as placed with its mark", () => {
    const b = board();
    solve(b);
    const wrong = b.question.missing[0]!;
    b.place(extraOf(b), wrong);
    const words = attemptWords(b);
    expect(words).toHaveLength(b.question.words.length);
    expect(words[wrong]).toEqual({ word: extraOf(b).word, mark: "wrong" });
    expect(statusOf(words[wrong]!.mark)).toBe("wrong");
    words.forEach((item, position) => {
      if (position === wrong) return;
      expect(item.word).toBe(b.question.words[position]);
      expect(statusOf(item.mark)).toBe("correct");
    });
  });

  it("counts a sticker with the same word as the right one as right", () => {
    const repeated = new JigsawBoard(makeQuestion(couplet(1, { m2: "که در که آفرینش ز یک" }), [], new SeededGenerator(4n))!);
    for (const position of repeated.question.missing) {
      const word = repeated.question.words[position];
      repeated.place(repeated.onSheet.find((sticker) => sticker.word === word)!, position);
    }
    expect(repeated.question.missing.every((position) => repeated.mark(position) === "right")).toBe(true);
    expect(repeated.check().isRight).toBe(true);
  });

  it("makes both slots wrong when two different words are swapped", () => {
    const b = board();
    const [a, c] = [b.question.missing[0]!, b.question.missing[1]!];
    expect(b.question.words[a]).not.toBe(b.question.words[c]);
    for (const position of b.question.missing) if (position !== a && position !== c) b.place(stickerOf(b, b.question.words[position]!), position);
    b.place(stickerOf(b, b.question.words[c]!), a);
    b.place(stickerOf(b, b.question.words[a]!), c);
    expect([b.mark(a), b.mark(c)]).toEqual(["wrong", "wrong"]);
    expect(b.check()).toEqual({ correctWords: 1, hints: 0, isRight: false, points: 20 });
  });

  it("places a word with the bulb, which costs 20 and earns nothing for that word", () => {
    const b = board();
    expect(b.canHint).toBe(true);
    expect(b.hint()).toBe(true);
    const position = [...b.hinted][0]!;
    expect(b.word(position)).toBe(b.question.words[position]);
    b.place(b.question.stickers[0]!, position);
    expect(b.word(position)).toBe(b.question.words[position]); // a hinted slot stays
    b.remove(position);
    expect(b.word(position)).toBe(b.question.words[position]);
    solve(b);
    expect(b.check()).toEqual({ correctWords: 2, hints: 1, isRight: true, points: 20 });
  });

  it("replaces a wrong sticker with the bulb and runs out", () => {
    const b = board();
    const position = b.question.missing[0]!;
    const extra = extraOf(b);
    b.place(extra, position);
    b.hint();
    expect(b.word(position)).toBe(b.question.words[position]);
    expect(b.onSheet).toContainEqual(extra);
    while (b.hint());
    expect([b.canHint, b.isFull, b.check().isRight, b.check().points]).toEqual([false, true, true, 0]);
  });
});

describe("JigsawRound", () => {
  const round = (seed = 1n) => JigsawRound.make([], deck(60), new SeededGenerator(seed))!;
  const answer = (r: JigsawRound, right = true) => {
    r.edit((board) => {
      for (const position of board.question.missing) {
        const word = board.question.words[position];
        board.place(board.onSheet.find((sticker) => (sticker.word === word) === right)!, position);
      }
    });
    r.check();
  };

  it("has ten different couplets of the deck, two minutes and no points", () => {
    const r = round();
    expect(r.questions).toHaveLength(10);
    expect(new Set(r.questions.map((q) => q.couplet.poem)).size).toBe(10);
    expect([r.timeLeft, r.points, r.index]).toEqual([120, 0, 0]);
  });

  it("is the same round for the same seed", () => {
    expect(round(5n).questions).toEqual(round(5n).questions);
    expect(round(5n).questions).not.toEqual(round(6n).questions);
  });

  it("starts with the opening couplets, skipping the unplayable, and the deck fills up", () => {
    const mine = [couplet(900), couplet(901, { m2: "" }), couplet(902)];
    const r = JigsawRound.make(mine, deck(60), new SeededGenerator(2n))!;
    expect(r.questions).toHaveLength(10);
    expect(r.questions.slice(0, 2).map((q) => q.couplet.poem)).toEqual([mine[0]!.poem, mine[2]!.poem]);
  });

  it("opens with ten of a poem of more than ten couplets", () => {
    const poem = Array.from({ length: 14 }, (_, index) => couplet(800 + index));
    const r = JigsawRound.make(poem, deck(60), new SeededGenerator(2n))!;
    expect(r.questions.map((q) => q.couplet.poem)).toEqual(poem.slice(0, 10).map((c) => c.poem));
  });

  it("is shorter from a small deck and none from an empty one", () => {
    expect(JigsawRound.make([], deck(4), new SeededGenerator(2n))!.questions).toHaveLength(4);
    expect(JigsawRound.make([], deck(0), new SeededGenerator(2n))).toBeUndefined();
  });

  it("wants every slot filled to check", () => {
    const r = round();
    expect(r.check()).toBeUndefined();
    expect(r.answers).toHaveLength(0);
    answer(r);
    expect(r.answers).toHaveLength(1);
    expect(r.sheetOpen).toBe(true);
  });

  it("runs the clock while answering and stops it while the sheet is open", () => {
    const r = round();
    r.tick();
    r.tick();
    r.tick();
    expect([r.timeLeft, r.secondsOnCurrent]).toEqual([117, 3]);
    answer(r);
    expect(r.lastAnswer?.seconds).toBe(3);
    r.tick();
    expect(r.timeLeft).toBe(117);
    r.next();
    expect([r.index, r.secondsOnCurrent, r.sheetOpen]).toEqual([1, 0, false]);
    r.tick();
    expect(r.timeLeft).toBe(116);
  });

  it("cannot change the board while the sheet is open", () => {
    const r = round();
    answer(r);
    r.edit((board) => board.remove(board.question.missing[0]!));
    expect(r.board.placed.size).toBe(r.board.question.missing.length);
  });

  it("shows the combo after three right in a row, and a wrong one ends it", () => {
    const r = round();
    for (let i = 0; i < 2; i++) {
      answer(r);
      r.next();
    }
    expect(r.combo).toBe(2);
    answer(r);
    expect(r.combo).toBe(comboLength);
    r.next();
    answer(r, false);
    expect([r.combo, r.rightCount]).toEqual([0, 3]);
  });

  it("counts a couplet with one wrong word as wrong but keeps the points of the right ones", () => {
    const r = round();
    for (let i = 0; i < 3; i++) {
      answer(r);
      r.next();
    }
    const before = r.points;
    r.edit((board) => {
      const extra = board.question.stickers.find((sticker) => !board.question.words.includes(sticker.word))!;
      board.question.missing.forEach((position, order) => {
        const word = board.question.words[position];
        board.place(order === 0 ? extra : board.onSheet.find((sticker) => sticker.word === word)!, position);
      });
    });
    const result = r.check()!.result;
    const missing = r.board.question.missing.length;
    expect([result.isRight, result.correctWords]).toEqual([false, missing - 1]);
    expect(r.points - before).toBe((missing - 1) * 20);
    expect([r.combo, r.rightCount]).toEqual([0, 3]);
    expect(r.answers.map((a) => a.result.isRight)).toEqual([true, true, true, false]);
    expect(r.board.mark(r.board.question.missing[0]!)).toBe("wrong");
  });

  it("is finished after ten answers, and the seconds left count", () => {
    const r = round();
    for (let i = 0; i < 10; i++) {
      r.tick();
      answer(r);
      if (!r.isFinished) r.next();
    }
    expect([r.isFinished, r.isOver, r.timeLeft, r.timeBonus]).toEqual([true, true, 110, 110]);
    expect([r.points, r.totalPoints, r.elapsed, r.rightCount]).toEqual([600, 710, 10, 10]);
    r.next();
    expect(r.index).toBe(9); // there is no eleventh couplet
  });

  it("is over without a bonus when the time runs out", () => {
    const r = round();
    answer(r);
    r.next();
    for (let i = 0; i < 120; i++) r.tick();
    expect([r.timeLeft, r.isOver, r.isFinished, r.timeBonus, r.totalPoints]).toEqual([0, true, false, 0, 60]);
    expect(r.check()).toBeUndefined();
    r.tick();
    expect(r.timeLeft).toBe(0);
  });
});

describe("JigsawSession", () => {
  const session = (stats: GameStats) => new JigsawSession(JigsawRound.make([], deck(60), new SeededGenerator(1n))!, stats, 3n);
  const stats = () => new GameStats(memoryStorage(), () => tehran("2026-11-23T10:00:00Z"));
  const fill = (s: JigsawSession) =>
    s.edit((board) => {
      for (const position of board.question.missing) {
        const word = board.question.words[position];
        board.place(board.onSheet.find((sticker) => sticker.word === word)!, position);
      }
    });

  it("adds points as couplets are answered and the seconds left at the end", () => {
    const kept = stats();
    const s = session(kept);
    for (let i = 0; i < 10; i++) {
      fill(s);
      s.check();
      expect(s.round.sheetOpen).toBe(true);
      s.next();
    }
    expect(s.finished).toBe(true);
    expect(kept.points).toBe(600 + 120);
    expect(kept.best("jigsaw")).toBe(720);
    s.next();
    expect(kept.points).toBe(720); // finishing twice adds nothing
  });

  it("ends the round once on a timeout and keeps what was earned", () => {
    const kept = stats();
    const s = session(kept);
    fill(s);
    s.check();
    s.next();
    for (let i = 0; i < 130; i++) s.tick();
    expect([s.finished, s.round.timeLeft, kept.points, kept.best("jigsaw")]).toEqual([true, 0, 60, 60]);
  });

  it("waits while the page is not in front and while the question is open", () => {
    const s = session(stats());
    s.tick();
    s.isPaused = true;
    for (let i = 0; i < 30; i++) s.tick();
    expect(s.round.timeLeft).toBe(119);
    s.isPaused = false;
    s.isAsking = true;
    s.tick();
    expect(s.round.timeLeft).toBe(119);
    s.isAsking = false;
    s.tick();
    expect(s.round.timeLeft).toBe(118);
  });

  it("reads the time like the board", () => {
    const s = session(stats());
    expect(s.timeText).toBe("۲:۰۰");
    for (let i = 0; i < 78; i++) s.tick();
    expect(s.timeText).toBe("۰:۴۲");
  });

  it("asks before leaving from the first second until the round is over", () => {
    const s = session(stats());
    expect(s.asksBeforeLeaving).toBe(true); // the clock runs from the first second
    for (let i = 0; i < 10; i++) {
      fill(s);
      s.check();
      s.next();
    }
    expect(s.asksBeforeLeaving).toBe(false);
  });

  it("tells a watcher after every change", () => {
    const s = session(stats());
    let told = 0;
    s.subscribe(() => told++);
    s.tick();
    s.shuffle();
    expect(told).toBe(2);
    expect(s.snapshot()).toBe(2);
  });
});

describe("where a sticker is let go", () => {
  const frame = (position: number, left: number) => ({ position, rect: { left, right: left + 46, top: 100, bottom: 146 } });
  const frames = [frame(3, 200), frame(4, 140), frame(6, 20)]; // in right-to-left the first slot is at the right

  it("is the slot whose frame holds the finger, in any order of the slots", () => {
    expect(slotAt({ x: 223, y: 123 }, frames)).toBe(3);
    expect(slotAt({ x: 163, y: 123 }, frames)).toBe(4);
    expect(slotAt({ x: 43, y: 123 }, frames)).toBe(6);
  });

  it("allows 8 px around the frame and no more", () => {
    expect(slotAt({ x: 200 - 8, y: 100 - 8 }, frames)).toBe(3);
    expect(slotAt({ x: 246 + 8, y: 146 + 8 }, frames)).toBe(3);
    expect(slotAt({ x: 200 - 9, y: 123 }, [frame(3, 200)])).toBeUndefined();
    expect(slotAt({ x: 223, y: 100 - 9 }, [frame(3, 200)])).toBeUndefined();
  });

  it("is nothing over nothing", () => {
    expect(slotAt({ x: 100, y: 300 }, frames)).toBeUndefined();
    expect(slotAt({ x: 100, y: 123 }, [])).toBeUndefined();
  });
});

describe("JigsawStart", () => {
  const poem = {
    id: 1,
    title: "غزل ۱",
    path: "/hafez/ghazal/sh1",
    couplets: [
      { m1: "الا یا ایها الساقی", m2: "ادر کأسا و ناولها", meaning: "ساقی جام را بگردان." },
      { m1: "که عشق آسان نمود اول", m2: "ولی افتاد مشکل‌ها", ai: true as const },
      { m1: "بیتی که مصراع دوم ندارد", m2: "" },
    ],
  };
  const hafez = { slug: "hafez", name: "حافظ" };

  it("is an address and back", () => {
    const starts: JigsawStart[] = [deckStart, { kind: "poem", poem: "/hafez/ghazal/sh1" }, { kind: "couplet", poem: "/hafez/ghazal/sh1", index: 2 }];
    expect(starts.map(jigsawURL)).toEqual(["/games/jigsaw", "/games/jigsaw?poem=%2Fhafez%2Fghazal%2Fsh1", "/games/jigsaw?poem=%2Fhafez%2Fghazal%2Fsh1&c=2"]);
    for (const start of starts) expect(parseStart(Object.fromEntries(new URL(jigsawURL(start), "http://x").searchParams))).toEqual(start);
  });

  it("is the deck for anything that is not a poem path, and the whole poem for a couplet that is not a number", () => {
    for (const poem of ["", "hafez", "/hafez/../x", "/a b", "//x", "/x?y"]) expect(parseStart({ poem, c: "1" }), poem).toEqual(deckStart);
    expect(parseStart({})).toEqual(deckStart);
    expect(parseStart({ c: "1" })).toEqual(deckStart);
    for (const c of ["", "-1", "x", "1.5", "123456"]) expect(parseStart({ poem: "/hafez/ghazal/sh1", c }), c).toEqual({ kind: "poem", poem: "/hafez/ghazal/sh1" });
    expect(parseStart({ poem: ["/hafez/ghazal/sh1", "/x"], c: ["0", "1"] })).toEqual({ kind: "couplet", poem: "/hafez/ghazal/sh1", index: 0 });
  });

  it("opens with the couplet asked for, from the poem, with its poet and book", () => {
    const [only, ...none] = openingCouplets({ kind: "couplet", poem: poem.path, index: 1 }, poem, hafez, "دیوان حافظ");
    expect(none).toEqual([]);
    expect(only).toEqual({ poem: poem.path, index: 1, m1: "که عشق آسان نمود اول", m2: "ولی افتاد مشکل‌ها", meaning: undefined, poetSlug: "hafez", poetName: "حافظ", bookTitle: "دیوان حافظ", meaningIsAI: true });
    expect(openingCouplets({ kind: "couplet", poem: poem.path, index: 0 }, poem, hafez, "")[0]!.meaning).toBe("ساقی جام را بگردان.");
  });

  it("opens with every couplet for a poem, none for the deck, and none for a couplet the poem does not have", () => {
    expect(openingCouplets({ kind: "poem", poem: poem.path }, poem, hafez, "").map((couplet) => couplet.index)).toEqual([0, 1, 2]);
    expect(openingCouplets(deckStart, poem, hafez, "")).toEqual([]);
    expect(openingCouplets({ kind: "couplet", poem: poem.path, index: 9 }, poem, hafez, "")).toEqual([]);
  });

  it("makes a round that starts with them, the playable ones, and the deck after", () => {
    const opening = openingCouplets({ kind: "poem", poem: poem.path }, poem, hafez, "");
    const round = JigsawRound.make(opening, deck(60), new SeededGenerator(2n))!;
    expect(round.questions).toHaveLength(10);
    expect(round.questions.slice(0, 2).map((question) => question.couplet.index)).toEqual([0, 1]); // the third has no second hemistich
    expect(round.questions[0]!.couplet.poetName).toBe("حافظ");
    expect(round.questions[2]!.couplet.poem).not.toBe(poem.path);
  });
});

describe("RoundSummary", () => {
  it("celebrates when at least half were right", () => {
    expect([5, 4, 10, 0].map((right) => celebrates({ right, total: 10 }))).toEqual([true, false, true, false]);
  });

  it("sums up a round: the points, the rows and the line", () => {
    const stats = new GameStats(memoryStorage(), () => tehran("2026-11-23T10:00:00Z"));
    const s = new JigsawSession(JigsawRound.make([], deck(60), new SeededGenerator(1n))!, stats, 3n);
    s.edit((board) => {
      for (const position of board.question.missing) board.place(board.onSheet.find((sticker) => sticker.word === board.question.words[position])!, position);
    });
    s.check();
    const summary = jigsawSummary(s.round);
    expect([summary.points, summary.right, summary.total, summary.title]).toEqual([60, 1, 10, "تموم شد!"]);
    expect(summary.subtitle).toBe("جورچین بیت · ۱۰ بیت سعدی · ۰:۰۰");
    expect(summary.rows.map((row) => row.result)).toEqual([true, ...Array(9).fill(null)]);
  });
});
