import { describe, expect, it } from "vitest";
import type { GameCouplet } from "../lib/games/couplet";
import { entryId, locate, parseGlossary, type GlossaryEntry } from "../lib/games/matchGlossary";
import { Library } from "../lib/library/library";
import { makeMatchRound } from "../lib/games/matchStart";
import { MatchRound, matchQuestion, type MatchQuestion } from "../lib/games/matchRound";
import { MatchSession } from "../lib/games/matchSession";
import { SeededGenerator } from "../lib/games/seeded";
import { GameStats } from "../lib/games/stats";
import { matchSummary } from "../lib/games/summary";
import type { PoetsFile } from "../lib/poetry/models";
import { bundledBook } from "../lib/poetry/bundled";
import { PoetryStore } from "../lib/poetry/store";
import { bundledFile } from "./files";
import { memoryStorage } from "./storage";

const generator = (seed: number) => new SeededGenerator(BigInt(seed));

const couplet: GameCouplet = {
  poem: "/hafez/ghazal/sh3",
  index: 1,
  m1: "بده ساقی مِیِ باقی که در جَنَّت نخواهی یافت",
  m2: "کنارِ آبِ رُکناباد و گُل‌گَشتِ مُصَلّا را",
  meaning: "معنی",
  poetSlug: "hafez",
  poetName: "حافظ",
  bookTitle: "دیوان حافظ",
  bookPath: "/hafez",
  meaningIsAI: false,
};

const entry: GlossaryEntry = {
  path: "/hafez/ghazal/sh3",
  couplet: 1,
  words: [
    { text: "ساقی", m: 1, gloss: "کسی که شراب می‌ریزه" },
    { text: "می باقی", m: 1, gloss: "شرابی که مونده" },
    { text: "جنت", m: 1, gloss: "بهشت" },
    { text: "گل‌گشت", m: 2, gloss: "گردشگاه" },
    { text: "مصلا", m: 2, gloss: "جای نماز" },
  ],
};

const questionOf = (seed = 1): MatchQuestion => matchQuestion(entry, couplet, generator(seed))!;

describe("locate", () => {
  it("finds a word ignoring diacritics, and two words make one range", () => {
    const found = locate(["ساقی", "می باقی", "جنت"], couplet.m1);
    expect(found.tokens).toEqual(["بده", "ساقی", "مِیِ", "باقی", "که", "در", "جَنَّت", "نخواهی", "یافت"]);
    expect(found.ranges).toEqual([[1, 2], [2, 4], [6, 7]]);
  });

  it("keeps a half-space inside a word as one token", () => {
    expect(locate(["گل‌گشت", "گلگشت", "مصلا"], couplet.m2).ranges).toEqual([[4, 5], undefined, [5, 6]]);
  });

  it("matches only whole words", () => {
    expect(locate(["ساق", "باقیی", "ی"], couplet.m1).ranges).toEqual([undefined, undefined, undefined]);
  });

  it("folds Arabic letters and punctuation", () => {
    expect(locate(["كاسا"], "ادر كأساً، و ناولها").ranges).toEqual([[1, 2]]);
  });

  it("matches nothing for an empty text", () => {
    expect(locate(["", " "], "یک دو").ranges).toEqual([undefined, undefined]);
  });
});

