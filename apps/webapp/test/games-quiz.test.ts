import { describe, expect, it } from "vitest";
import { GameDeck, parseDeck, type GameCouplet } from "../lib/games/couplet";
import { copula, subtitle } from "../lib/games/quizCopy";
import { bookQuestion, ending, poetQuestion, secondQuestion } from "../lib/games/quizMaker";
import { rightHemistich, verdict, type QuizQuestion } from "../lib/games/quizQuestion";
import { QuizRound, type QuizAnswer } from "../lib/games/quizRound";
import { bookRound, hasRound, poetRound, secondRound } from "../lib/games/quizRounds";
import { QuizSession } from "../lib/games/quizSession";
import * as scoring from "../lib/games/scoring";
import { SeededGenerator } from "../lib/games/seeded";
import { GameStats } from "../lib/games/stats";
import { Library } from "../lib/library/library";
import { normalize, plain } from "../lib/library/normalize";
import { book, couplets, deck, poets, question } from "./quizFixtures";
import { bundledFile } from "./files";
import { memoryStorage } from "./storage";

const generator = (seed: number) => new SeededGenerator(BigInt(seed));
const must = <T>(value: T | undefined): T => {
  expect(value).toBeDefined();
  return value!;
};

describe("poet questions", () => {
  const make = (couplet: GameCouplet, seed = 1, list = poets) => poetQuestion(couplet, list, generator(seed));

  it("has four different poets and the right one is among them", () => {
    const q = must(make(couplets("hafez", 1)[0]!));
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options.map((option) => option.id)).size).toBe(4);
    expect(new Set(q.options.map((option) => option.title)).size).toBe(4);
    expect(q.options[q.correct]).toEqual({ id: "hafez", title: "حافظ" });
  });

  it("is the same question for the same seed, and other seeds move the right answer", () => {
    const couplet = couplets("hafez", 1)[0]!;
    expect(make(couplet, 5)).toEqual(make(couplet, 5));
    expect(new Set(Array.from({ length: 30 }, (_, seed) => make(couplet, seed + 1)?.correct))).toEqual(new Set([0, 1, 2, 3]));
  });

  it("takes the distractors from the same century first", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(new Set(must(make(couplets("saadi", 1)[0]!, seed)).options.map((option) => option.id))).toEqual(new Set(["saadi", "moulavi", "eraghi", "khosro"]));
    }
  });

  it("fills the rest from other centuries when the century is too small", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const ids = must(make(couplets("attar", 1)[0]!, seed)).options.map((option) => option.id); // only nezami shares قرن ششم
      expect(ids).toContain("attar");
      expect(ids).toContain("nezami");
      expect(new Set(ids).size).toBe(4);
    }
  });

  it("gives a poet with no century random distractors", () => {
    const list = poets.map((poet, index) => (index === 0 ? { ...poet, century: undefined } : poet));
    const q = must(make(couplets("saadi", 1)[0]!, 1, list));
    expect(q.options).toHaveLength(4);
    expect(q.options[q.correct]!.id).toBe("saadi");
  });

  it("makes no question for a poet we cannot show", () => {
    expect(make(couplets("nobody", 1)[0]!)).toBeUndefined();
    expect(make(couplets("saadi", 1)[0]!, 1, poets.slice(0, 3))).toBeUndefined();
  });

  it("has the sheet name the poet", () => {
    const q = must(make(couplets("hafez", 1)[0]!));
    expect(verdict(q, true)).toBe("آره، حافظ!");
    expect(verdict(q, false)).toBe("نه، حافظ بود");
    expect(rightHemistich(q)).toBeUndefined(); // the title already names the poet
  });
});

