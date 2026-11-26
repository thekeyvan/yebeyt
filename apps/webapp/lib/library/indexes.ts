import { BookIndex, type IndexRow } from "./bookIndex";
import type { LibraryBook } from "./models";

/** The poem indexes of the books, each loaded when first asked for and kept (`Library.index(of:)`). `load` reads `index-<id>` as parsed JSON. */
export class BookIndexes {
  private readonly loaded = new Map<number, Promise<BookIndex>>();

  constructor(private readonly load: (name: string) => Promise<unknown>) {}

  index(book: LibraryBook): Promise<BookIndex> {
    let index = this.loaded.get(book.id);
    if (!index) {
      index = this.load(`index-${book.id}`).then((file) => BookIndex.parse(file as { poems: IndexRow[] }, book));
      this.loaded.set(book.id, index);
      index.catch(() => this.loaded.delete(book.id));
    }
    return index;
  }
}
