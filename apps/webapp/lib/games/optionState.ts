import type { QuizRound } from "./quizRound";

/** How an option of a quiz looks: waiting, chosen, or (once the sheet is open) the right one, the wrong one chosen, the others dimmed. ۵۰:۵۰ takes options away (they stay as empty room so nothing jumps). */
export type OptionState = "idle" | "selected" | "right" | "wrong" | "dimmed" | "removed";

export function optionState(round: QuizRound, index: number): OptionState {
  const answer = round.lastAnswer;
  if (answer) {
    if (index === round.current.correct) return "right";
    return answer.chosen === index ? "wrong" : "dimmed";
  }
  if (round.removed.has(index)) return "removed";
  return round.selected === index ? "selected" : "idle";
}

/** What a screen reader says about the option once it is answered. */
export const spoken = (state: OptionState): string | undefined => (state === "right" ? "درست" : state === "wrong" ? "نشد" : undefined);
