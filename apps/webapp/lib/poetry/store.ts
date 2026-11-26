import type { Book, BookRef, BundledBook, Poem, PoetsFile, Recitation } from "./models";
import { bookFromRaw, poemFromRaw, type RawCategory, type RawPoem } from "./raw";

/** Why poetry did not load. A network failure is the browser's own error (a `TypeError` from `fetch`). */
export class PoetryError extends Error {
  constructor(
    readonly kind: "notFound" | "badStatus",
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** The files `tools/ganjoor/build.py` wrote: the browser fetches them from /data, the server reads them from disk. */
export type BundledSource = {
  poets(): Promise<PoetsFile>;
  book(id: number): Promise<BundledBook>;
};

/** Books and poems fetched from the network, kept by key. Best effort: reading and writing never throw. */
export type PoetryCache = {
  read<T>(key: string): Promise<T | undefined>;
  write(key: string, value: unknown): Promise<void>;
};

type Backends = { bundled: BundledSource; fetch?: typeof fetch; cache?: (sha: string) => PoetryCache };

const dataURL = "https://raw.githubusercontent.com/ganjoor/ganjoor-data";
const recitationsURL = "https://api.ganjoor.net/api/ganjoor/poem";

/**
 * Paths look like `/poet/book/poem`, each part only letters, digits, «_» and «-» (every Ganjoor slug is). Nothing else gets into an address:
 * a «\» or an encoded «..» would make `fetch` leave ganjoor-data for another repository.
 */
export const isValidPath = (path: string): boolean => /^(\/[A-Za-z0-9_-]+)+$/.test(path);

/**
 * Poets, books and poems (Poetry/PoetryStore.swift). The poets and a few whole books are bundled; everything else is fetched
 * from ganjoor-data at the pinned commit and cached in the browser, so a poem opened once works offline.
 */
export class PoetryStore {
  readonly poets: PoetsFile["poets"];
  /** The ganjoor-data commit all data comes from. */
  readonly sha: string;
  private readonly bundledRefs: BookRef[];
  private readonly bundled: BundledSource;
  private readonly fetcher: typeof fetch;
  private readonly cache?: PoetryCache;
  private readonly books = new Map<number, Promise<BundledBook>>();

  private constructor(file: PoetsFile, { bundled, fetch: fetcher, cache }: Backends) {
    this.poets = file.poets;
    this.sha = file.source.sha;
    this.bundled = bundled;
    this.fetcher = fetcher ?? ((input, init) => fetch(input, init));
    this.cache = cache?.(this.sha);
    this.bundledRefs = file.poets.flatMap((poet) => poet.books).filter((book) => book.bundled);
  }

  /** Loads poets.json from the bundled files; throws when it cannot. */
  static async open(backends: Backends): Promise<PoetryStore> {
    return new PoetryStore(await backends.bundled.poets(), backends);
  }

  /** The Ganjoor paths of the bundled books. */
  get bundledPaths(): string[] {
    return this.bundledRefs.map((book) => book.path);
  }

  /** Every poem of the bundled books, with its poet's slug (the first part of its path). */
  async bundledPoems(): Promise<{ slug: string; poem: Poem }[]> {
    const books = await Promise.all([...this.bundledRefs].sort((a, b) => a.id - b.id).map((ref) => this.bundledBook(ref.id)));
    return books.flatMap(({ poems }) => poems.map((poem) => ({ slug: poem.path.split("/")[1] ?? "", poem })));
  }

  /** The poet whose slug starts a Ganjoor path. */
  poetOf(path: string): PoetsFile["poets"][number] | undefined {
    return this.poets.find((poet) => path.startsWith(`/${poet.slug}/`));
  }

  /** Any book by Ganjoor path, such as `/hafez/ghazal` or a sub-book from `Book.children`. */
  async book(path: string): Promise<Book> {
    if (!isValidPath(path)) throw new PoetryError("notFound", path);
    const ref = this.bundledRefs.find((book) => book.path === path);
    if (ref) return (await this.bundledBook(ref.id)).book;
    return this.cachedOrFetched(path, `poets${path}/_cat.json`, (raw: RawCategory) => bookFromRaw(raw));
  }

  /** A poem by Ganjoor path, such as `/hafez/ghazal/sh3`, with all its couplets. */
  async poem(path: string): Promise<Poem> {
    if (!isValidPath(path)) throw new PoetryError("notFound", path);
    const ref = this.bundledRefs.find((book) => path.startsWith(`${book.path}/`));
    const bundled = ref && (await this.bundledBook(ref.id)).poems.find((poem) => poem.path === path);
    return bundled ?? this.cachedOrFetched(path, `poets${path}.json`, (raw: RawPoem) => poemFromRaw(raw));
  }

  /** The recitations of a poem from Ganjoor's API (always live, not cached), in Ganjoor's order. */
  async recitations(poemId: number): Promise<Recitation[]> {
    const list = await this.fetchJSON<Recitation[]>(`${recitationsURL}/${poemId}/recitations`, `recitations of poem ${poemId}`);
    return list.map((item) => ({ ...item, xmlUrl: item.xmlUrl || undefined })).sort((a, b) => a.audioOrder - b.audioOrder);
  }

  private bundledBook(id: number): Promise<BundledBook> {
    let book = this.books.get(id);
    if (!book) {
      book = this.bundled.book(id);
      this.books.set(id, book);
      book.catch(() => this.books.delete(id));
    }
    return book;
  }

  /** The cached value if there is one; otherwise the file at `key` in ganjoor-data, converted and cached. */
  private async cachedOrFetched<Raw, Value>(path: string, key: string, convert: (raw: Raw) => Value): Promise<Value> {
    const cached = await this.cache?.read<Value>(key);
    if (cached) return cached;
    const value = convert(await this.fetchJSON<Raw>(`${dataURL}/${this.sha}/${key}`, path));
    await this.cache?.write(key, value);
    return value;
  }

  private async fetchJSON<T>(url: string, what: string): Promise<T> {
    const response = await this.fetcher(url);
    if (!response.ok) throw new PoetryError(response.status === 404 ? "notFound" : "badStatus", what, response.status);
    return (await response.json()) as T;
  }
}
