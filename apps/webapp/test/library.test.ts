import { describe, expect, it } from "vitest";
import { BookIndex } from "../lib/library/bookIndex";
import { falPoem } from "../lib/library/fal";
import { poetChips, topPoems } from "../lib/library/poetPage";
import { Library } from "../lib/library/library";
import { bookMeta, bookRows, mainSection, poemShortTitle, poetLetter, poetPlace, sectionOf, subtreeIds, type LibraryFile } from "../lib/library/models";
import { bundledFile } from "./files";

// The tests of YebeytTests/LibraryTests.swift, on the bundled library.json and the index files.
const library = new Library(bundledFile<LibraryFile>("library"));
const indexOf = (path: string) => {
  const book = library.bookAt(path)!;
  return { book, index: BookIndex.parse(bundledFile(`index-${book.id}`), book) };
};

describe("the library", () => {
  it("loads the curated poets, books and moods", () => {
    expect(library.poets).toHaveLength(48);
    expect(library.books).toHaveLength(99);
    expect(library.poetCount).toBe(48);
    expect(library.moods.map((mood) => mood.title)).toEqual(["عشق", "دلتنگی", "امید", "بهار", "جوونی", "دوستی"]);
  });

  it("puts the Explore poets in curation order", () => {
    expect(library.explorePoets).toHaveLength(12);
    expect(library.explorePoets.slice(0, 3).map((poet) => poet.slug)).toEqual(["hafez", "saadi", "moulavi"]);
  });

  it("gives a poet the curated fields, a place and a letter", () => {
    const hafez = library.poet("hafez")!;
    expect(hafez).toMatchObject({ name: "حافظ", tag: "شاعرِ غزل", color: "lapis" });
    expect(poetPlace(hafez)).toBe("شیراز · قرن هشتم");
    expect(poetLetter(hafez)).toBe("ح");
    expect(poetPlace(library.poet("bidel")!)).toBe("دهلی"); // no century known: the part is left out
  });

  it("gives a divan its sections with units and the poems that sit directly in it", () => {
    const hafez = library.bookAt("/hafez")!;
    expect(hafez).toMatchObject({ title: "دیوان حافظ", type: "divan", recited: true, unit: "غزل" });
    expect(bookRows(hafez).map((row) => row.title)).toEqual(["غزلیات", "قطعات", "رباعیات", "قصاید", "اشعار منتسب"]);
    expect(bookRows(hafez).map((row) => row.unit)).toEqual(["غزل", "قطعه", "رباعی", "قصیده", "شعر"]);
    expect(mainSection(hafez)).toMatchObject({ title: "غزلیات", count: 495 });
    expect(hafez.poems?.map((poem) => poem.title)).toContain("ساقی‌نامه");
    expect(bookMeta(hafez)).toBe("قرن هشتم · ۶۹۵ شعر · با خوانش");
  });

  it("makes a book without child categories one row for itself", () => {
    const khayyam = library.bookAt("/khayyam/robaee")!;
    expect(khayyam.sections).toBeUndefined();
    expect(bookRows(khayyam).map((row) => row.id)).toEqual([khayyam.id]);
    expect(bookRows(khayyam)[0]?.unit).toBe("رباعی");
  });

  it("finds books by path and by a poem path, and sections by path", () => {
    expect(library.bookContaining("/hafez/ghazal/sh3")?.path).toBe("/hafez");
    expect(library.bookContaining("/khayyam/robaee/sh1")?.path).toBe("/khayyam/robaee");
    expect(library.bookContaining("/nowhere/x/y")).toBeUndefined();
    const found = library.sectionAt("/hafez/ghazal");
    expect(found?.book.path).toBe("/hafez");
    expect(found?.section.id).toBe(24);
    expect(library.mainBook("saadi")?.path).toBe("/saadi/divan/ghazals");
  });

  it("knows a subtree is every id below a section", () => {
    const book = library.books.find((candidate) => candidate.sections?.some((section) => section.sections?.length))!;
    const parent = book.sections!.find((section) => section.sections?.length)!;
    const ids = subtreeIds(parent);
    expect(ids.has(parent.id)).toBe(true);
    for (const child of parent.sections!) expect(ids.has(child.id)).toBe(true);
    expect(sectionOf(book, (section) => section.id === parent.sections![0]!.id)?.id).toBe(parent.sections![0]!.id);
  });

  it("covers the bundled books with the books that hold their paths", () => {
    expect(library.booksCovering(["/hafez/ghazal", "/khayyam/robaee"]).map((book) => book.path)).toEqual(["/hafez", "/khayyam/robaee"]);
  });
});