describe("second hemistich questions", () => {
  const all = deck().couplets;
  const make = (couplet: GameCouplet, seed = 1, pool: readonly GameCouplet[] = all) => secondQuestion(couplet, pool, generator(seed));

  it("takes the last two letters of the normalised text as the ending", () => {
    expect(ending("که در آفرینش ز یک گوهرند")).toBe("ند");
    expect(ending("که در آفرینش ز یک گُوهَرَنْد")).toBe("ند");
    expect(ending("می‌کند،")).toBe("ند");
    expect(ending("ا")).toBe("ا");
  });

  it("has three second hemistichs of the same poet and the right one is among them", () => {
    const couplet = all[3]!;
    const q = must(make(couplet));
    expect(q.options).toHaveLength(3);
    expect(q.options[q.correct]!.title).toBe(plain(couplet.m2));
    q.options.forEach((option, index) => {
      if (index === q.correct) return;
      const source = must(all.find((item) => `${item.poem}#${item.index}` === option.id));
      expect(source.poetSlug).toBe(couplet.poetSlug);
      expect(option.id).not.toBe(`${couplet.poem}#${couplet.index}`);
    });
    expect(new Set(q.options.map((option) => option.title)).size).toBe(3);
  });

  it("puts the options with the same ending first", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(must(make(all[0]!, seed)).options.every((option) => ending(option.title) === "ند")).toBe(true); // the poet has four couplets with that ending
    }
  });

  it("fills in other endings when too few share the ending", () => {
    const pool = [...couplets("saadi", 4), ...couplets("hafez", 6)]; // endings ند ار ان ید
    const q = must(make(pool[0]!, 1, pool));
    expect(q.options).toHaveLength(3);
    expect(q.options[q.correct]!.title.endsWith("ند")).toBe(true);
    for (const option of q.options) expect(pool.some((item) => `${item.poem}#${item.index}` === option.id && (item.poetSlug === "saadi" || option.id === `${pool[0]!.poem}#${pool[0]!.index}`))).toBe(true);
  });

  it("does not use a duplicate hemistich twice", () => {
    const pool = couplets("saadi", 3);
    pool.push({ ...pool[0]!, poem: "/saadi/x", index: 0, m1: "الف", m2: plain(pool[0]!.m2) });
    const q = must(make(pool[0]!, 1, pool));
    expect(new Set(q.options.map((option) => normalize(option.title))).size).toBe(3);
    expect(make(pool[0]!, 1, [pool[0]!, pool[3]!])).toBeUndefined(); // a copy of the right one is no other option
  });

  it("makes no question for a poet with too few couplets", () => {
    expect(make(all[0]!, 1, couplets("saadi", 2))).toBeUndefined();
  });

  it("is the same question for the same seed, with the options in random order", () => {
    expect(make(all[0]!, 7)).toEqual(make(all[0]!, 7));
    expect(new Set(Array.from({ length: 30 }, (_, seed) => make(all[0]!, seed + 1)?.correct))).toEqual(new Set([0, 1, 2]));
  });

  it("has the sheet say it is the one and write the right one out", () => {
    const q = must(make(all[0]!));
    expect(verdict(q, true)).toBe("آره، همینه!");
    expect(verdict(q, false)).toBe("نه، این بود");
    expect(rightHemistich(q)).toBe(q.options[q.correct]!.title);
  });
});

