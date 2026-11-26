import type { GameCouplet } from "./couplet";

/** The games that are one question after another (Games/QuizQuestion.swift). */
export type QuizKind = "poet" | "misra" | "book" | "listen";

/** One choice of a quiz: a poet's face (id = slug), a book (id = its path) or a second hemistich (id = its couplet). `title` is the poet's name, the book's title or the hemistich. */
export type QuizOption = { id: string; title: string };

/** The part of a recitation that is played in گوش کن: the first hemistich, in seconds from the start of the audio. */
export type ListenClip = {
  audio: string;
  start: number;
  end: number;
  /** Seconds before `end` the volume starts falling (`listenClipRange.fade`, or `measuredFade` for a measured clip). */
  fade: number;
};

/** One question of حدس شاعر, مصراع دوم, از کدوم کتاب؟ or گوش کن: a couplet, the options (shuffled) and which is right. */
export type QuizQuestion = {
  kind: QuizKind;
  couplet: GameCouplet;
  options: QuizOption[];
  /** The index of the right option. */
  correct: number;
  /** گوش کن: what is played. */
  clip?: ListenClip;
  /** گوش کن: the word of the right option «یه کلمه» shows (an index among its words). */
  hintWord?: number;
};

export const rightOption = (question: QuizQuestion): QuizOption => question.options[question.correct]!;

/** The right second hemistich, when the title can't name the answer (مصراع دوم, گوش کن). */
export const rightHemistich = (question: QuizQuestion): string | undefined => (question.kind === "misra" || question.kind === "listen" ? rightOption(question).title : undefined);

/** The title of the sheet after the answer. */
export function verdict(question: QuizQuestion, right: boolean): string {
  switch (question.kind) {
    case "poet":
      return right ? `آره، ${question.couplet.poetName}!` : `نه، ${question.couplet.poetName} بود`;
    case "book":
      return right ? `آره، از ${rightOption(question).title} بود!` : `نه، از ${rightOption(question).title} بود`;
    default:
      return right ? "آره، همینه!" : "نه، این بود";
  }
}
