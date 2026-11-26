import type { LibraryBook, LibraryPoet } from "../library/models";
import type { GameCouplet, GameDeck } from "./couplet";
import { bookQuestion, poetQuestion, secondQuestion } from "./quizMaker";
import { QuizRound } from "./quizRound";
import type { QuizKind, QuizQuestion } from "./quizQuestion";
import type { SeededGenerator } from "./seeded";

export const questionCount = 10;

/** A round of مصراع دوم of one poet needs the poet's couplet and two others to choose from. */
export const hasRound = (deck: GameDeck, poet: string): boolean => deck.couplets.filter((couplet) => couplet.poetSlug === poet).length >= 3;

function make(kind: QuizKind, couplets: readonly GameCouplet[], generator: SeededGenerator, question: (couplet: GameCouplet) => QuizQuestion | undefined): QuizRound | undefined {
  const questions: QuizQuestion[] = [];
  for (const couplet of generator.shuffled(couplets)) {
    if (questions.length >= questionCount) break;
    const made = question(couplet);
    if (made) questions.push(made);
  }
  return QuizRound.of(kind, questions);
}

/** حدس شاعر: ten couplets of the deck. */
export const poetRound = (deck: GameDeck, poets: readonly LibraryPoet[], generator: SeededGenerator): QuizRound | undefined =>
  make("poet", deck.couplets, generator, (couplet) => poetQuestion(couplet, poets, generator));

/** مصراع دوم: ten couplets of the deck, or of one poet only (a poet with few couplets gets a shorter round). */
export function secondRound(deck: GameDeck, only: string | undefined, generator: SeededGenerator): QuizRound | undefined {
  const pool = only === undefined ? deck.couplets : deck.couplets.filter((couplet) => couplet.poetSlug === only);
  return make("misra", pool, generator, (couplet) => secondQuestion(couplet, pool, generator));
}

/** از کدوم کتاب؟: ten couplets of poets with two or more curated books. */
export const bookRound = (deck: GameDeck, books: readonly LibraryBook[], generator: SeededGenerator): QuizRound | undefined =>
  make("book", deck.couplets, generator, (couplet) => bookQuestion(couplet, books, generator));
