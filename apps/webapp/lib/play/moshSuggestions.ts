import type { DivanEntry } from "../me/divanLogic";
import { normalize } from "../library/normalize";
import type { CoupletEntry } from "../library/search";
import type { Couplet } from "../poetry/models";
import { firstLetter } from "./moshLetters";

/** A couplet that can be played in مشاعره: from the divan or from a bundled book. */
export type MoshCandidate = {
  key: string;
  couplet: Couplet;
  poetSlug: string;
  /** «غزل ۳» */
  title: string;
  inDivan: boolean;
  /** Both hemistichs, normalised. */
  text: string;
};

export const candidateOfDivan = (entry: DivanEntry): MoshCandidate => ({ key: entry.key, couplet: entry.couplet, poetSlug: entry.poetSlug, title: entry.title, inDivan: true, text: normalize(`${entry.couplet.m1} ${entry.couplet.m2}`) });

export const candidateOfBook = (entry: CoupletEntry): MoshCandidate => ({ key: entry.id, couplet: entry.couplet, poetSlug: entry.poet, title: entry.title, inDivan: false, text: entry.text });

/** What typed text was found to be. */
export type Match =
  | { kind: "found"; candidate: MoshCandidate }
  /** No couplet of the divan or the books starts with these words. */
  | { kind: "notFound" }
  /** A couplet was found, but it doesn't start with the letter to answer. */
  | { kind: "wrongLetter" }
  /** It was found, and it was played already. */
  | { kind: "alreadyPlayed" };

type Sources = { divan: readonly DivanEntry[]; books: readonly CoupletEntry[]; used: ReadonlySet<string> };

/**
 * The couplets to pick from: those whose first hemistich starts with `letter` (any, for the first couplet of the game) and, once something is typed, with those
 * words; not played yet. The divan first (the newest first), then the books' by how often they are recited (Play/MoshSuggestions.swift).
 */
export function suggestions({ letter, typed, divan, books, used, limit }: Sources & { letter?: string; typed: string; limit: number }): MoshCandidate[] {
  const prefix = normalize(typed);
  const result: MoshCandidate[] = [];
  for (const entry of divan) {
    const candidate = candidateOfDivan(entry);
    if (!used.has(candidate.key) && (letter === undefined || firstLetter(candidate.couplet.m1) === letter) && candidate.text.startsWith(prefix)) result.push(candidate);
    if (result.length === limit) return result;
  }
  // A letter's couplets are many: the cheap tests (letter, key) come before the building of each candidate.
  const inDivan = new Set(divan.map((entry) => entry.key));
  const found = books
    .map((entry, offset) => ({ entry, offset }))
    .filter(({ entry }) => !used.has(entry.id) && !inDivan.has(entry.id) && (letter === undefined || firstLetter(entry.couplet.m1) === letter) && entry.text.startsWith(prefix));
  found.sort((a, b) => b.entry.popularity - a.entry.popularity || a.offset - b.offset);
  return [...result, ...found.slice(0, limit - result.length).map(({ entry }) => candidateOfBook(entry))];
}

/**
 * Typed text as a couplet. The text must give the whole first hemistich (and may go on into the second); spelling is compared as the server does (diacritics,
 * punctuation and Arabic letter forms don't count).
 */
export function match(typed: string, { letter, divan, books, used }: Sources & { letter?: string }): Match {
  const wanted = normalize(typed);
  if (wanted === "") return { kind: "notFound" };
  const all = [...divan.map(candidateOfDivan), ...[...books].sort((a, b) => b.popularity - a.popularity).map(candidateOfBook)];
  let played = false;
  let wrong = false;
  for (const candidate of all) {
    if (!candidate.text.startsWith(wanted) || [...wanted].length < [...normalize(candidate.couplet.m1)].length) continue;
    if (used.has(candidate.key)) played = true;
    else if (letter !== undefined && firstLetter(candidate.couplet.m1) !== letter) wrong = true;
    else return { kind: "found", candidate };
  }
  return played ? { kind: "alreadyPlayed" } : wrong ? { kind: "wrongLetter" } : { kind: "notFound" };
}