describe("the poem index of a book", () => {
  it("lists every poem with its path, number and popularity", () => {
    const { book, index } = indexOf("/hafez");
    expect(index.poems).toHaveLength(book.count);
    const third = index.poem("/hafez/ghazal/sh3")!;
    expect(third).toMatchObject({ number: 3, catId: 24, couplets: 9 });
    expect(third.recitations).toBeGreaterThan(0);
    expect(third.first).not.toBe("");
    expect(third.rhyme).not.toBe("");
    expect(index.poemsIn(24)).toHaveLength(495);
    expect(index.poemsInAny(new Set([25, 26]))).toHaveLength(76);
    expect(index.poem("/hafez/masnavi")?.catId).toBe(book.id);
  });

  it("knows how far along a poem is and where a section starts", () => {
    const { book, index } = indexOf("/hafez");
    const first = index.firstIn(bookRows(book)[0]!)!;
    expect(first.path).toBe("/hafez/ghazal/sh1"); // not the masnavi that sits directly in the book
    const fraction = index.fraction("/hafez/ghazal/sh3")!;
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThan(0.1);
    expect(index.fraction("/nowhere/x/y")).toBeUndefined();
    expect(index.fraction(index.poems.at(-1)!.path)).toBe(1);
  });

  it("has a file for every book, with as many poems as the book says", () => {
    for (const book of library.books) expect(BookIndex.parse(bundledFile(`index-${book.id}`), book).poems, book.title).toHaveLength(book.count);
  });
});

describe("the fal of Hafez (Explore/FalCard.swift)", () => {
  it("is a ghazal from the main section of the book of Hafez, whichever way the dice fall", () => {
    const { book, index } = indexOf("/hafez");
    const ghazals = new Set(index.poemsIn(24).map((poem) => poem.path));
    expect(ghazals.size).toBe(495);
    for (const roll of [0, 0.25, 0.5, 0.999999]) expect(ghazals.has(falPoem(book, index, () => roll)!.path)).toBe(true);
    expect(falPoem(book, index, () => 0)?.path).toBe("/hafez/ghazal/sh1");
    expect(falPoem(book, index, () => 0.999999)?.path).toBe("/hafez/ghazal/sh495");
  });
});

describe("short titles", () => {
  it("name a poem by its section's unit and its number", () => {
    const { book, index } = indexOf("/hafez");
    expect(poemShortTitle(book, index.firstIn(bookRows(book)[0]!)!)).toBe("غزل ۱");
    expect(poemShortTitle(book, index.poemsIn(25)[0]!)).toBe("قطعه ۱");
  });
});

describe("a poet's page", () => {
  it("lists the poet's sections as chips when they have one book with several, else the books", () => {
    expect(poetChips(library, "hafez").map((chip) => chip.title)).toEqual(bookRows(library.bookAt("/hafez")!).map((row) => row.title));
    expect(poetChips(library, "hafez")[0]?.href).toBe("/explore/section/hafez/ghazal");
    const saadi = poetChips(library, "saadi");
    expect(saadi.map((chip) => chip.title)).toEqual(library.booksOf("saadi").map((book) => book.title));
    expect(saadi[0]?.href).toMatch(/^\/explore\/book\/saadi\//);
    expect(poetChips(library, "nobody")).toEqual([]);
  });

  it("shows the three most recited poems of the main section", () => {
    const { book, index } = indexOf("/hafez");
    const top = topPoems(library, "hafez", index)!;
    expect(top.heading).toBe("پرخواننده‌ترین غزل\u200Cها");
    expect(top.poems).toHaveLength(3);
    const counts = top.poems.map((poem) => poem.recitations);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(top.poems.every((poem) => index.poemsIn(mainSection(book).id).includes(poem))).toBe(true);
    expect(topPoems(library, "nobody", index)).toBeUndefined();
  });
});
