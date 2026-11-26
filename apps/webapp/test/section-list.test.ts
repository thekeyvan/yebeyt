import { describe, expect, it } from "vitest";
import type { IndexedPoem } from "../lib/library/bookIndex";
import { filtered, rhymeKey, sectionSorts, sorted } from "../lib/library/sectionList";
import { normalize } from "../lib/library/normalize";

// The tests of YebeytTests/SectionListTests.swift.
const poem = (number: number, { first = "", rhyme = "", recitations = 0 } = {}): IndexedPoem => ({
  id: number,
  catId: 1,
  path: `/a/b/sh${number}`,
  first,
  couplets: 7,
  rhyme,
  recitations,
  number,
  searchText: normalize(first),
  rhymeKey: rhymeKey(rhyme),
});
const numbers = (poems: IndexedPoem[]) => poems.map((p) => p.number);

describe("sorting the poems of a section", () => {
  it("keeps the book's order by number, even from another order", () => {
    expect(numbers(sorted([poem(3), poem(1), poem(2)], "number"))).toEqual([1, 2, 3]);
  });

  it("sorts by the alphabet of the rhyme's last letter, then the letters before it", () => {
    const poems = [poem(1, { rhyme: "لها" }), poem(2, { rhyme: "ابکجا" }), poem(3, { rhyme: "ین" }), poem(4, { rhyme: "ارا" }), poem(5, { rhyme: "ب" }), poem(6, { rhyme: "ل" }), poem(7, { rhyme: "ارا" })];
    expect(numbers(sorted(poems, "lastLetter"))).toEqual([2, 4, 7, 1, 5, 6, 3]);
  });

  it("normalises Arabic letters and puts missing rhymes last", () => {
    const poems = [poem(1, { rhyme: "" }), poem(2, { rhyme: "ي" }), poem(3, { rhyme: "ك" }), poem(4, { rhyme: "ی" })];
    expect(numbers(sorted(poems, "lastLetter"))).toEqual([3, 2, 4, 1]);
  });

  it("sorts the end of the rhyme before every letter and no rhyme last", () => {
    const poems = [poem(1, { rhyme: "ارا" }), poem(2, { rhyme: "ا" }), poem(3, { rhyme: "" }), poem(4, { rhyme: "ب" })];
    expect(numbers(sorted(poems, "lastLetter"))).toEqual([2, 1, 4, 3]);
    expect(rhymeKey("ا")[0]).toBe(0);
    expect(rhymeKey("ا").at(-1)).toBe(-1);
  });

  it("gives hamza and waw with hamza their place in the alphabet", () => {
    const poems = [poem(1, { rhyme: "ی" }), poem(2, { rhyme: "ؤ" }), poem(3, { rhyme: "ء" }), poem(4, { rhyme: "و" }), poem(5, { rhyme: "ا" }), poem(6, { rhyme: "ب" }), poem(7, { rhyme: "ئ" })];
    expect(numbers(sorted(poems, "lastLetter"))).toEqual([5, 3, 6, 4, 2, 1, 7]);
  });

  it("sorts by recitations, then number", () => {
    const poems = [poem(1, { recitations: 2 }), poem(2, { recitations: 9 }), poem(3, { recitations: 2 }), poem(4, { recitations: 0 })];
    expect(numbers(sorted(poems, "popularity"))).toEqual([2, 1, 3, 4]);
  });

  it("does not change the list it is given", () => {
    const poems = [poem(2), poem(1)];
    sorted(poems, "number");
    expect(numbers(poems)).toEqual([2, 1]);
  });

  it("has the board's titles", () => {
    expect(sectionSorts.map((s) => s.title)).toEqual(["شماره", "حرف آخر", "پرخواننده"]);
  });
});

describe("filtering the poems of a section", () => {
  it("finds a word of the first line, ignoring diacritics and spelling", () => {
    const poems = [poem(1, { first: "اَلا یا اَیُّهَا السّاقی" }), poem(2, { first: "صلاحِ کار کجا و منِ خراب کجا؟" }), poem(3, { first: "كجا" })];
    expect(numbers(filtered(poems, "الا"))).toEqual([1]);
    expect(numbers(filtered(poems, "کجا"))).toEqual([2, 3]);
  });

  it("finds a number in Persian or Latin digits", () => {
    const poems = [poem(1), poem(12), poem(2)];
    expect(numbers(filtered(poems, "۱۲"))).toEqual([12]);
    expect(numbers(filtered(poems, "2"))).toEqual([2]);
  });

  it("keeps everything for an empty query", () => {
    expect(filtered([poem(1), poem(2)], "  ")).toHaveLength(2);
  });
});
