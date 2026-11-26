import type { Library } from "../library/library";
import type { Poem } from "../poetry/models";
import type { GameCouplet } from "./couplet";
import { entryId, type GlossaryEntry } from "./matchGlossary";
import { MatchRound, questionCount } from "./matchRound";
import type { SeededGenerator } from "./seeded";

/**
 * A round of معنی‌یاب: five couplets of the glossary; their text comes from the poems (Games/MatchScreen.swift `begin`). Ten entries are tried, so a poem that
 * can't be loaded is just left out; undefined when nothing can be played.
 */
export async function makeMatchRound(entries: readonly GlossaryEntry[], poem: (path: string) => Promise<Poem>, library: Library, generator: SeededGenerator): Promise<MatchRound | undefined> {
  const candidates = generator.shuffled(entries).slice(0, questionCount * 2);
  const couplets = new Map<string, GameCouplet>();
  await Promise.all(
    candidates.map(async (entry) => {
      const line = (await poem(entry.path).catch(() => undefined))?.couplets[entry.couplet];
      if (!line) return;
      const poetSlug = entry.path.split("/")[1] ?? "";
      const book = library.bookContaining(entry.path);
      couplets.set(entryId(entry), {
        poem: entry.path,
        index: entry.couplet,
        m1: line.m1,
        m2: line.m2,
        meaning: line.meaning,
        poetSlug,
        poetName: library.poet(poetSlug)?.name ?? "",
        bookTitle: book?.title ?? "",
        bookPath: book?.path ?? "",
        meaningIsAI: line.ai === true,
      });
    }),
  );
  return MatchRound.make(candidates, (entry) => couplets.get(entryId(entry)), generator);
}
