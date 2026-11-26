import type { Mood } from "../library/models";
import { normalize } from "../library/normalize";
import type { Couplet } from "../poetry/models";

/** One kept couplet of the divan with what the cards and the groups need: its text, poet and short title (Me/Divan/DivanLogic.swift `DivanEntry`). */
export type DivanEntry = {
  key: string;
  path: string;
  /** 0-based, as in the reader. */
  index: number;
  couplet: Couplet;
  poetSlug: string;
  /** «غزل ۳» */
  title: string;
  keptAt: number;
};

/** How the divan is split: by poet, by topic (the first mood the couplet matches) or one list, newest first. */
export type DivanGrouping = "poet" | "topic" | "newest";

/** The groupings in the order of the control, with their names. */
export const groupings: readonly { value: DivanGrouping; label: string }[] = [
  { value: "poet", label: "شاعر" },
  { value: "topic", label: "موضوع" },
  { value: "newest", label: "تازه‌ترین" },
];

export type DivanSection = {
  id: string;
  /** Empty for the one list of «تازه‌ترین», which has no header. */
  title: string;
  /** Set for a poet's section. */
  poetSlug?: string;
  entries: DivanEntry[];
};

/** The title of the topic group for couplets that match no mood. */
export const restTitle = "بقیه";

/** The newest first; the same time by key. */
const newestFirst = (a: DivanEntry, b: DivanEntry): number => b.keptAt - a.keptAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** The entries matching `query` (a word of the couplet or the poet's name, after normalising; an empty query keeps all) and `poet` (undefined keeps all), newest first. */
export function filterEntries(entries: readonly DivanEntry[], query: string, poet: string | undefined, poetName: (slug: string) => string): DivanEntry[] {
  const wanted = normalize(query);
  return entries
    .filter((entry) => poet === undefined || entry.poetSlug === poet)
    .filter((entry) => wanted === "" || normalize(`${entry.couplet.m1} ${entry.couplet.m2} ${poetName(entry.poetSlug)}`).includes(wanted))
    .sort(newestFirst);
}

/** The poets of the divan with their counts, the most first (equal counts by slug). */
export function poetCounts(entries: readonly DivanEntry[]): { slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { poetSlug } of entries) counts.set(poetSlug, (counts.get(poetSlug) ?? 0) + 1);
  return [...counts].map(([slug, count]) => ({ slug, count })).sort((a, b) => b.count - a.count || (a.slug < b.slug ? -1 : 1));
}

export function groupSections(entries: readonly DivanEntry[], grouping: DivanGrouping, moods: readonly Mood[], poetName: (slug: string) => string): DivanSection[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort(newestFirst);
  if (grouping === "newest") return [{ id: "newest", title: "", entries: sorted }];
  if (grouping === "poet") {
    return poetCounts(sorted).map(({ slug }) => ({ id: slug, title: poetName(slug), poetSlug: slug, entries: sorted.filter((entry) => entry.poetSlug === slug) }));
  }
  const words = moods.map((mood) => ({ mood, words: mood.words.map(normalize).filter((word) => word !== "") }));
  const groups = new Map<string, DivanEntry[]>();
  for (const entry of sorted) {
    const text = normalize(`${entry.couplet.m1} ${entry.couplet.m2}`);
    const key = words.find(({ words: list }) => list.some((word) => text.includes(word)))?.mood.key ?? restTitle;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...moods.map((mood) => ({ key: mood.key, title: mood.title })), { key: restTitle, title: restTitle }].flatMap(({ key, title }) => {
    const found = groups.get(key);
    return found ? [{ id: key, title, entries: found }] : [];
  });
}