describe("book questions", () => {
  const books = [
    book("/moulavi/masnavi", "moulavi"),
    book("/moulavi/shams", "moulavi"),
    book("/moulavi/fhmfh", "moulavi"),
    book("/moulavi/other", "moulavi"),
    book("/hafez", "hafez"),
    book("/khayyam/robaee", "khayyam"),
    book("/khayyam/tarane", "khayyam"),
  ];
  const make = (couplet: GameCouplet, seed = 1) => bookQuestion(couplet, books, generator(seed));
  const of = (poet: string, path: string) => couplets(poet, 1, path)[0]!;

  it("has three books of the poet and the right one is among them", () => {
    const q = must(make(of("moulavi", "/moulavi/masnavi")));
    expect(q.options).toHaveLength(3);
    expect(new Set(q.options.map((option) => option.id)).size).toBe(3);
    expect(q.options[q.correct]).toEqual({ id: "/moulavi/masnavi", title: "کتاب /moulavi/masnavi" });
    expect(q.options.every((option) => option.id.startsWith("/moulavi/"))).toBe(true);
  });

  it("gives a poet with two books two options", () => {
    expect(new Set(must(make(of("khayyam", "/khayyam/tarane"))).options.map((option) => option.id))).toEqual(new Set(["/khayyam/robaee", "/khayyam/tarane"]));
  });

  it("makes no question for a poet with one book or an unknown book", () => {
    expect(make(of("hafez", "/hafez"))).toBeUndefined();
    expect(make(of("moulavi", "/moulavi/unknown"))).toBeUndefined();
    expect(make(of("moulavi", ""))).toBeUndefined();
  });

  it("varies the other books with the seed and never repeats one", () => {
    const couplet = of("moulavi", "/moulavi/masnavi");
    expect(make(couplet, 3)).toEqual(make(couplet, 3));
    expect(new Set(Array.from({ length: 30 }, (_, seed) => make(couplet, seed + 1)!).flatMap((q) => q.options.map((option) => option.id))).size).toBe(4);
  });

  it("has the sheet name the book", () => {
    const q = must(make(of("moulavi", "/moulavi/masnavi")));
    expect(verdict(q, true)).toBe("آره، از کتاب /moulavi/masnavi بود!");
    expect(verdict(q, false)).toBe("نه، از کتاب /moulavi/masnavi بود");
  });
});

describe("making rounds", () => {
  const all = deck();

  it("has ten poet questions on ten different couplets", () => {
    const round = must(poetRound(all, poets, generator(1)));
    expect(round.kind).toBe("poet");
    expect(round.questions).toHaveLength(10);
    expect(new Set(round.questions.map((q) => `${q.couplet.poem}#${q.couplet.index}`)).size).toBe(10);
    expect(round.questions.every((q) => q.kind === "poet" && q.options.length === 4)).toBe(true);
  });

  it("is the same round for the same seed", () => {
    expect(secondRound(all, undefined, generator(4))).toEqual(secondRound(all, undefined, generator(4)));
  });

  it("makes a second hemistich round of one poet from that poet's couplets only", () => {
    const round = must(secondRound(all, "hafez", generator(2)));
    expect(round.questions).toHaveLength(10);
    expect(round.questions.every((q) => q.couplet.poetSlug === "hafez" && q.kind === "misra")).toBe(true);
    const hafez = new Set(all.couplets.filter((c) => c.poetSlug === "hafez").map((c) => `${c.poem}#${c.index}`));
    expect(round.questions.flatMap((q) => q.options).every((option) => hafez.has(option.id))).toBe(true);
  });

  it("gives a poet with few couplets a shorter round", () => {
    const small = new GameDeck([...couplets("hafez", 4), ...couplets("saadi", 30)]);
    expect(must(secondRound(small, "hafez", generator(2))).questions).toHaveLength(4);
    expect(secondRound(new GameDeck(couplets("hafez", 2)), "hafez", generator(2))).toBeUndefined();
    expect(secondRound(small, "nobody", generator(2))).toBeUndefined();
  });

  it("uses only poets with two or more books in a book round", () => {
    const books = [book("/saadi/a", "saadi"), book("/saadi/b", "saadi"), book("/hafez", "hafez")];
    const list = [...couplets("saadi", 8, "/saadi/a"), ...couplets("hafez", 8, "/hafez")];
    const round = must(bookRound(new GameDeck(list), books, generator(1)));
    expect(round.questions).toHaveLength(8);
    expect(round.questions.every((q) => q.couplet.poetSlug === "saadi")).toBe(true);
    expect(bookRound(new GameDeck(list.slice(-8)), books, generator(1))).toBeUndefined();
  });

  it("offers a poet's page a round only when the deck has at least three couplets of the poet", () => {
    const small = new GameDeck([...couplets("hafez", 3), ...couplets("saadi", 2)]);
    expect([hasRound(small, "hafez"), hasRound(small, "saadi"), hasRound(small, "nobody")]).toEqual([true, false, false]);
  });

  it("gives each game its clock", () => {
    expect(QuizRound.of("poet", [question()])!.clock).toEqual({ kind: "perQuestion", seconds: 12 });
    expect(QuizRound.of("book", [question("book")])!.clock).toEqual({ kind: "perQuestion", seconds: 12 });
    expect(QuizRound.of("misra", [question("misra")])!.clock).toEqual({ kind: "round", seconds: 120 });
    expect(QuizRound.of("listen", [question("listen")])!.clock).toEqual({ kind: "none" });
    expect(QuizRound.of("poet", [])).toBeUndefined();
  });
});

