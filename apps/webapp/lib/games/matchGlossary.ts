import { normalize } from "../library/normalize";

// glossary.json, written by tools/ganjoor/build.py (Games/MatchGlossary.swift): it checked that every word is in its couplet.

/** One hard word of a couplet and what it means. `m` is the hemistich (1 or 2); `text` is one or more whole words of it. */
export type GlossaryWord = { text: string; m: number; gloss: string };

/** The hard words of one couplet; `couplet` is 0-based, as in the reader. */
export type GlossaryEntry = { path: string; couplet: number; words: GlossaryWord[] };

export const entryId = (entry: Pick<GlossaryEntry, "path" | "couplet">): string => `${entry.path}#${entry.couplet}`;

/** The entries of the text of glossary.json. */
export function parseGlossary(file: unknown): GlossaryEntry[] {
  const entries = (file as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) throw new Error("glossary.json has no entries");
  return entries as GlossaryEntry[];
}

/**
 * Finding glossed words in a hemistich: text is matched after normalisation (no diacritics, ي→ی, ك→ک, half-space → space), whole words only. Gives the
 * words of the hemistich as written, and for each text the words it covers as `[from, to)` (undefined when it is not there).
 */
export function locate(texts: readonly string[], hemistich: string): { tokens: string[]; ranges: ([number, number] | undefined)[] } {
  const tokens = hemistich.split(/\s+/).filter(Boolean);
  // A written word can hold several normalised ones («گل‌گشت»): each remembers the written word it is part of.
  const flat = tokens.flatMap((token, index) => normalize(token).split(" ").filter(Boolean).map((word) => ({ word, token: index })));
  const ranges = texts.map((text): [number, number] | undefined => {
    const wanted = normalize(text).split(" ").filter(Boolean);
    if (wanted.length === 0 || wanted.length > flat.length) return undefined;
    for (let start = 0; start <= flat.length - wanted.length; start++) {
      if (wanted.every((word, offset) => flat[start + offset]!.word === word)) return [flat[start]!.token, flat[start + wanted.length - 1]!.token + 1];
    }
    return undefined;
  });
  return { tokens, ranges };
}