describe("MatchQuestion", () => {
  it("has the words in the order they are read", () => {
    const q = questionOf();
    expect(q.words.map((word) => word.text)).toEqual(["ساقی", "می باقی", "جنت", "گل‌گشت", "مصلا"]);
    expect(q.words.map((word) => word.id)).toEqual([0, 1, 2, 3, 4]);
    expect(q.words[0]!.gloss).toBe("کسی که شراب می‌ریزه");
  });

  it("is the couplet in two lines with the glossed words marked", () => {
    const { lines } = questionOf();
    expect(lines).toHaveLength(2);
    expect(lines[0]!.filter((token) => token.glossed).map((token) => token.text)).toEqual(["ساقی", "مِیِ", "باقی", "جَنَّت"]);
    expect(lines[1]!.filter((token) => token.glossed).map((token) => token.text)).toEqual(["گُل‌گَشتِ", "مُصَلّا"]);
    expect(lines[0]!.map((token) => token.text).join(" ")).toBe(couplet.m1);
  });

  it("has the meanings be the same words in another order", () => {
    expect([...questionOf().meanings].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(Array.from({ length: 20 }, (_, seed) => questionOf(seed + 1).meanings.join())).size).toBeGreaterThan(3);
    expect(questionOf(4)).toEqual(questionOf(4));
  });

  it("leaves out a word that is not in the couplet, and makes no question from too few", () => {
    const missing = { ...entry, words: entry.words.map((word, index) => (index === 1 ? { ...word, text: "ناپیدا" } : word)) };
    expect(matchQuestion(missing, couplet, generator(1))?.words.map((word) => word.text)).toEqual(["ساقی", "جنت", "گل‌گشت", "مصلا"]);
    expect(matchQuestion({ ...entry, words: [entry.words[0]!] }, couplet, generator(1))).toBeUndefined();
  });
});

describe("MatchRound", () => {
  const roundOf = (count = 2) => MatchRound.of(Array.from({ length: count }, (_, index) => questionOf(index + 1)))!;

  /** Matches every word of the couplet in play, in order. */
  function solve(round: MatchRound) {
    for (const word of round.current.words) {
      round.selectWord(word.id);
      expect(round.pick(word.id)).toBe("matched");
    }
  }

  it("makes a pair worth ten from a word and then its meaning", () => {
    const round = roundOf();
    round.selectWord(2);
    expect(round.selectedWord).toBe(2);
    expect(round.pick(2)).toBe("matched");
    expect([[...round.matched], round.selectedWord, round.points]).toEqual([[2], undefined, 10]);
  });

  it("only shakes for a wrong meaning and keeps the word", () => {
    const round = roundOf();
    round.selectWord(2);
    expect(round.pick(3)).toBe("wrong");
    expect([round.matched.size, round.points, round.selectedWord]).toEqual([0, 0, 2]);
    expect(round.pick(2)).toBe("matched");
  });

  it("ignores a meaning with no word in hand", () => {
    expect(roundOf().pick(1)).toBe("ignored");
  });

  it("cannot pick a matched word or meaning again", () => {
    const round = roundOf();
    round.selectWord(1);
    round.pick(1);
    round.selectWord(1);
    expect(round.selectedWord).toBeUndefined();
    round.selectWord(0);
    expect(round.pick(1)).toBe("ignored");
    expect(round.selectedWord).toBe(0);
  });

  it("puts the word in hand down when it is tapped again", () => {
    const round = roundOf();
    round.selectWord(0);
    round.selectWord(0);
    expect(round.selectedWord).toBeUndefined();
  });

  it("opens the sheet when every word is matched, and ends after the last couplet", () => {
    const round = roundOf();
    for (const word of round.current.words.slice(0, -1)) {
      round.selectWord(word.id);
      round.pick(word.id);
    }
    expect(round.sheetOpen).toBe(false);
    round.selectWord(4);
    round.pick(4);
    expect([round.sheetOpen, round.points, round.results]).toEqual([true, 50, [true]]);
    round.next();
    expect([round.index, round.matched.size, round.sheetOpen, round.isFinished]).toEqual([1, 0, false, false]);
    solve(round);
    expect([round.sheetOpen, round.isFinished, round.points, round.results]).toEqual([true, true, 100, [true, true]]);
    round.next();
    expect(round.index).toBe(1);
  });

  it("changes nothing while the sheet is open", () => {
    const round = roundOf(1);
    solve(round);
    round.selectWord(0);
    expect(round.selectedWord).toBeUndefined();
  });

  it("is made of five couplets from the entries that can be resolved", () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({ path: `/hafez/ghazal/sh${index}`, couplet: 1, words: entry.words }));
    const resolve = (item: GlossaryEntry) => (item.path.endsWith("sh0") ? undefined : couplet);
    const round = MatchRound.make(entries, resolve, generator(3))!;
    expect(round.questions).toHaveLength(5);
    expect(MatchRound.make(entries, resolve, generator(3))).toEqual(round);
    expect(MatchRound.make(entries, () => undefined, generator(3))).toBeUndefined();
    expect(MatchRound.make(entries.slice(0, 2), () => couplet, generator(3))!.questions).toHaveLength(2);
  });

  it("summarises what was done", () => {
    const round = roundOf();
    solve(round);
    expect(matchSummary(round)).toMatchObject({ points: 50, right: 1, total: 2, subtitle: "معنی‌یاب · ۵ جفت", rows: [{ result: true }, { result: null }] });
  });
});

