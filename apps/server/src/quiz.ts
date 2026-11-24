import type { DeckBook, DeckCouplet, DeckPoet, GameData } from "./gameData.js";
import { normalizeText, plain } from "./persian.js";

/** A small random generator that gives the same numbers for the same seed, the same as the phone's `SeededGenerator` (apps/ios Games/PersianLetters.swift). */
export function seededGenerator(seed: bigint) {
  let state = BigInt.asUintN(64, seed);
  const next = (): bigint => {
    state = BigInt.asUintN(64, state + 0x9e3779b97f4a7c15n);
    let z = state;
    z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    return z ^ (z >> 31n);
  };
  /** Fisher–Yates, as on the phone. */
  const shuffled = <T>(items: T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Number(next() % BigInt(i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  return { next, shuffled };
}
export type Generator = ReturnType<typeof seededGenerator>;

export type QuestionType = "second" | "poet" | "book";
/** A quiz question: a deck couplet, the option texts (shuffled) and the index of the right one. */
export type Question = { type: QuestionType; couplet: DeckCouplet; options: string[]; correct: number };

export const ROUNDS = 5;

/** The last two letters of a hemistich once normalised and without spaces. Two hemistichs with the same ending rhyme in a way that makes a guess hard. */
const ending = (text: string): string => normalizeText(text).replaceAll(" ", "").slice(-2);

/** حدس شاعر: the couplet's poet and three others, the poets of the same century first. */
function poetQuestion(couplet: DeckCouplet, poets: DeckPoet[], rng: Generator): Question | null {
  const own = poets.find((p) => p.slug === couplet.poet);
  if (!own) return null;
  const others = poets.filter((p) => p.slug !== own.slug && p.name !== own.name);
  const sameCentury = own.century === undefined ? [] : others.filter((p) => p.century === own.century);
  const rest = others.filter((p) => !sameCentury.includes(p));
  const names = new Set([own.name]);
  const chosen: DeckPoet[] = [];
  for (const poet of [...rng.shuffled(sameCentury), ...rng.shuffled(rest)]) {
    if (chosen.length >= 3) break;
    if (!names.has(poet.name)) {
      names.add(poet.name);
      chosen.push(poet);
    }
  }
  if (chosen.length < 3) return null;
  const options = rng.shuffled([own, ...chosen]);
  return { type: "poet", couplet, options: options.map((p) => p.name), correct: options.indexOf(own) };
}

/** مصراع دوم: the right second hemistich and two of the same poet's other couplets, the ones with the same ending first. */
function secondQuestion(couplet: DeckCouplet, pool: DeckCouplet[], rng: Generator): Question | null {
  const seen = new Set([normalizeText(couplet.m2)]);
  const rhyme = ending(couplet.m2);
  const same: DeckCouplet[] = [];
  const other: DeckCouplet[] = [];
  for (const candidate of pool) {
    if (candidate.poet !== couplet.poet || candidate.key === couplet.key) continue;
    const text = normalizeText(candidate.m2);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    (ending(candidate.m2) === rhyme ? same : other).push(candidate);
  }
  const wrong = [...rng.shuffled(same), ...rng.shuffled(other)].slice(0, 2);
  if (wrong.length < 2) return null;
  const options = rng.shuffled([couplet, ...wrong]);
  return { type: "second", couplet, options: options.map((c) => plain(c.m2)), correct: options.indexOf(couplet) };
}

/** از کدوم کتاب؟: the book of the couplet and up to two other curated books of its poet. */
function bookQuestion(couplet: DeckCouplet, books: DeckBook[], rng: Generator): Question | null {
  const own = books.filter((b) => b.poet === couplet.poet);
  const right = own.find((b) => b.path === couplet.book);
  if (own.length < 2 || !right) return null;
  const options = rng.shuffled([right, ...rng.shuffled(own.filter((b) => b.path !== right.path)).slice(0, 2)]);
  return { type: "book", couplet, options: options.map((b) => b.title), correct: options.indexOf(right) };
}

/** The five questions of a duel: five different couplets of the deck, each with a type picked at random (a couplet that cannot make that type is passed over). The same seed gives the same questions. */
export function makeQuestions(data: GameData, rng: Generator): Question[] {
  const types: QuestionType[] = ["second", "poet", "book"];
  const questions: Question[] = [];
  for (const couplet of rng.shuffled(data.deck)) {
    if (questions.length >= ROUNDS) break;
    const type = types[Number(rng.next() % 3n)]!;
    const made = type === "second" ? secondQuestion(couplet, data.deck, rng) : type === "poet" ? poetQuestion(couplet, data.poets, rng) : bookQuestion(couplet, data.books, rng);
    if (made) questions.push(made);
  }
  return questions;
}
