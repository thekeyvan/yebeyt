import type { QuizKind } from "./quizQuestion";

/** The spoken «است» after a name: «مولانا» → «ست» (مولاناست), «حافظ» → «ه» (حافظه). */
export const copula = (name: string): string => {
  const last = [...name].at(-1);
  return last === undefined ? "" : last === "ا" || last === "و" ? "ست" : "ه";
};

/** The words under the title of a quiz game's screen (the boards' second line). */
export function subtitle(kind: QuizKind, poetName: string): string {
  switch (kind) {
    case "poet":
      return "شاعرِ این بیت کیه؟";
    case "misra":
      return "ادامه‌ی این بیت کدومه؟";
    case "book":
      return `این بیت از کدوم کتابِ ${poetName}${copula(poetName)}؟`;
    case "listen":
      return "مصراع اول رو بشنو؛ دومی کدومه؟";
  }
}
