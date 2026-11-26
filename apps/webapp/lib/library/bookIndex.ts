import { normalize } from "./normalize";
import { asSection, subtreeIds, type BookSection, type LibraryBook } from "./models";
import { rhymeKey } from "./sectionList";

/** One poem of a book as listed in `index-<catId>.json`: enough for a list row, without loading the poem. */
export type IndexedPoem = {
  id: number;
  /** The category (section) the poem sits directly in. */
  catId: number;
  /** The full Ganjoor path, e.g. `/hafez/ghazal/sh3`. */
  path: string;
  /** The first hemistich. */
  first: string;
  couplets: number;
  /** Ganjoor's rhyme letters, e.g. «لها». */
  rhyme: string;
  /** How many recitations Ganjoor has: the popularity. */
  recitations: number;
  /** The 1-based place among the poems of its category, in the book's order. */
  number: number;
  /** `first` normalised for matching. */
  searchText: string;
  /** The rhyme as a sort key (`rhymeKey`). */
  rhymeKey: number[];
};

/** `[id, catId, slug, first, couplets, rhyme, recitations]`. */
export type IndexRow = [number, number, string, string, number, string, number];

/** The poems of one book, in the book's order (Library/BookIndex.swift). */
export class BookIndex {
  constructor(readonly poems: IndexedPoem[]) {}

  /** Reads an index file; `book` supplies the category paths the poem paths are built from. */
  static parse(file: { poems: IndexRow[] }, book: LibraryBook): BookIndex {
    const paths = new Map<number, string>();
    const collect = (section: BookSection) => {
      paths.set(section.id, section.path);
      section.sections?.forEach(collect);
    };
    collect(asSection(book));
    const counts = new Map<number, number>();
    const poems: IndexedPoem[] = [];
    for (const [id, catId, slug, first, couplets, rhyme, recitations] of file.poems) {
      const base = paths.get(catId);
      if (base === undefined) continue;
      const number = (counts.get(catId) ?? 0) + 1;
      counts.set(catId, number);
      poems.push({ id, catId, path: `${base}/${slug}`, first, couplets, rhyme, recitations, number, searchText: normalize(first), rhymeKey: rhymeKey(rhyme) });
    }
    return new BookIndex(poems);
  }

  /** The poems sitting directly in one category. */
  poemsIn = (catId: number): IndexedPoem[] => this.poems.filter((poem) => poem.catId === catId);

  /** The poems of a category and everything below it. */
  poemsInAny = (catIds: Set<number>): IndexedPoem[] => this.poems.filter((poem) => catIds.has(poem.catId));

  poem = (path: string): IndexedPoem | undefined => this.poems.find((poem) => poem.path === path);

  /** The first poem of a section and everything below it, in the book's order. */
  firstIn(section: BookSection): IndexedPoem | undefined {
    const ids = subtreeIds(section);
    return this.poems.find((poem) => ids.has(poem.catId));
  }

  /** How far along the book a poem is: its place among all the poems, from 0 to 1. */
  fraction(path: string): number | undefined {
    const position = this.poems.findIndex((poem) => poem.path === path);
    return position === -1 ? undefined : (position + 1) / this.poems.length;
  }
}
