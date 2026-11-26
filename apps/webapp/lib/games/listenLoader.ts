import type { Poem, Recitation } from "../poetry/models";
import { RecitationTiming } from "../reader/timing";
import type { GameCouplet, GameDeck } from "./couplet";
import { clipEnd, listenClipRange } from "./listenClipRange";
import { listenQuestion } from "./quizMaker";
import type { ListenClip, QuizQuestion } from "./quizQuestion";
import type { SeededGenerator } from "./seeded";

/** The three things گوش کن asks Ganjoor, given as functions so tests can stub them (Games/ListenLoader.swift). */
export type ListenLoader = {
  poem: (path: string) => Promise<Poem>;
  recitations: (poemId: number) => Promise<Recitation[]>;
  /** The timing file's text. */
  timing: (url: string) => Promise<string>;
};

/** Poems tried at once; more are tried only when these did not give enough questions. */
const batch = 6;

/**
 * Finds what گوش کن plays: for a couplet of a Hafez poem, the first recitation that is in sync with the text and the seconds its first hemistich is read:
 * as measured at data-build time when the deck has it for that recitation, else from the timing file (`clipEnd` stops it before the next hemistich).
 * Undefined when the poem has no recitation in sync, or anything could not be loaded.
 */
export async function clipFor(loader: ListenLoader, couplet: GameCouplet): Promise<ListenClip | undefined> {
  let poem: Poem;
  let recitation: Recitation | undefined;
  try {
    poem = await loader.poem(couplet.poem);
    recitation = (await loader.recitations(poem.id)).find((item) => item.inSyncWithText && item.xmlUrl);
  } catch {
    return undefined;
  }
  if (!recitation?.xmlUrl) return undefined;
  const measured = couplet.listenRange;
  if (measured && measured.recitation === recitation.id) return { audio: recitation.mp3Url, start: measured.start, end: measured.end, fade: listenClipRange.measuredFade };
  try {
    const range = RecitationTiming.parse(await loader.timing(recitation.xmlUrl)).firstHemistich(couplet.index, poem.couplets);
    return range && { audio: recitation.mp3Url, start: range[0], end: clipEnd(range[0], range[1]), fade: listenClipRange.fade };
  } catch {
    return undefined;
  }
}

/** Up to `count` questions from the Hafez couplets of the deck, one for each poem that has a clip. */
export async function listenQuestions(loader: ListenLoader, deck: GameDeck, count: number, generator: SeededGenerator): Promise<QuizQuestion[]> {
  const hafez = deck.couplets.filter((couplet) => couplet.poetSlug === "hafez");
  const seenPoems = new Set<string>();
  const candidates = generator.shuffled(hafez).filter((couplet) => !seenPoems.has(couplet.poem) && seenPoems.add(couplet.poem));
  const questions: QuizQuestion[] = [];
  for (let next = 0; questions.length < count && next < candidates.length; next += batch) {
    const group = candidates.slice(next, next + batch);
    const clips = await Promise.all(group.map((couplet) => clipFor(loader, couplet)));
    for (const [offset, couplet] of group.entries()) {
      const clip = clips[offset];
      const question = clip && questions.length < count ? listenQuestion(couplet, hafez, clip, generator) : undefined;
      if (question) questions.push(question);
    }
  }
  return questions;
}
