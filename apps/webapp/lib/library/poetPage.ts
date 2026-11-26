import type { BookIndex, IndexedPoem } from "./bookIndex";
import type { Library } from "./library";
import { mainSection, subtreeIds } from "./models";
import { bookHref, sectionHref } from "./routes";
import { sorted } from "./sectionList";

export type PoetChip = { id: string; title: string; href: string };

/** The poet's books, or when there is only one, its sections (Library/PoetScreen.swift `chipItems`). */
export function poetChips(library: Library, slug: string): PoetChip[] {
  const books = library.booksOf(slug);
  const only = books.length === 1 ? books[0] : undefined;
  if (only?.sections && only.sections.length > 1) return only.sections.map((section) => ({ id: String(section.id), title: section.title, href: sectionHref(section.path) }));
  return books.map((book) => ({ id: String(book.id), title: book.title, href: bookHref(book) }));
}

/** The poet's most read poems of their main section (`loadTop`): «پرخواننده‌ترین غزل‌ها». */
export type TopPoems = { heading: string; poems: IndexedPoem[] };

export function topPoems(library: Library, slug: string, index: BookIndex): TopPoems | undefined {
  const book = library.mainBook(slug);
  if (!book) return undefined;
  const section = mainSection(book);
  const ranked = sorted(index.poemsInAny(subtreeIds(section)), "popularity")
    .slice(0, 3)
    .filter((poem) => poem.recitations > 0);
  return { heading: `پرخواننده‌ترین ${section.unit}\u200Cها`, poems: ranked };
}
