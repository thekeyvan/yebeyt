import type { Couplet, Poem } from "../poetry/models";
import { shortTitle } from "../reader/text";
import type { Library } from "./library";
import type { LibraryBook, LibraryPoet, Mood } from "./models";
import { normalize } from "./normalize";

/** One couplet of a bundled book, ready for matching. */
export type CoupletEntry = {
  /** `path#index`, as the reader's marks name a couplet. */
  id: string;
  path: string;
  index: number;
  couplet: Couplet;
  /** The poet's slug. */
  poet: string;
  /** «غزل ۳» */
  title: string;
  /** How many recitations the poem has: the popular ones come first. */
  popularity: number;
  /** Both hemistichs, normalised. */
  text: string;
};

/** A poem of a bundled book with its poet's slug (the first part of its path). */
export type BundledPoem = { slug: string; poem: Poem };

/** Every couplet of the bundled books, for search and the mood lists (Search/CoupletCorpus.swift). */
export class CoupletCorpus {
  readonly entries: CoupletEntry[];

  /** `popularity` is the recitation count by poem path (poems missing from it count as 0). */
  constructor(poems: BundledPoem[], popularity: Record<string, number>) {
    this.entries = poems.flatMap(({ slug, poem }) =>
      poem.couplets.map((couplet, index) => ({
        id: `${poem.path}#${index}`,
        path: poem.path,
        index,
        couplet,
        poet: slug,
        title: shortTitle(poem.title),
        popularity: popularity[poem.path] ?? 0,
        text: normalize(`${couplet.m1} ${couplet.m2}`),
      })),
    );
  }

  /** Couplets containing the query, the most recited poems first. */
  search(query: string, limit: number): CoupletEntry[] {
    const wanted = normalize(query);
    return wanted === "" ? [] : this.top(limit, (entry) => entry.text.includes(wanted));
  }

  /** Couplets containing any of the mood's words, the most recited poems first. */
  matching(mood: Mood, limit: number): CoupletEntry[] {
    const words = mood.words.map(normalize).filter((word) => word !== "");
    return this.top(limit, (entry) => words.some((word) => entry.text.includes(word)));
  }

  private top(limit: number, matches: (entry: CoupletEntry) => boolean): CoupletEntry[] {
    return this.entries
      .filter(matches)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }
}

/** What a search finds: the poets and books by name, the couplets in the bundled books. */
export type SearchResults = { poets: LibraryPoet[]; books: LibraryBook[]; couplets: CoupletEntry[] };

export const coupletLimit = 30;

export const isEmpty = ({ poets, books, couplets }: SearchResults): boolean => poets.length + books.length + couplets.length === 0;

/** Everything the query finds; couplets come from `corpus`, when it has loaded. */
export const search = (library: Library, query: string, corpus?: CoupletCorpus): SearchResults => ({
  ...library.find(query),
  couplets: corpus?.search(query, coupletLimit) ?? [],
});