describe("MatchSession", () => {
  it("adds pairs to the points as they come and the best when the round ends", () => {
    const stats = new GameStats(memoryStorage());
    const session = new MatchSession(MatchRound.of([questionOf()])!, stats);
    expect(session.asksBeforeLeaving).toBe(false);
    session.selectWord(0);
    expect([session.pick(1), stats.points]).toEqual(["wrong", 0]);
    for (let id = 0; id < 5; id++) {
      if (session.round.selectedWord !== id) session.selectWord(id);
      session.pick(id);
    }
    expect([stats.points, session.finished, session.asksBeforeLeaving]).toEqual([50, false, true]);
    session.next();
    expect([session.finished, stats.best("match"), session.asksBeforeLeaving]).toEqual([true, 50, false]);
  });
});

describe("the bundled glossary", () => {
  const entries = parseGlossary(bundledFile("glossary"));
  const open = async () => {
    const poets = bundledFile<PoetsFile>("poets");
    return PoetryStore.open({ bundled: { poets: async () => poets, book: async (id) => bundledBook(bundledFile(`book-${id}`)) } });
  };

  it("is found word for word in the bundled poems", async () => {
    expect(entries.length).toBeGreaterThan(100);
    const store = await open();
    for (const item of entries) {
      const line = (await store.poem(item.path)).couplets[item.couplet];
      expect(line, `${item.path} #${item.couplet}`).toBeDefined();
      for (const word of item.words) expect(locate([word.text], word.m === 1 ? line!.m1 : line!.m2).ranges[0], `${word.text} in ${entryId(item)}`).toBeDefined();
    }
  });

  it("makes a question of every entry", async () => {
    const store = await open();
    const random = generator(1);
    for (const item of entries) {
      const line = (await store.poem(item.path)).couplets[item.couplet]!;
      const made = matchQuestion(item, { ...couplet, poem: item.path, index: item.couplet, m1: line.m1, m2: line.m2 }, random);
      expect(made?.words, entryId(item)).toHaveLength(item.words.length);
    }
  });
});

describe("makeMatchRound", () => {
  const library = new Library(bundledFile("library"));
  const entries = parseGlossary(bundledFile("glossary"));
  const poets = bundledFile<PoetsFile>("poets");
  const store = () => PoetryStore.open({ bundled: { poets: async () => poets, book: async (id) => bundledBook(bundledFile(`book-${id}`)) } });

  it("makes five couplets with their poet and book from the library", async () => {
    const opened = await store();
    const round = (await makeMatchRound(entries, (path) => opened.poem(path), library, generator(1)))!;
    expect(round.questions).toHaveLength(5);
    for (const { couplet } of round.questions) {
      expect(couplet.poetSlug).toBe(couplet.poem.split("/")[1]);
      expect(couplet.poetName).not.toBe("");
      expect(library.bookAt(couplet.bookPath)?.title).toBe(couplet.bookTitle);
    }
  });

  it("leaves out a poem that can't be loaded, and makes nothing when none can", async () => {
    const opened = await store();
    const one = entries[0]!.path;
    const round = await makeMatchRound(entries, (path) => (path === one ? Promise.reject(new TypeError("offline")) : opened.poem(path)), library, generator(2));
    expect(round?.questions.every(({ couplet }) => couplet.poem !== one || couplet.index !== entries[0]!.couplet)).toBe(true);
    expect(await makeMatchRound(entries, () => Promise.reject(new TypeError("offline")), library, generator(2))).toBeUndefined();
  });
});
