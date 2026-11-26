import type { LibraryBook, LibraryPoet } from "../lib/library/models";
import { GameDeck, type GameCouplet } from "../lib/games/couplet";
import type { QuizKind, QuizQuestion } from "../lib/games/quizQuestion";

/** Poets, books and couplets for the quiz games, built in code so the rules are tested on known data (`QuizFixtures` in the phone's tests). */
export const poets: LibraryPoet[] = [
  ["saadi", "سعدی", "قرن هفتم"],
  ["moulavi", "مولانا", "قرن هفتم"],
  ["eraghi", "عراقی", "قرن هفتم"],
  ["khosro", "امیرخسرو", "قرن هفتم"],
  ["hafez", "حافظ", "قرن هشتم"],
  ["khayyam", "خیام", "قرن پنجم"],
  ["attar", "عطار", "قرن ششم"],
  ["nezami", "نظامی", "قرن ششم"],
].map(([slug, name, century], id) => ({ id, slug: slug!, name: name!, tag: "", century, color: "lapis", bio: "" }));

export const book = (path: string, poet: string): LibraryBook => ({
  id: path.length,
  path,
  title: `کتاب ${path}`,
  poet,
  type: "divan",
  color: "fire",
  blurb: "",
  count: 1,
  recited: false,
  unit: "غزل",
});

export const ends = ["ند", "ار", "ان", "ید", "را", "ست"];

/** The couplets of one poet: the second hemistichs have different last letters in turn. */
export const couplets = (poet: string, count: number, bookPath = ""): GameCouplet[] =>
  Array.from({ length: count }, (_, number) => ({
    poem: `/${poet}/p${Math.floor(number / 3)}`,
    index: number % 3,
    m1: `مصراع اول ${poet} ${number}`,
    m2: `مصراع دوم ${number} گوهر${ends[number % ends.length]}`,
    meaning: "معنی",
    poetSlug: poet,
    poetName: poets.find((item) => item.slug === poet)?.name ?? poet,
    bookTitle: "",
    bookPath,
    meaningIsAI: false,
  }));

export const deck = (): GameDeck => new GameDeck(poets.flatMap((poet) => couplets(poet.slug, 24)));

export const question = (kind: QuizKind = "poet", { correct = 1, options = 4, couplet = couplets("saadi", 1)[0]! } = {}): QuizQuestion => ({
  kind,
  couplet,
  options: Array.from({ length: options }, (_, index) => ({ id: `o${index}`, title: `گزینه ${index}` })),
  correct,
});
