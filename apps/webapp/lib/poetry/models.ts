// The poetry models, as tools/ganjoor/build.py writes them into the bundled files (Poetry/Models.swift).

/** A book (a category in Ganjoor) as listed under a poet or inside another book. */
export type BookRef = {
  id: number;
  title: string;
  /** Ganjoor's path, e.g. `/hafez/ghazal`. */
  path: string;
  /** True when the whole book text is bundled with the app. */
  bundled?: boolean;
};

/** A poet. Years are lunar Hijri. */
export type Poet = {
  id: number;
  slug: string;
  /** The short display name; `name` is the full name for the poet's own page. */
  nickname: string;
  name: string;
  bio: string;
  birthYear?: number;
  deathYear?: number;
  books: BookRef[];
};

/** poets.json: the poets and where the data comes from. */
export type PoetsFile = {
  /** `sha` is the ganjoor-data commit the bundled files were built from; more is fetched from the same one. */
  source: { repo: string; sha: string };
  poets: Poet[];
};

/** A poem as listed in a book. */
export type PoemRef = { id: number; title: string; path: string };

export type Book = {
  id: number;
  title: string;
  path: string;
  poetId?: number;
  /** Ganjoor's table-of-contents style, e.g. `AlphabeticWithFirstVerse`. */
  toc: string;
  poems: PoemRef[];
  /** Sub-books. Bundled books have none. */
  children: BookRef[];
};

/** One couplet: two hemistichs, or for prose and free verse one line in `m1` with `m2` empty. */
export type Couplet = {
  m1: string;
  m2: string;
  /** What the couplet means, when Ganjoor has a note for it. */
  meaning?: string;
  /** True when an AI wrote the meaning (Ganjoor's «هوش مصنوعی:» label, stripped from the text). */
  ai?: true;
};

export type Poem = {
  id: number;
  title: string;
  path: string;
  summary?: string;
  summaryAi?: true;
  rhythm?: string;
  couplets: Couplet[];
};

/** A bundled book file: the book with the full text of every poem. */
export type BundledBook = { book: Book; poems: Poem[] };

/** One recitation of a poem from Ganjoor's API; only the fields we use. */
export type Recitation = {
  id: number;
  audioArtist: string;
  mp3Url: string;
  /** The timing file that syncs the audio to the text; undefined when there is none. */
  xmlUrl?: string;
  inSyncWithText: boolean;
  audioOrder: number;
};

/** The AI sparkle shows by the meaning's heading: only when there is a meaning and it was written by an AI. */
export const showsAIMark = (couplet: Couplet): boolean => couplet.meaning !== undefined && couplet.ai === true;
