"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MatchQuestion, MatchRound, MatchToken, MatchWord } from "../../lib/games/matchRound";
import { plain } from "../../lib/library/normalize";
import { Reaction } from "../ui/Reaction";

function Line({ tokens }: { tokens: MatchToken[] }) {
  return (
    <p className="font-poem text-[17px] leading-[2.2] text-ink">
      {tokens.map((token, index) => (
        <span key={index}>
          {token.glossed ? <span data-testid="glossed" className="underline decoration-lapis decoration-2 decoration-dotted underline-offset-[6px]">{plain(token.text)}</span> : plain(token.text)}
          {index < tokens.length - 1 && " "}
        </span>
      ))}
    </p>
  );
}

/** The couplet of معنی‌یاب, the hard words with a dotted underline. */
export function MatchCoupletCard({ question }: { question: MatchQuestion }) {
  return (
    <div data-testid="match-couplet" className="flex flex-col gap-1 rounded-[22px] bg-white px-[18px] py-3.5 shadow-[0_3px_5px_rgba(20,17,43,0.08)]">
      <div className="text-start">
        <Line tokens={question.lines[0]!} />
      </div>
      <div className="self-end">
        <Line tokens={question.lines[1]!} />
      </div>
    </div>
  );
}

const card = "flex min-h-12 w-full items-center justify-center rounded-2xl border-[3px] px-3 py-1.5 text-center shadow-[0_2px_4px_rgba(20,17,43,0.08)]";
const matchedCard = "border-green bg-[#EEF9E7] text-[#3E9A1E]";

type BoardProps = {
  round: MatchRound;
  /** How many times each meaning was tapped wrong: a change makes it shake. */
  shakes: Record<number, number>;
  /** The meaning tapped wrong a moment ago, in red. */
  wrongMeaning?: number;
  selectWord: (id: number) => void;
  pick: (id: number) => void;
};

function WordCard({ word, matched, selected, tap }: { word: MatchWord; matched: boolean; selected: boolean; tap: () => void }) {
  return (
    <Reaction when={matched} effect="wiggle" className="flex">
      <button
        type="button"
        onClick={tap}
        disabled={matched}
        aria-pressed={selected}
        data-testid={`word-${word.id}`}
        data-state={matched ? "matched" : selected ? "selected" : "idle"}
        className={`${card} font-poem text-lg ${matched ? matchedCard : selected ? "border-white bg-lapis text-white" : "border-white bg-white text-ink"}`}
      >
        {word.text}
      </button>
    </Reaction>
  );
}

function MeaningCard({ word, matched, wrong, shakes, tap }: { word: MatchWord; matched: boolean; wrong: boolean; shakes: number; tap: () => void }) {
  return (
    <Reaction when={shakes} effect="shake" className="flex">
      <Reaction when={matched} effect="wiggle" className="flex w-full">
        <button
          type="button"
          onClick={tap}
          disabled={matched}
          data-testid={`meaning-${word.id}`}
          data-state={matched ? "matched" : wrong ? "wrong" : "idle"}
          aria-description={matched ? "درست" : wrong ? "نشد" : undefined}
          className={`${card} font-ui text-[13px] font-medium ${matched ? matchedCard : wrong ? "border-fire bg-fire-tint text-ink" : "border-white bg-white text-ink"}`}
        >
          {word.gloss}
        </button>
      </Reaction>
    </Reaction>
  );
}

/** From the left edge of a word's card to the right edge of its meaning's card, as the board's SVG draws it: the words are at the right, the meanings at the left. */
function curve(from: DOMRect, to: DOMRect, board: DOMRect): string {
  const start = { x: from.left - board.left, y: from.top + from.height / 2 - board.top };
  const end = { x: to.right - board.left, y: to.top + to.height / 2 - board.top };
  const reach = (start.x - end.x) * 0.55;
  return `M${start.x} ${start.y}C${start.x - reach} ${start.y} ${end.x + reach} ${end.y} ${end.x} ${end.y}`;
}

/** The two columns of cards (words about two fifths, meanings three) with the green curves behind them. */
export function MatchBoard({ round, shakes, wrongMeaning, selectWord, pick }: BoardProps) {
  const question = round.current;
  const board = useRef<HTMLDivElement>(null);
  const [curves, setCurves] = useState<{ id: number; path: string }[]>([]);

  // Where the cards are decides the curves, so they are drawn once the cards are, and again when the board changes size.
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return;
    const draw = () => {
      const area = element.getBoundingClientRect();
      const rect = (selector: string) => element.querySelector(selector)?.getBoundingClientRect();
      setCurves(
        [...round.matched].sort().flatMap((id) => {
          const [word, meaning] = [rect(`[data-testid=word-${id}]`), rect(`[data-testid=meaning-${id}]`)];
          return word && meaning ? { id, path: curve(word, meaning, area) } : [];
        }),
      );
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [round.matched.size, round.index]);

  return (
    <div ref={board} className="relative grid grid-cols-[2fr_3fr] gap-x-10 gap-y-2.5">
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {curves.map(({ id, path }) => (
          <path key={id} data-testid={`curve-${id}`} d={path} fill="none" stroke="var(--color-green)" strokeWidth="3" strokeLinecap="round" />
        ))}
      </svg>
      {question.words.flatMap((word, row) => {
        const meaning = question.words[question.meanings[row]!]!;
        return [
          <WordCard key={`w${word.id}`} word={word} matched={round.matched.has(word.id)} selected={round.selectedWord === word.id} tap={() => selectWord(word.id)} />,
          <MeaningCard key={`m${meaning.id}`} word={meaning} matched={round.matched.has(meaning.id)} wrong={wrongMeaning === meaning.id} shakes={shakes[meaning.id] ?? 0} tap={() => pick(meaning.id)} />,
        ];
      })}
    </div>
  );
}