describe("the bundled data", () => {
  const library = new Library(bundledFile("library"));
  const names = new Map(library.poets.map((poet) => [poet.slug, poet.name]));
  const bundled = parseDeck(bundledFile("games"), (slug) => names.get(slug));

  it("makes a round of every quiz game", () => {
    expect(poetRound(bundled, library.poets, generator(1))?.questions).toHaveLength(10);
    expect(secondRound(bundled, undefined, generator(1))?.questions).toHaveLength(10);
    expect(bookRound(bundled, library.books, generator(1))?.questions).toHaveLength(10);
  });

  it("gives every poet of the deck a short or full round of their own", () => {
    for (const slug of new Set(bundled.couplets.map((c) => c.poetSlug))) {
      if (!hasRound(bundled, slug)) continue;
      expect(must(secondRound(bundled, slug, generator(2))).questions.every((q) => q.couplet.poetSlug === slug)).toBe(true);
    }
  });

  it("knows the book of every deck couplet in the library", () => {
    for (const couplet of bundled.couplets) {
      const found = must(library.bookAt(couplet.bookPath));
      expect(found.title).toBe(couplet.bookTitle);
    }
  });
});

describe("quiz scoring", () => {
  it("gives 20 and 2 for each second left for a right answer", () => {
    expect([12, 5, 0, -3].map((left) => scoring.quiz(left, 0))).toEqual([44, 30, 20, 20]);
  });

  it("charges 20 for each hint but never goes below zero", () => {
    expect([scoring.quiz(5, 1), scoring.quiz(0, 1), scoring.quiz(0, 2)]).toEqual([10, 0, 0]);
  });

  it("gives 10 for a pair of معنی‌یاب", () => {
    expect(scoring.matchPair).toBe(10);
  });
});

