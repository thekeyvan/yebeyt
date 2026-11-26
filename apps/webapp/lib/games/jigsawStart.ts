import type { Poem } from "../poetry/models";
import { isValidPath } from "../poetry/store";
import type { GameCouplet } from "./couplet";

/** Where a جورچین round starts (Games/JigsawStart.swift): the deck, «بازی با این بیت» (that couplet first), or «بازی با این غزل» (that poem's couplets first). */
export type JigsawStart = { kind: "deck" } | { kind: "couplet"; poem: string; index: number } | { kind: "poem"; poem: string };

export const deckStart: JigsawStart = { kind: "deck" };

/** The page of the round: `/games/jigsaw?poem=/hafez/ghazal/sh3&c=2` (`c` is the 0-based couplet), or without `c` for the whole poem. */
export function jigsawURL(start: JigsawStart): string {
  if (start.kind === "deck") return "/games/jigsaw";
  const query = new URLSearchParams({ poem: start.poem });
  if (start.kind === "couplet") query.set("c", String(start.index));
  return `/games/jigsaw?${query}`;
}

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** The start an address asks for; anything that is not a poem path is the deck, and a `c` that is not a number is the whole poem. */
export function parseStart(query: Query): JigsawStart {
  const poem = first(query.poem);
  if (poem === undefined || !isValidPath(poem)) return deckStart;
  const index = first(query.c);
  return index !== undefined && /^\d{1,4}$/.test(index) ? { kind: "couplet", poem, index: Number(index) } : { kind: "poem", poem };
}

/** The couplets of `poem` the round starts with: the one asked for (none when the poem has no such couplet), or all of them in order; the round keeps the playable ones. */
export function openingCouplets(start: JigsawStart, poem: Poem, poet: { slug: string; name: string }, bookTitle: string): GameCouplet[] {
  const all = poem.couplets.map(
    (couplet, index): GameCouplet => ({
      poem: poem.path,
      index,
      m1: couplet.m1,
      m2: couplet.m2,
      meaning: couplet.meaning,
      poetSlug: poet.slug,
      poetName: poet.name,
      bookTitle,
      meaningIsAI: couplet.ai === true,
    }),
  );
  if (start.kind === "deck") return [];
  return start.kind === "poem" ? all : all.slice(start.index, start.index + 1);
}
