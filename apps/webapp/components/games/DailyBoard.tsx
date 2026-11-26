"use client";

import { motion } from "motion/react";
import { DailyGame } from "../../lib/games/dailyGame";
import type { LetterMark } from "../../lib/games/letterMarks";
import { usePress } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";
import { Reaction } from "../ui/Reaction";

const fills: Record<LetterMark, string> = { green: "border-green bg-green text-ink", yellow: "border-amber bg-amber text-ink", grey: "border-ring bg-ring text-muted" };

function Cell({ letter, mark, given, next, compact, pops }: { letter?: string; mark?: LetterMark; given?: boolean; next?: boolean; compact: boolean; pops?: boolean }) {
  const look = mark ? fills[mark] : `${given ? "bg-[#D6D8FF]" : "bg-white"} ${letter !== undefined || next ? "border-lapis" : "border-ring"} ${next ? "shadow-[0_0_0_3px_#D6D8FF]" : ""}`;
  return (
    <Reaction when={pops} effect="wiggle">
      <span data-mark={mark} className={`grid place-items-center rounded-xl border-[3px] font-bold ${compact ? "h-11 w-10 text-xl" : "h-[50px] w-11 text-[22px]"} ${look}`}>
        {letter ?? " "}
      </span>
    </Reaction>
  );
}

/** The three tries of معمای امروز: a row of letter boxes each, and the «فرصت» line under them (Games/DailyBoard.swift). */
export function DailyGrid({ game, compact }: { game: DailyGame; compact: boolean }) {
  const marks = game.marks;
  const playing = game.outcome === "playing";
  const dot = (index: number) => (index < game.tries.length ? "bg-fire" : index === game.tries.length && playing ? "bg-lapis" : "bg-ring");
  return (
    <div className="flex flex-col items-center gap-1.5">
      {Array.from({ length: DailyGame.maxTries }, (_, row) => (
        <div key={row} role="group" aria-label={`فرصت ${persianDigits(row + 1)}`} data-testid={`try-${row + 1}`} className={`flex ${compact ? "gap-1.5" : "gap-2"}`}>
          {game.answer.map((_, column) =>
            row < game.tries.length ? (
              <Cell key={column} letter={game.tries[row]![column]} mark={marks[row]![column]} compact={compact} pops={marks[row]![column] === "green"} />
            ) : row === game.tries.length && playing ? (
              <Cell key={column} letter={game.entry[column]} given={game.hinted.includes(column)} next={game.cursor === column} compact={compact} />
            ) : (
              <Cell key={column} compact={compact} />
            ),
          )}
        </div>
      ))}
      <p className="flex items-center gap-1.5 pt-1 text-xs text-muted">
        <span>فرصت:</span>
        {Array.from({ length: DailyGame.maxTries }, (_, index) => (
          <span key={index} aria-hidden className={`size-2.5 rounded-full ${dot(index)}`} />
        ))}
        <span>سبز یعنی سر جاشه، زرد یعنی هست ولی جای دیگه</span>
      </p>
    </div>
  );
}

const keyFills: Record<LetterMark | "none", string> = {
  green: "border-green bg-green text-ink",
  yellow: "border-amber bg-amber text-ink",
  grey: "border-transparent bg-track-light text-[#B9B4C6] shadow-none",
  none: "border-white bg-white text-ink",
};

const keyValue: Record<LetterMark, string> = { green: "سر جاشه", yellow: "جای دیگه‌ست", grey: "تو کلمه نیست" };

/** The letters to build the word from, and «پاک کن». Letters the tries showed to be wrong are greyed; a physical keyboard types the same letters. */
export function DailyKeyboard({ keys, marks, type, erase, compact }: { keys: readonly string[]; marks: ReadonlyMap<string, LetterMark>; type: (letter: string) => void; erase: () => void; compact: boolean }) {
  const press = usePress();
  const height = compact ? "h-11 text-[19px]" : "h-12 text-xl";
  return (
    <div className={`grid grid-cols-7 gap-1.5 rounded-[22px] border-2 border-dashed border-[#C9C5D3] bg-white/60 ${compact ? "p-2" : "p-3"} mx-auto w-full max-w-[368px]`}>
      {keys.map((letter) => {
        const mark = marks.get(letter);
        return (
          <motion.button
            key={letter}
            type="button"
            {...press}
            data-key={letter}
            data-mark={mark}
            onClick={() => type(letter)}
            className={`rounded-xl border-[3px] font-bold shadow-word-on-sheet ${height} ${keyFills[mark ?? "none"]}`}
          >
            {letter}
            {mark && <span className="sr-only">{keyValue[mark]}</span>}
          </motion.button>
        );
      })}
      <motion.button
        type="button"
        {...press}
        onClick={erase}
        data-testid="erase"
        className={`col-span-2 rounded-xl border-[3px] border-white bg-white text-[13px] font-bold text-fire shadow-word-on-sheet ${compact ? "h-11" : "h-12"}`}
      >
        پاک کن
      </motion.button>
    </div>
  );
}
