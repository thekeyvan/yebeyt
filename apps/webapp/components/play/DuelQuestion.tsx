"use client";

import type { GameCouplet } from "../../lib/games/couplet";
import type { OptionState } from "../../lib/games/optionState";
import type { Library } from "../../lib/library/library";
import type { DuelState } from "../../lib/play/duelState";
import type { DuelQuestion as Question } from "../../lib/play/liveGameEvents";
import { BookOption, HemistichOption, PoetOption, QuizCoupletCard } from "../games/QuizViews";

/** Before the result: my choice (lapis while it is on its way, red once it is known to be wrong); after it: the right one in green, my wrong one in red, the rest dimmed. */
export function optionStateOf(index: number, state: DuelState): OptionState {
  if (state.rightOption !== undefined) {
    if (index === state.rightOption) return "right";
    return state.chosen === index ? "wrong" : "dimmed";
  }
  if (state.chosen === index) return state.lockedOut ? "wrong" : "selected";
  return state.chosen !== undefined || state.lockedOut ? "dimmed" : "idle";
}

/** The couplet card and the options of the question in play: the quiz games' own views, filled from what the event brought (Play/DuelScreen.swift). */
export function DuelQuestion({ question, state, library, choose }: { question: Question; state: DuelState; library: Library | undefined; choose: (index: number) => void }) {
  const couplet: GameCouplet = { poem: "", index: 0, m1: question.m1, m2: question.m2 ?? "", poetSlug: "", poetName: question.poet ?? "", bookTitle: "", bookPath: "", meaningIsAI: false };
  const props = (index: number) => ({ state: optionStateOf(index, state), index, tap: () => choose(index) });
  const poetNamed = (name: string | undefined) => library?.poets.find((poet) => poet.name === name);
  switch (question.kind) {
    case "second":
      return (
        <>
          <QuizCoupletCard couplet={couplet} secondShown={false} tag={question.poet} />
          <div className="flex flex-col gap-2.5">
            {question.options.map((option, index) => (
              <HemistichOption key={index} {...props(index)} text={option} />
            ))}
          </div>
        </>
      );
    case "poet":
      return (
        <>
          <QuizCoupletCard couplet={couplet} />
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((option, index) => (
              <PoetOption key={index} {...props(index)} poet={poetNamed(option)} name={option} />
            ))}
          </div>
        </>
      );
    case "book": {
      const poet = poetNamed(question.poet);
      return (
        <>
          <QuizCoupletCard couplet={couplet} chip={poet} />
          <div className="flex items-start gap-3 px-1.5 pt-2">
            {question.options.map((option, index) => (
              <BookOption key={index} {...props(index)} book={library?.books.find((book) => book.title === option && book.poet === poet?.slug)} title={option} />
            ))}
          </div>
        </>
      );
    }
  }
}
