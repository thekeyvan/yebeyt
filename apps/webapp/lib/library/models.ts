import type { PoemRef } from "../poetry/models";
import { persianDigits } from "../persian";

// library.json, written by tools/ganjoor/build.py from curation.json and Ganjoor's categories (Library/LibraryModels.swift).

/** The six colours of curation.json (poets, book covers), by the names of the design tokens. */
export type PaletteColor = "lapis" | "fire" | "amber" | "green" | "magenta" | "ink";

export type LibraryPoet = {
  id: number;
  slug: string;
  /** The short display name. */
  name: string;
  /** «شاعرِ غزل», the tilted sticker on the poet's card. */
  tag: string;
  city?: string;
  century?: string;
  color: PaletteColor;
  bio: string;
};

export type Mood = { key: string; title: string; words: string[] };

export type BookType = "divan" | "masnavi" | "robai" | "prose" | "modern";

/** The type chips of the library, in order. */
export const bookTypes: { type: BookType; title: string }[] = [
  { type: "divan", title: "دیوان‌ها" },
  { type: "masnavi", title: "مثنوی و داستان" },
  { type: "robai", title: "رباعی" },
  { type: "prose", title: "نثر و حکایت" },
  { type: "modern", title: "معاصر" },
];

/** A category inside a book (غزلیات, or a part of the Shahnameh), with every poem below it counted. */
export type BookSection = {
  id: number;
  title: string;
  /** Ganjoor's path, e.g. `/hafez/ghazal`. */
  path: string;
  count: number;
  /** What one poem of it is called: غزل, رباعی, … (شعر when unknown). */
  unit: string;
  sections?: BookSection[];
};

export type LibraryBook = {
  /** Ganjoor's category id. The poem index file is `index-<id>.json`. */
  id: number;
  path: string;
  /** The everyday title. */
  title: string;
  /** The poet's slug. */
  poet: string;
  type: BookType;
  color: PaletteColor;
  blurb: string;
  century?: string;
  /** Every poem in the book, sections included. */
  count: number;
  /** True when Ganjoor has at least one recitation of it. */
  recited: boolean;
  /** The unit of the main section: «یه غزل تصادفی». */
  unit: string;
  sections?: BookSection[];
  /** Poems that sit directly in the book beside its sections. */
  poems?: PoemRef[];
};

export type LibraryFile = {
  poets: LibraryPoet[];
  books: LibraryBook[];
  moods: Mood[];
  /** The poet slugs of the Explore row, in order. */
  explorePoets: string[];
};

/** «شیراز · قرن هشتم»; whichever part is known. */
export const poetPlace = ({ city, century }: LibraryPoet): string | undefined => [city, century].filter(Boolean).join(" · ") || undefined;

/** The first letter of the name, for the default picture (a circle in the poet's colour). */
export const poetLetter = ({ name }: LibraryPoet): string => [...name][0] ?? "";

/** This section's id and every id below it: the categories whose poems belong to it. */
export const subtreeIds = (section: BookSection): Set<number> => new Set([section.id, ...(section.sections ?? []).flatMap((child) => [...subtreeIds(child)])]);

export function findSection(section: BookSection, match: (candidate: BookSection) => boolean): BookSection | undefined {
  if (match(section)) return section;
  for (const child of section.sections ?? []) {
    const found = findSection(child, match);
    if (found) return found;
  }
  return undefined;
}

/** The book as one section, for a book without child categories. */
export const asSection = ({ id, title, path, count, unit, sections }: LibraryBook): BookSection => ({ id, title, path, count, unit, sections });

/** The rows of the Book screen: its sections, or the book itself when it has none. */
export const bookRows = (book: LibraryBook): BookSection[] => (book.sections?.length ? book.sections : [asSection(book)]);

/** The biggest section (the first of equals): «پرخواننده‌ترین غزل‌ها» of a divan come from it. */
export const mainSection = (book: LibraryBook): BookSection => bookRows(book).reduce((best, row) => (row.count > best.count ? row : best));

export const sectionOf = (book: LibraryBook, match: (section: BookSection) => boolean): BookSection | undefined => findSection(asSection(book), match);

/** «قرن هشتم · ۶۹۵ شعر · با خوانش»; the parts that are not known are left out. */
export const bookMeta = ({ century, count, recited }: LibraryBook): string =>
  [century, `${persianDigits(count)} شعر`, recited ? "با خوانش" : undefined].filter(Boolean).join(" · ");

/** «غزل ۳»: what a poem is called in «شروع» and «ادامه», from its section's unit and its number. */
export const poemShortTitle = (book: LibraryBook, { catId, number }: { catId: number; number: number }): string =>
  `${sectionOf(book, (section) => section.id === catId)?.unit ?? book.unit} ${persianDigits(number)}`;
