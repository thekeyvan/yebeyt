import { describe, expect, it } from "vitest";
import { Library } from "../lib/library/library";
import type { LibraryFile, Mood } from "../lib/library/models";
import { BookIndexes } from "../lib/library/indexes";
import { coupletLimit, CoupletCorpus, isEmpty, search } from "../lib/library/search";
import { loadCorpus } from "../lib/library/sources";
import { bundledBook } from "../lib/poetry/bundled";
import type { Poem, PoetsFile } from "../lib/poetry/models";
import { PoetryStore } from "../lib/poetry/store";
import { bundledFile } from "./files";

// The tests of YebeytTests/SearchTests.swift.
const poem = (path: string, couplets: [string, string][]) => ({
  slug: path.split("/")[1]!,
  poem: { id: 1, title: "t", path, couplets: couplets.map(([m1, m2]) => ({ m1, m2 })) } satisfies Poem,
});

const corpus = new CoupletCorpus(
  [
    poem("/a/g/sh1", [["به مِی سجّاده رنگین کن", "که سالک بی‌خبر نبود"], ["ز عشق ناتمام ما", "جمال یار مستغنی‌ست"]]),
    poem("/a/g/sh2", [["دلبر و عاشق و معشوق", "همه یک نور"], ["بهار آمد", "سبزه نو شد"]]),
  ],
  { "/a/g/sh2": 5, "/a/g/sh1": 1 },
);
const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe("the couplet corpus", () => {
  it("finds a couplet by a word of either hemistich, ignoring diacritics", () => {
    expect(ids(corpus.search("سجاده", 10))).toEqual(["/a/g/sh1#0"]);
    expect(ids(corpus.search("نور", 10))).toEqual(["/a/g/sh2#0"]);
  });

  it("puts the most recited poems first and respects the limit", () => {
    expect(ids(corpus.search("و", 10))).toEqual(["/a/g/sh2#0", "/a/g/sh2#1", "/a/g/sh1#0"]);
    expect(corpus.search("ما", 1)).toHaveLength(1);
    expect(corpus.search("  ", 10)).toEqual([]);
  });

  it("matches a mood by any of its words on normalised text", () => {
    const love: Mood = { key: "love", title: "عشق", words: ["عشق", "عاشق", "دلبر"] };
    expect(ids(corpus.matching(love, 10))).toEqual(["/a/g/sh2#0", "/a/g/sh1#1"]);
    expect(ids(corpus.matching({ key: "spring", title: "بهار", words: ["بهار"] }, 10))).toEqual(["/a/g/sh2#1"]);
    expect(corpus.matching({ key: "x", title: "x", words: ["هیچ‌چیز"] }, 10)).toEqual([]);
  });
});

describe("search", () => {
  const library = new Library(bundledFile<LibraryFile>("library"));

  it("finds names as poets and books", () => {
    const found = library.find("حافظ");
    expect(found.poets.map((poet) => poet.slug)).toEqual(["hafez"]);
    expect(found.books.some((book) => book.path === "/hafez")).toBe(true);
    expect(library.find("گلستان").books.map((book) => book.path)).toEqual(["/saadi/golestan"]);
    expect(isEmpty({ ...library.find(""), couplets: [] })).toBe(true);
    expect(isEmpty({ ...library.find("zzzz"), couplets: [] })).toBe(true);
  });

  it("adds the couplets of the corpus", () => {
    expect(ids(search(library, "عاشق", corpus).couplets)).toEqual(["/a/g/sh2#0"]);
    expect(search(library, "عاشق").couplets).toEqual([]);
    expect(coupletLimit).toBe(30);
  });
});

describe("the bundled corpus", () => {
  it("has matches for every mood and finds the first line of Hafez", async () => {
    const library = new Library(bundledFile<LibraryFile>("library"));
    const poetry = await PoetryStore.open({
      bundled: { poets: async () => bundledFile<PoetsFile>("poets"), book: async (id) => bundledBook(bundledFile(`book-${id}`)) },
    });
    const indexes = new BookIndexes(async (name) => bundledFile(name));
    const loaded = await loadCorpus(library, indexes, poetry);
    expect(loaded.entries.length).toBeGreaterThan(5000);
    for (const mood of library.moods) expect(loaded.matching(mood, 20), mood.title).toHaveLength(20);
    expect(loaded.search("الا یا ایها الساقی", 5)[0]?.poet).toBe("hafez");
  });
});
