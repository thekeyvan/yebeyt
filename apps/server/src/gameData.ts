import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const deckSchema = z.array(
  z.object({
    poem: z.string(),
    index: z.number().int(),
    m1: z.string(),
    m2: z.string(),
    meaning: z.string(),
    poet: z.string(),
    book: z.string().optional(),
    bookTitle: z.string(),
  }),
);
const librarySchema = z.object({
  poets: z.array(z.object({ slug: z.string(), name: z.string(), century: z.string().optional() })),
  books: z.array(z.object({ path: z.string(), title: z.string(), poet: z.string() })),
});
const poetsSchema = z.object({ source: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/) }) });

/** A well-known couplet of the game deck. `key` is "<poem>#<index>", as everywhere. */
export type DeckCouplet = { key: string; poem: string; index: number; m1: string; m2: string; meaning: string; poet: string; book: string; bookTitle: string };
export type DeckPoet = { slug: string; name: string; century: string | undefined };
export type DeckBook = { path: string; title: string; poet: string };

/** What the games need from the phone's bundled data: the deck, the poets and curated books the questions draw from, and the ganjoor-data commit the poems come from. */
export type GameData = {
  deck: DeckCouplet[];
  byKey: Map<string, DeckCouplet>;
  poets: DeckPoet[];
  books: DeckBook[];
  sha: string;
};

/** The files are copied into `apps/server/data` when the image is built; without that folder (local runs) they are read where the app keeps them. */
const IMAGE_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const APP_DIR = fileURLToPath(new URL("../../ios/Yebeyt/Resources/Data/", import.meta.url));

export function loadGameData(dir = existsSync(IMAGE_DIR) ? IMAGE_DIR : APP_DIR): GameData {
  const read = (name: string): unknown => JSON.parse(readFileSync(`${dir}/${name}`, "utf8"));
  const deck = deckSchema.parse(read("games.json")).map(({ book, ...c }) => ({ ...c, key: `${c.poem}#${c.index}`, book: book ?? "" }));
  const library = librarySchema.parse(read("library.json"));
  return {
    deck,
    byKey: new Map(deck.map((c) => [c.key, c])),
    poets: library.poets.map((p) => ({ slug: p.slug, name: p.name, century: p.century })),
    books: library.books,
    sha: poetsSchema.parse(read("poets.json")).source.sha,
  };
}
