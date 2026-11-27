import type { Couplet } from "../poetry/models";
import type { PoetryStore } from "../poetry/store";
import { shortTitle } from "../reader/text";
import { parseCoupletKey } from "./copy";

/** A couplet found by its key: the text and the words around it (Messages/CoupletResolver.swift). */
export type ResolvedCouplet = {
  key: string;
  path: string;
  /** 0-based, as in the reader. */
  index: number;
  couplet: Couplet;
  poetSlug: string;
  /** The poet's short name. */
  poetName: string;
  /** «غزل ۳» */
  title: string;
};

/** «حافظ · غزل ۳» */
export const sourceOf = ({ poetName, title }: Pick<ResolvedCouplet, "poetName" | "title">): string => `${poetName} · ${title}`;

type Poems = Pick<PoetryStore, "poem" | "poetOf">;

/**
 * Finds the couplets that messages and shared divans name by key. The server holds no poem text: the page reads the poem (bundled, or cached once read) and keeps
 * what it found.
 */
export class CoupletResolver {
  private readonly found = new Map<string, ResolvedCouplet>();

  constructor(private readonly store: () => Promise<Poems>) {}

  /** Undefined when the key is not a couplet of a poem the page can load (no network and not cached). */
  async resolve(key: string): Promise<ResolvedCouplet | undefined> {
    const known = this.found.get(key);
    if (known) return known;
    const parsed = parseCoupletKey(key);
    if (!parsed) return undefined;
    try {
      const store = await this.store();
      const poem = await store.poem(parsed.path);
      const couplet = poem.couplets[parsed.index];
      if (!couplet) return undefined;
      const poet = store.poetOf(parsed.path);
      const resolved = { key, path: parsed.path, index: parsed.index, couplet, poetSlug: poet?.slug ?? "", poetName: poet?.nickname ?? "", title: shortTitle(poem.title) };
      this.found.set(key, resolved);
      return resolved;
    } catch {
      return undefined;
    }
  }
}
