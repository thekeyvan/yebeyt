import type { IndexedPoem } from "./bookIndex";

/** «بیتِ امروز»: one couplet a day, the same all day, from the popular couplets of the bundled books (Home/DailyPick.swift). */
export type Candidate = { path: string; couplet: number };

/** The poems taken as popular: the most recited ones. */
export const poemLimit = 100;

// Primes above any candidate count (the list is cut below the smaller one): stepping by one of them visits every candidate
// before repeating. A new day steps by `dayStep`, a reject by `rejectStep`, so rejecting today's couplet does not show tomorrow's.
const rejectStep = 7919;
const dayStep = 7907;

/** The poems of the poets the person picked in onboarding (the first part of a poem's path is its poet), when there are any among `poems`; otherwise all of them. */
export function preferring(poets: ReadonlySet<string>, poems: IndexedPoem[]): IndexedPoem[] {
  if (poets.size === 0) return poems;
  const liked = poems.filter((poem) => poets.has(poem.path.split("/")[1] ?? ""));
  return liked.length === 0 ? poems : liked;
}

/** Every couplet of the most recited poems, most recited first (ties by path, so the order is stable). */
export function candidates(poems: IndexedPoem[]): Candidate[] {
  const popular = poems
    .filter((poem) => poem.recitations > 0)
    .sort((a, b) => b.recitations - a.recitations || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, poemLimit);
  return popular.flatMap((poem) => Array.from({ length: poem.couplets }, (_, couplet) => ({ path: poem.path, couplet }))).slice(0, dayStep - 1);
}

/** The candidate of a day after `rejected` «رد کن»s: each reject shows another candidate, and none repeats before every candidate has been shown. */
export function pick(day: number, rejected: number, from: Candidate[]): Candidate | undefined {
  const count = from.length;
  if (count === 0) return undefined;
  const start = ((((day % count) + count) % count) * (dayStep % count)) % count;
  return from[(start + rejected * (rejectStep % count)) % count];
}
