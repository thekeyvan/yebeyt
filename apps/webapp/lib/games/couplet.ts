/** Where a گوش کن clip of a deck couplet starts and ends, in seconds of recitation `recitation`'s mp3: measured at data-build time (tools/ganjoor/clips.py) as the real silence after the first hemistich. Only good for that recitation. */
export type ListenRange = { recitation: number; start: number; end: number };

/** A couplet in a game: from the deck, or from a poem the reader has open (Games/GameDeck.swift). */
export type GameCouplet = {
  poem: string;
  /** 0-based, as in the reader. */
  index: number;
  m1: string;
  m2: string;
  /** What the couplet means, when Ganjoor has a note; the after-answer sheet shows it. */
  meaning?: string;
  poetSlug: string;
  /** The poet's short name. */
  poetName: string;
  bookTitle: string;
  /** The curated book's path (`/moulavi/masnavi`): its title and colour are in library.json. Empty for a couplet of a poem the reader has open. */
  bookPath: string;
  /** The meaning was written by an AI: the sheet shows the sparkle by its heading. */
  meaningIsAI: boolean;
  /** گوش کن, a Hafez couplet of the deck: where its clip really ends (none: the margin rule of `ListenClipRange` decides). */
  listenRange?: ListenRange;
};

/** «/saadi/golestan/sh1#0»: what the server accepts in a challenge. */
export const coupletId = (couplet: Pick<GameCouplet, "poem" | "index">): string => `${couplet.poem}#${couplet.index}`;

/** «سعدی · گلستان» */
export const sourceOf = (couplet: Pick<GameCouplet, "poetName" | "bookTitle">): string =>
  couplet.bookTitle === "" ? couplet.poetName : `${couplet.poetName} · ${couplet.bookTitle}`;

/** The poet's name when every couplet is by the same poet («۱۰ بیت سعدی»). */
export function singlePoet(couplets: readonly GameCouplet[]): string | undefined {
  return new Set(couplets.map((couplet) => couplet.poetSlug)).size === 1 ? couplets[0]!.poetName : undefined;
}

/** The well-known couplets the games draw from: games.json, written by tools/ganjoor/build.py. It never changes. */
export class GameDeck {
  /** The keys of the couplets (`coupletId`). */
  readonly keys: ReadonlySet<string>;

  constructor(readonly couplets: readonly GameCouplet[]) {
    this.keys = new Set(couplets.map(coupletId));
  }
}

/** One entry of games.json. */
type Entry = { poem: string; index: number; m1: string; m2: string; meaning: string; ai?: boolean; poet: string; book?: string; bookTitle: string; clip?: ListenRange | null };

/** The deck from the text of games.json; `poetNames` maps a poet's slug to the short name shown next to the couplet. */
export function parseDeck(entries: unknown, poetNames: (slug: string) => string | undefined): GameDeck {
  if (!Array.isArray(entries)) throw new Error("games.json is not a list");
  return new GameDeck(
    (entries as Entry[]).map((entry) => ({
      poem: entry.poem,
      index: entry.index,
      m1: entry.m1,
      m2: entry.m2,
      meaning: entry.meaning,
      poetSlug: entry.poet,
      poetName: poetNames(entry.poet) ?? "",
      bookTitle: entry.bookTitle,
      bookPath: entry.book ?? "",
      meaningIsAI: entry.ai === true,
      listenRange: entry.clip ?? undefined,
    })),
  );
}
