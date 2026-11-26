import type { Poem } from "../poetry/models";
import type { DivanItem } from "../reader/divan";
import { shortTitle } from "../reader/text";
import type { DivanEntry } from "./divanLogic";

/**
 * The kept couplets of the divan as entries (Me/Divan/DivanModel.swift): the text comes from the poems (bundled, or cached once read), so a couplet whose
 * poem can't be loaded is left out of the lists (it stays kept).
 */
export class DivanModel {
  constructor(private readonly poem: (path: string) => Promise<Poem>) {}

  /** The entries for `items` (the kept ones, as `ReaderMarks.keptItems`), the newest first. */
  async load(items: readonly DivanItem[]): Promise<DivanEntry[]> {
    const poems = new Map<string, Poem | undefined>();
    const entries: DivanEntry[] = [];
    for (const item of items) {
      const hash = item.key.lastIndexOf("#");
      const index = Number(item.key.slice(hash + 1));
      if (hash < 0 || !Number.isInteger(index)) continue;
      const path = item.key.slice(0, hash);
      if (!poems.has(path)) poems.set(path, await this.poem(path).catch(() => undefined));
      const poem = poems.get(path);
      const couplet = poem?.couplets[index];
      if (!poem || !couplet) continue;
      entries.push({ key: item.key, path, index, couplet, poetSlug: path.split("/").find((part) => part !== "") ?? "", title: shortTitle(poem.title), keptAt: item.keptAt ?? 0 });
    }
    return entries.sort((a, b) => b.keptAt - a.keptAt || (a.key < b.key ? -1 : 1));
  }
}
