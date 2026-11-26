"use client";

import type { ReactNode } from "react";
import type { GameCouplet } from "../../lib/games/couplet";
import { spoken, type OptionState } from "../../lib/games/optionState";
import type { LibraryBook, LibraryPoet } from "../../lib/library/models";
import { plain } from "../../lib/library/normalize";
import { BookCover } from "../library/BookCover";
import { PoetCircle } from "../library/PoetCircle";
import { tokenColor } from "../library/palette";
import { CheckIcon, CloseIcon } from "../ui/icons";
import { Reaction } from "../ui/Reaction";

const border: Record<OptionState, string> = {
  idle: "border-white",
  dimmed: "border-white",
  removed: "border-white",
  selected: "border-lapis",
  right: "border-green",
  wrong: "border-fire",
};

const shadow = "shadow-[0_3px_5px_rgba(20,17,43,0.08)]";

/** The right option pops, a wrong chosen one shakes (the taps are the answer sheet's verdict). */
function Motion({ state, className, children }: { state: OptionState; className?: string; children: ReactNode }) {
  const verdict = state === "right" || state === "wrong" ? state : "none";
  return (
    <Reaction when={verdict} effect={state === "wrong" ? "shake" : "wiggle"} className={className ?? "block"}>
      {children}
    </Reaction>
  );
}

/** The round badge in the corner of the right or wrong option: ✓ on green, × on fire, at the physical left. */
function VerdictBadge({ right }: { right: boolean }) {
  return (
    <span aria-hidden className={`absolute end-2 top-2 grid size-6 place-items-center rounded-full border-[3px] border-white text-white ${right ? "bg-green" : "bg-fire"}`}>
      {right ? <CheckIcon size={12} lineWidth={3.6} /> : <CloseIcon size={10} lineWidth={3.6} />}
    </span>
  );
}

type OptionProps = { state: OptionState; index: number; tap: () => void };

/** What every option button has: the state for tests and styles, hidden and unreachable when ۵۰:۵۰ took it away, and no taps once it is answered. */
const optionProps = ({ state, index, tap }: OptionProps) =>
  ({
    type: "button",
    onClick: tap,
    disabled: state !== "idle" && state !== "selected",
    "aria-hidden": state === "removed" || undefined,
    "aria-pressed": state === "selected" || undefined,
    "aria-description": spoken(state),
    "data-testid": `option-${index}`,
    "data-state": state,
  }) as const;

const opacity: Record<OptionState, string> = { idle: "", selected: "", right: "", wrong: "", dimmed: "opacity-45", removed: "opacity-0" };

/** حدس شاعر: a poet's face with the name, in a card of the 2×2 grid. */
export function PoetOption({ poet, name, ...props }: OptionProps & { poet?: LibraryPoet; name: string }) {
  const { state } = props;
  return (
    <Motion state={state}>
      <button
        {...optionProps(props)}
        aria-label={name}
        className={`relative flex w-full flex-col items-center gap-2 rounded-[22px] border-4 px-2 pt-3.5 pb-2.5 ${border[state]} ${state === "right" ? "bg-[#EEF9E7]" : "bg-white"} ${shadow} ${opacity[state]}`}
      >
        {poet && <PoetCircle poet={poet} size={70} border={3} />}
        <span className="font-ui text-base font-bold text-ink">{name}</span>
        {(state === "right" || state === "wrong") && <VerdictBadge right={state === "right"} />}
      </button>
    </Motion>
  );
}

/** مصراع دوم and گوش کن: a second hemistich on a white row. In گوش کن «یه کلمه» marks one word. */
export function HemistichOption({ text, markedWord, ...props }: OptionProps & { text: string; markedWord?: number }) {
  const { state } = props;
  const fill = state === "selected" ? "bg-lapis text-white" : state === "right" ? "bg-[#EEF9E7] text-ink" : "bg-white text-ink";
  return (
    <Motion state={state}>
      <button {...optionProps(props)} className={`relative w-full rounded-[20px] border-[3px] px-4 py-3.5 text-start font-poem text-lg leading-[1.8] ${border[state]} ${fill} ${shadow} ${opacity[state]}`}>
        {text.split(/\s+/).filter(Boolean).map((word, index, words) => (
          <span key={index}>
            {index === markedWord ? <mark data-testid="hint-word" className="rounded bg-amber/55 text-inherit">{word}</mark> : word}
            {index < words.length - 1 && " "}
          </span>
        ))}
        {(state === "right" || state === "wrong") && <VerdictBadge right={state === "right"} />}
      </button>
    </Motion>
  );
}

const ring: Record<OptionState, string> = { idle: "ring-transparent", dimmed: "ring-transparent", removed: "ring-transparent", selected: "ring-lapis", right: "ring-green", wrong: "ring-fire" };

/** از کدوم کتاب؟: a small book cover with its title. */
export function BookOption({ book, title, ...props }: OptionProps & { book?: LibraryBook; title: string }) {
  const { state } = props;
  const colour = state === "right" ? "text-[#3E9A1E]" : state === "wrong" ? "text-fire" : "text-ink";
  return (
    <Motion state={state} className="block flex-1">
      <button {...optionProps(props)} aria-label={title} className={`flex w-full flex-col items-center gap-2.5 ${opacity[state]} ${state === "wrong" ? "-rotate-3" : ""}`}>
        <span className={`block w-[86px] rounded-md ring-4 ${ring[state]}`}>
          <BookCover color={book?.color ?? "lapis"} className="block w-full overflow-hidden rounded-md" />
        </span>
        <span className={`line-clamp-3 text-center font-title text-base leading-[1.4] ${colour}`}>{title}</span>
      </button>
    </Motion>
  );
}

/** The poet's small circle and name, on a paper capsule. */
function PoetChip({ poet }: { poet: LibraryPoet }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper py-[3px] ps-1 pe-3">
      <PoetCircle poet={poet} size={26} border={2} />
      <span className="font-ui text-[13px] font-bold text-ink">{poet.name}</span>
    </span>
  );
}

const hemistich = "font-poem text-xl leading-[1.9] text-ink";

/**
 * The white card with the couplet: the first hemistich at the start, the second at the end (a dashed blank while it is the question), a poet's tag at the
 * corner (مصراع دوم) and a poet chip at the bottom (از کدوم کتاب؟).
 */
export function QuizCoupletCard({ couplet, secondShown = true, tag, chip }: { couplet: GameCouplet; secondShown?: boolean; tag?: string; chip?: LibraryPoet }) {
  return (
    <div data-testid="quiz-couplet" className="relative flex flex-col gap-1 rounded-[26px] bg-white px-5 pt-[22px] pb-[18px] shadow-[0_4px_7px_rgba(20,17,43,0.1)]">
      <p className={`${hemistich} text-start`}>{plain(couplet.m1)}</p>
      <div className="self-end">
        {secondShown ? <p className={hemistich}>{plain(couplet.m2)}</p> : <span role="img" aria-label="مصراع دوم" className="block h-[30px] w-[150px] rounded-[10px] border-2 border-dashed border-[#C9C5D3]" />}
      </div>
      {chip && (
        <div className="pt-1.5">
          <PoetChip poet={chip} />
        </div>
      )}
      {tag && (
        <span className="absolute end-[18px] -top-4 -rotate-[5deg] rounded-pill border-[3px] border-white bg-magenta px-[11px] pt-0.5 font-title text-sm leading-[1.5] text-white shadow-[0_2px_6px_rgba(20,17,43,0.22)]">
          {tag}
        </span>
      )}
    </div>
  );
}