describe("QuizRound", () => {
  const roundOf = (kind: QuizQuestion["kind"] = "poet", count = 10, options = 4) =>
    QuizRound.of(kind, Array.from({ length: count }, (_, index) => question(kind, { correct: index % options, options })))!;

  /** Picks the right option (or a wrong one) and confirms, after `seconds` of the clock. */
  function answer(round: QuizRound, right = true, seconds = 0): QuizAnswer | undefined {
    for (let i = 0; i < seconds; i++) round.tick();
    const correct = round.current.correct;
    round.select(right ? correct : (correct + 1) % round.current.options.length);
    return round.confirm();
  }

  it("answers nothing until an option is chosen and confirmed", () => {
    const round = roundOf();
    expect(round.confirm()).toBeUndefined();
    expect(round.answers).toEqual([]);
    round.select(2);
    expect(round.selected).toBe(2);
    expect(round.sheetOpen).toBe(false);
    round.select(2);
    expect(round.selected).toBeUndefined(); // tapping the chosen option again lets it go
    round.select(9);
    expect(round.selected).toBeUndefined(); // an option that does not exist is ignored
  });

  it("earns 20 and 2 for each second left for a right answer", () => {
    const round = roundOf();
    const given = answer(round, true, 7);
    expect(given).toEqual({ chosen: round.questions[0]!.correct, right: true, points: 30, seconds: 7 });
    expect([round.points, round.rightCount, round.sheetOpen, round.lastAnswer]).toEqual([30, 1, true, given]);
  });

  it("earns nothing for a wrong answer", () => {
    const round = roundOf();
    const given = must(answer(round, false, 3));
    expect([given.right, given.points, round.points]).toEqual([false, 0, 0]);
  });

  it("stops the clock while the sheet is open and starts the next question fresh", () => {
    const round = roundOf();
    answer(round, true, 2);
    round.tick();
    round.tick();
    expect(round.secondsOnCurrent).toBe(2);
    round.next();
    expect([round.index, round.selected, round.secondsOnCurrent, round.sheetOpen, round.timeLeft]).toEqual([1, undefined, 0, false, 12]);
  });

  it("counts a per-question clock down and makes a timeout a wrong answer", () => {
    const round = roundOf();
    for (let i = 0; i < 11; i++) round.tick();
    expect([round.timeLeft, round.sheetOpen]).toEqual([1, false]);
    round.select(0);
    round.tick();
    expect(round.sheetOpen).toBe(true);
    expect(round.lastAnswer).toEqual({ right: false, points: 0, seconds: 12 });
    round.tick();
    expect(round.secondsOnCurrent).toBe(12); // the clock waits for the next question
  });

  it("ends the round after the last answer, the sheet still there", () => {
    const round = roundOf("poet", 2);
    answer(round);
    round.next();
    expect(round.isFinished).toBe(false);
    answer(round, false);
    expect([round.isFinished, round.isOver, round.sheetOpen]).toEqual([true, true, true]);
    round.next();
    expect(round.index).toBe(1); // nothing after the last one
  });

  it("runs the second hemistich clock for the whole round and ends it", () => {
    const round = roundOf("misra", 10, 3);
    expect(round.timeLeft).toBe(120);
    for (let i = 0; i < 5; i++) round.tick();
    answer(round, true, 2);
    expect(round.timeLeft).toBe(113);
    round.next();
    for (let i = 0; i < 113; i++) round.tick();
    expect([round.timeLeft, round.isOver, round.isFinished, round.sheetOpen]).toEqual([0, true, false, false]);
    expect(round.answers).toHaveLength(1);
    round.select(0);
    expect(round.confirm()).toBeUndefined(); // nothing after the time is up
  });

  it("gives the second hemistich bonus as 2 for each second of 12 for the question", () => {
    const round = roundOf("misra", 10, 3);
    expect(must(answer(round, true, 4)).points).toBe(20 + 2 * 8);
    round.next();
    expect(must(answer(round, true, 30)).points).toBe(20);
  });

  it("gives گوش کن no clock and always 20", () => {
    const round = roundOf("listen", 5, 3);
    expect(round.timeLeft).toBeUndefined();
    for (let i = 0; i < 50; i++) round.tick();
    const given = must(answer(round));
    expect([given.points, given.seconds, round.timeLeft]).toEqual([20, 0, undefined]);
  });

  it("takes away half the wrong options once with ۵۰:۵۰, for 20", () => {
    const round = roundOf("poet");
    const random = generator(1);
    expect(round.canFifty).toBe(true);
    round.fifty(random);
    expect(round.removed.size).toBe(2);
    expect(round.removed.has(round.current.correct)).toBe(false);
    expect(round.canFifty).toBe(false);
    round.fifty(random);
    expect(round.removed.size).toBe(2);
    round.select([...round.removed][0]!);
    expect(round.selected).toBeUndefined(); // a removed option can't be chosen
    expect(round.hints).toBe(1);
    expect(must(answer(round, true, 4)).points).toBe(20 + 2 * 8 - 20);
  });

  it("removes one of three and drops a chosen option that went away", () => {
    const round = roundOf("misra", 10, 3);
    const wrong = (round.current.correct + 1) % 3;
    round.select(wrong);
    round.fifty(generator(2));
    expect(round.removed.size).toBe(1);
    expect(round.removed.has(round.current.correct)).toBe(false);
    expect(round.selected).toBe(round.removed.has(wrong) ? undefined : wrong);
  });

  it("uses ۵۰:۵۰ on one question only", () => {
    const round = roundOf("poet");
    round.fifty(generator(1));
    answer(round);
    expect(round.canFifty).toBe(false); // not while the sheet is open
    round.next();
    expect([round.removed.size, round.canFifty, round.hints]).toEqual([0, true, 0]);
  });

  it("lets گوش کن show one word for 20 instead of ۵۰:۵۰", () => {
    const round = roundOf("listen", 5, 3);
    expect([round.canFifty, round.canShowWord]).toEqual([false, true]);
    round.showWord();
    expect([round.wordShown, round.canShowWord, round.hints]).toEqual([true, false, 1]);
    expect(must(answer(round)).points).toBe(0); // 20 for the answer, 20 for the word
    round.next();
    expect([round.wordShown, round.canShowWord]).toEqual([false, true]);
  });

  it("has no word hint in the other games", () => {
    expect(roundOf("poet").canShowWord).toBe(false);
  });

  it("allows one replay for each گوش کن question", () => {
    const round = roundOf("listen", 5, 3);
    expect(round.replaysLeft).toBe(1);
    expect(round.useReplay()).toBe(true);
    expect(round.useReplay()).toBe(false);
    expect(round.replaysLeft).toBe(0);
    answer(round);
    round.next();
    expect(round.replaysLeft).toBe(1);
  });

  it("shows the dots as right or wrong in order", () => {
    const round = roundOf("poet", 3);
    answer(round);
    round.next();
    answer(round, false);
    round.next();
    expect(round.results).toEqual([true, false]);
  });

  it("lets «رد کن» earn nothing, answer nothing and move on", () => {
    const round = roundOf("poet", 3);
    round.tick();
    round.select(1);
    expect(round.canSkip).toBe(true);
    round.skip();
    expect([round.points, round.answers.length, round.lastAnswer]).toEqual([0, 0, undefined]);
    expect([round.sheetOpen, round.index, round.selected, round.secondsOnCurrent, round.isFinished]).toEqual([false, 1, undefined, 0, false]);
    expect(round.results).toEqual([null]);
    answer(round);
    round.next();
    expect(round.results).toEqual([null, true]);
    expect([round.rightCount, round.answers.length]).toEqual([1, 1]);
  });

  it("ends the round when the last question is skipped", () => {
    const round = roundOf("poet", 2);
    round.skip();
    round.skip();
    expect([round.isFinished, round.isOver, round.sheetOpen, round.index, round.canSkip]).toEqual([true, true, false, 1, false]);
    round.skip();
    expect(round.results).toEqual([null, null]); // nothing after the end
  });

  it("skips in every quiz but the book game, and not while the sheet is open", () => {
    expect([roundOf("poet").canSkip, roundOf("misra", 10, 3).canSkip, roundOf("listen", 5, 3).canSkip]).toEqual([true, true, true]);
    expect(roundOf("book", 10, 3).canSkip).toBe(false);
    const open = roundOf("poet");
    answer(open);
    expect(open.canSkip).toBe(false);
    open.skip();
    expect([open.index, open.sheetOpen]).toEqual([0, true]);
  });

  it("keeps the round clock of the second hemistich running when a question is skipped", () => {
    const round = roundOf("misra", 10, 3);
    for (let i = 0; i < 7; i++) round.tick();
    round.skip();
    expect([round.timeLeft, round.secondsOnCurrent]).toEqual([113, 0]);
  });

  it("has no ۵۰:۵۰ in the book game", () => {
    const round = roundOf("book", 10, 3);
    round.fifty(generator(1));
    expect([round.canFifty, round.removed.size, round.hints]).toEqual([false, 0, 0]);
    expect([roundOf("poet").canFifty, roundOf("misra", 10, 3).canFifty]).toEqual([true, true]);
  });
});

