import { asSection, findSection, type BookSection, type LibraryBook, type LibraryFile, type LibraryPoet, type Mood } from "./models";
import { contains, normalize } from "./normalize";

/** The curated library: poets, books and moods (library.json), with the lookups of Library/Library.swift. */
export class Library {
  readonly poets: LibraryPoet[];
  readonly books: LibraryBook[];
  readonly moods: Mood[];
  /** The poets of the Explore row, in order. */
  readonly explorePoets: LibraryPoet[];

  constructor(file: LibraryFile) {
    this.poets = file.poets;
    this.books = file.books;
    this.moods = file.moods;
    this.explorePoets = file.explorePoets.flatMap((slug) => this.poets.find((poet) => poet.slug === slug) ?? []);
  }

  /** How many poets have a book: «۹۹ کتاب از ۴۸ شاعر». */
  get poetCount(): number {
    return new Set(this.books.map((book) => book.poet)).size;
  }

  poet = (slug: string): LibraryPoet | undefined => this.poets.find((poet) => poet.slug === slug);

  poetOf = (book: LibraryBook): LibraryPoet | undefined => this.poet(book.poet);

  bookAt = (path: string): LibraryBook | undefined => this.books.find((book) => book.path === path);

  booksOf = (poet: string): LibraryBook[] => this.books.filter((book) => book.poet === poet);

  /** The book a poem path belongs to; the longest book path wins when books nest. */
  bookContaining(poemPath: string): LibraryBook | undefined {
    return this.books.filter((book) => poemPath.startsWith(`${book.path}/`)).reduce<LibraryBook | undefined>((best, book) => (!best || book.path.length > best.path.length ? book : best), undefined);
  }

  /** The book and the section at a Ganjoor path, e.g. `/hafez/ghazal`. */
  sectionAt(path: string): { book: LibraryBook; section: BookSection } | undefined {
    for (const book of [...this.books].sort((a, b) => b.path.length - a.path.length)) {
      if (path !== book.path && !path.startsWith(`${book.path}/`)) continue;
      const section = findSection(asSection(book), (candidate) => candidate.path === path);
      if (section) return { book, section };
    }
    return undefined;
  }

  /** The poet's main book: the first divan, else the first book. */
  mainBook(poet: string): LibraryBook | undefined {
    const own = this.booksOf(poet);
    return own.find((book) => book.type === "divan") ?? own[0];
  }

  /** The books that hold any of these paths (the bundled books), for the indexes the home couplet is picked from. */
  booksCovering(paths: string[]): LibraryBook[] {
    return this.books.filter((book) => paths.some((path) => path === book.path || path.startsWith(`${book.path}/`)));
  }

  /** Poets and books whose names contain the query (a book also by its poet's name). */
  find(query: string): { poets: LibraryPoet[]; books: LibraryBook[] } {
    if (normalize(query) === "") return { poets: [], books: [] };
    return {
      poets: this.poets.filter((poet) => contains(poet.name, query)),
      books: this.books.filter((book) => contains(book.title, query) || contains(this.poetOf(book)?.name ?? "", query)),
    };
  }
}
