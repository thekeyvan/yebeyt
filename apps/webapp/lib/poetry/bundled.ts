import type { BundledBook, Book, PoetsFile, Poem } from "./models";
import type { BundledSource } from "./store";

/** A bundled book file: the book's own fields, and the full text of every poem (`BundledBook` in Poetry/Models.swift reads `poems` twice). */
type BundledFile = Omit<Book, "poems" | "children"> & { poems: Poem[]; children?: Book["children"] };

export function bundledBook({ poems, children = [], ...book }: BundledFile): BundledBook {
  return { book: { ...book, children, poems: poems.map(({ id, title, path }) => ({ id, title, path })) }, poems };
}

/** The bundled files as the browser gets them: copied into /data when the app is built (scripts/copy-data.mjs). */
export function browserBundled(base = "/data"): BundledSource {
  async function load<T>(name: string): Promise<T> {
    const response = await fetch(`${base}/${name}.json`);
    if (!response.ok) throw new Error(`missing bundled file ${name}`);
    return (await response.json()) as T;
  }
  return {
    poets: () => load<PoetsFile>("poets"),
    book: async (id) => bundledBook(await load<BundledFile>(`book-${id}`)),
  };
}
