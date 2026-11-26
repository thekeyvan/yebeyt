import { shortTitle } from "../reader/text";
import type { PoetryStore } from "../poetry/store";
import type { HomeSource } from "./home";
import type { BookIndexes } from "./indexes";
import type { Library } from "./library";
import { CoupletCorpus } from "./search";

type Indexes = Pick<BookIndexes, "index">;

/** Where today's couplet comes from (`Library.indexedPoems(coveringAny:)` and `HomeModel.show`): the poems of the bundled books, and one of their couplets. */
export function homeSource(library: Library, indexes: Indexes, poetry: PoetryStore): HomeSource {
  const paths = poetry.bundledPaths;
  return {
    async poems() {
      const lists = await Promise.all(
        library.booksCovering(paths).map((book) =>
          indexes.index(book).then(
            ({ poems }) => poems.filter((poem) => paths.some((path) => poem.path.startsWith(`${path}/`))),
            () => [],
          ),
        ),
      );
      return lists.flat();
    },
    async pick({ path, couplet }) {
      const poem = await poetry.poem(path).catch(() => undefined);
      const found = poem?.couplets[couplet];
      if (!poem || !found) return undefined;
      return { path, index: couplet, couplet: found, poet: library.poet(path.split("/")[1] ?? "")?.name ?? "", title: shortTitle(poem.title) };
    },
  };
}

/** Every couplet of the bundled books with the popularity of its poem, for search and the moods (`CorpusStore`). */
export async function loadCorpus(library: Library, indexes: Indexes, poetry: PoetryStore): Promise<CoupletCorpus> {
  const paths = poetry.bundledPaths;
  const [poems, lists] = await Promise.all([
    poetry.bundledPoems(),
    Promise.all(library.booksCovering(paths).map((book) => indexes.index(book).then(({ poems }) => poems, () => []))),
  ]);
  const popularity: Record<string, number> = {};
  for (const row of lists.flat()) popularity[row.path] = row.recitations;
  return new CoupletCorpus(poems, popularity);
}
