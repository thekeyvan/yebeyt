import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { bundledBook } from "./bundled";
import type { PoetsFile } from "./models";
import { PoetryStore } from "./store";

const folder = join(process.cwd(), "public", "data");
const read = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(folder, `${name}.json`), "utf8")) as T;

let store: Promise<PoetryStore> | undefined;

/** The server's own store, for the titles of a page's metadata: the bundled files from disk, the rest from ganjoor-data (a day's cache). */
export function serverStore(): Promise<PoetryStore> {
  store ??= PoetryStore.open({
    bundled: { poets: () => read<PoetsFile>("poets"), book: async (id) => bundledBook(await read(`book-${id}`)) },
    fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 86_400 } }),
  }).catch((error: unknown) => {
    store = undefined;
    throw error;
  });
  return store;
}
