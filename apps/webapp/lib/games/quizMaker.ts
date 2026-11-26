import type { LibraryBook, LibraryPoet } from "../library/models";
import { normalize, plain } from "../library/normalize";
import { coupletId, type GameCouplet } from "./couplet";
import type { ListenClip, QuizKind, QuizOption, QuizQuestion } from "./quizQuestion";
import type { SeededGenerator } from "./seeded";

// Makes the questions of the quiz games (Games/QuizMaker.swift). Everything random goes through the generator, so a seed gives the same question again.

/** The last two letters of a hemistich once normalised and without spaces: «گوهرند» → «ند». Two hemistichs with the same ending rhyme in a way that makes a guess hard. */
export const ending = (text: string): string => [...normalize(text).replace(/\s/g, "")].slice(-2).join("");

const indexOfId = (options: QuizOption[], id: string): number => Math.max(0, options.findIndex((option) => option.id === id));

/** حدس شاعر: the couplet's poet and three others, the poets of the same century first, then any. */
export function poetQuestion(couplet: GameCouplet, poets: readonly LibraryPoet[], generator: SeededGenerator): QuizQuestion | undefined {
  const own = poets.find((poet) => poet.slug === couplet.poetSlug);
  if (!own) return undefined;
  const others = poets.filter((poet) => poet.slug !== own.slug && poet.name !== own.name);
  const sameCentury = own.century === undefined ? [] : others.filter((poet) => poet.century === own.century);
  const rest = others.filter((poet) => !sameCentury.includes(poet));
  const names = new Set([own.name]);
  const chosen: LibraryPoet[] = [];
  for (const poet of [...generator.shuffled(sameCentury), ...generator.shuffled(rest)]) {
    if (chosen.length >= 3) break;
    if (!names.has(poet.name)) {
      names.add(poet.name);
      chosen.push(poet);
    }
  }
  if (chosen.length !== 3) return undefined;
  const options = generator.shuffled([own, ...chosen]).map((poet) => ({ id: poet.slug, title: poet.name }));
  return { kind: "poet", couplet, options, correct: indexOfId(options, own.slug) };
}

/** The word «یه کلمه» shows: one of three letters or more when there is one. */
function hintWord(text: string, generator: SeededGenerator): number {
  const words = text.split(/\s+/).filter(Boolean);
  const long = words.flatMap((word, index) => ([...normalize(word)].length >= 3 ? index : []));
  const candidates = long.length === 0 ? words.map((_, index) => index) : long;
  return candidates.length === 0 ? 0 : generator.shuffled(candidates)[0]!;
}

/** مصراع دوم (and گوش کن, with a clip): the right second hemistich and two of the same poet's other couplets, the ones with the same ending first. */
export function secondQuestion(couplet: GameCouplet, pool: readonly GameCouplet[], generator: SeededGenerator, kind: QuizKind = "misra", clip?: ListenClip): QuizQuestion | undefined {
  const seen = new Set([normalize(couplet.m2)]);
  const rhyme = ending(couplet.m2);
  const same: GameCouplet[] = [];
  const other: GameCouplet[] = [];
  for (const candidate of pool) {
    if (candidate.poetSlug !== couplet.poetSlug || coupletId(candidate) === coupletId(couplet)) continue;
    const key = normalize(candidate.m2);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    (ending(candidate.m2) === rhyme ? same : other).push(candidate);
  }
  const wrong = [...generator.shuffled(same), ...generator.shuffled(other)].slice(0, 2);
  if (wrong.length !== 2) return undefined;
  const options = generator.shuffled([couplet, ...wrong]).map((item) => ({ id: coupletId(item), title: plain(item.m2) }));
  const correct = indexOfId(options, coupletId(couplet));
  const question: QuizQuestion = { kind, couplet, options, correct };
  if (clip) {
    question.clip = clip;
    question.hintWord = hintWord(options[correct]!.title, generator);
  }
  return question;
}

/** گوش کن: a مصراع دوم question that also plays the first hemistich. */
export const listenQuestion = (couplet: GameCouplet, pool: readonly GameCouplet[], clip: ListenClip, generator: SeededGenerator): QuizQuestion | undefined =>
  secondQuestion(couplet, pool, generator, "listen", clip);

/** از کدوم کتاب؟: the book of the couplet and up to two other books of its poet (curated books). */
export function bookQuestion(couplet: GameCouplet, books: readonly LibraryBook[], generator: SeededGenerator): QuizQuestion | undefined {
  const own = books.filter((book) => book.poet === couplet.poetSlug);
  const right = own.find((book) => book.path === couplet.bookPath);
  if (own.length < 2 || !right) return undefined;
  const wrong = generator.shuffled(own.filter((book) => book.path !== right.path)).slice(0, 2);
  const options = generator.shuffled([right, ...wrong]).map((book) => ({ id: book.path, title: book.title }));
  return { kind: "book", couplet, options, correct: indexOfId(options, right.path) };
}