describe("QuizSession", () => {
  const sessionOf = (kind: QuizQuestion["kind"] = "poet", count = 3, options = 4) => {
    const stats = new GameStats(memoryStorage());
    const round = QuizRound.of(kind, Array.from({ length: count }, (_, index) => question(kind, { correct: index % options, options })))!;
    return { session: new QuizSession(round, stats), stats };
  };

  function answer(session: QuizSession, right = true) {
    const correct = session.round.current.correct;
    session.select(right ? correct : (correct + 1) % session.round.current.options.length);
    session.confirm();
  }

  it("adds points as they come and keeps a best when the round ends", () => {
    const { session, stats } = sessionOf();
    for (let i = 0; i < 3; i++) session.tick();
    answer(session);
    expect([stats.points, session.finished]).toEqual([20 + 2 * 9, false]);
    session.next();
    answer(session, false);
    session.next();
    answer(session);
    expect(stats.points).toBe(38 + 44);
    session.next();
    expect(session.finished).toBe(true);
    expect(stats.best("poet")).toBe(session.round.points);
  });

  it("does not tick while paused", () => {
    const { session } = sessionOf();
    session.isPaused = true;
    session.tick();
    expect(session.round.secondsOnCurrent).toBe(0);
    session.isPaused = false;
    session.tick();
    expect(session.round.secondsOnCurrent).toBe(1);
  });

  it("does not tick while the question «از بازی بری بیرون؟» is open", () => {
    const { session } = sessionOf();
    session.isAsking = true;
    session.tick();
    expect(session.round.secondsOnCurrent).toBe(0);
  });

  it("ends the session once when the round clock runs out", () => {
    const { session, stats } = sessionOf("misra", 3, 3);
    answer(session);
    session.next();
    for (let i = 0; i < 130; i++) session.tick();
    expect(session.finished).toBe(true);
    expect(stats.best("misra")).toBe(20 + 2 * 12);
    const points = stats.points;
    session.next();
    expect(stats.points).toBe(points);
  });

  it("makes a timed-out question only a wrong answer", () => {
    const { session, stats } = sessionOf();
    for (let i = 0; i < 12; i++) session.tick();
    expect([session.round.sheetOpen, stats.points, session.finished]).toEqual([true, 0, false]);
  });

  it("ends the session and keeps the best when the last question is skipped", () => {
    const { session, stats } = sessionOf("poet", 2);
    answer(session);
    session.next();
    session.skip();
    expect([session.finished, stats.best("poet"), stats.points]).toEqual([true, session.round.points, session.round.points]);
  });

  it("only moves on when a question in the middle is skipped", () => {
    const { session, stats } = sessionOf("poet", 3);
    session.skip();
    expect([session.finished, session.round.index, stats.points]).toEqual([false, 1, 0]);
  });

  it("sends ۵۰:۵۰ and the word hint through the session", () => {
    const { session: poet } = sessionOf();
    poet.fifty();
    expect(poet.round.removed.size).toBe(2);
    const { session: listen } = sessionOf("listen", 5, 3);
    listen.showWord();
    expect(listen.round.wordShown).toBe(true);
  });

  it("asks before leaving once a timed round has started, and a listen round after its first answer", () => {
    expect(sessionOf().session.asksBeforeLeaving).toBe(true);
    const { session } = sessionOf("listen", 3, 3);
    expect(session.asksBeforeLeaving).toBe(false);
    answer(session);
    expect(session.asksBeforeLeaving).toBe(true);
  });

  it("shows the clock as «۰:۱۲», and none in گوش کن", () => {
    expect(sessionOf().session.timeText).toBe("۰:۱۲");
    expect(sessionOf("listen", 3, 3).session.timeText).toBeUndefined();
  });
});

describe("quiz copy", () => {
  it("says the spoken «است» after a name", () => {
    expect([copula("مولانا"), copula("حافظ"), copula("خیام"), copula("")]).toEqual(["ست", "ه", "ه", ""]);
  });

  it("has the line under each title", () => {
    expect(subtitle("poet", "حافظ")).toBe("شاعرِ این بیت کیه؟");
    expect(subtitle("misra", "حافظ")).toBe("ادامه‌ی این بیت کدومه؟");
    expect(subtitle("book", "مولانا")).toBe("این بیت از کدوم کتابِ مولاناست؟");
    expect(subtitle("book", "حافظ")).toBe("این بیت از کدوم کتابِ حافظه؟");
    expect(subtitle("listen", "حافظ")).toBe("مصراع اول رو بشنو؛ دومی کدومه؟");
  });
});
