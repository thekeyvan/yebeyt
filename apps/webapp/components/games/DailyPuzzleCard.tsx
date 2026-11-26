"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { DailyGame } from "../../lib/games/dailyGame";
import { hemistichOf, type DailyPuzzle } from "../../lib/games/dailyPuzzle";
import { wordsOf } from "../../lib/games/letters";
import type { TehranDay } from "../../lib/games/tehranDay";
import { usePress } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";

const PressLink = motion.create(Link);

/** «۱» over «آذر», on an amber sticker tilted at the corner. */
function DateSticker({ day }: { day: TehranDay }) {
  const { day: number, month } = day.stickerParts;
  return (
    <span aria-hidden className="absolute -top-4 end-4 flex size-14 rotate-12 flex-col items-center justify-center rounded-full border-4 border-white bg-amber leading-none text-ink shadow-[0_3px_8px_rgba(20,17,43,0.25)]">
      <span className="pt-1 font-title text-[22px]">{number}</span>
      <span className="text-[11px] font-bold">{month}</span>
    </span>
  );
}

/** One white box for each letter of the missing word. */
function Boxes({ count }: { count: number }) {
  return (
    <span role="img" aria-label={`کلمه‌ی گم‌شده، ${persianDigits(count)} حرفی`} className="flex gap-[5px]">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="h-8 w-7 rounded-lg bg-white shadow-[0_2px_2px_rgba(10,10,80,0.3)]" />
      ))}
    </span>
  );
}

/**
 * The daily puzzle's card on the games tab (GamesE): the couplet with its missing word as empty boxes and «بزن بریم». Once the puzzle is over it shows
 * the couplet complete and the button reads «ببین» (Games/DailyPuzzleCard.swift).
 */
export function DailyPuzzleCard({ puzzle, day, finished }: { puzzle: DailyPuzzle; day: TehranDay; finished: boolean }) {
  const press = usePress();
  return (
    <section aria-label="معمای امروز" data-testid="daily-card" className="relative flex flex-col gap-3 rounded-[28px] border-[5px] border-white bg-lapis px-[18px] pt-[18px] pb-4 text-white shadow-[0_4px_12px_rgba(20,17,43,0.22)]">
      <DateSticker day={day} />
      <p className="self-start rounded-full bg-white/[0.18] px-3 py-0.5 text-[13px] font-medium">{`معمای امروز · ${persianDigits(DailyGame.maxTries)} فرصت`}</p>
      <h2 className="text-[30px] leading-[1.3]">کلمه‌ی گم‌شده</h2>
      {finished ? (
        <p data-testid="daily-solved" className="font-poem text-[21px] leading-[1.9]">
          {puzzle.couplet.m1}
          <br />
          {puzzle.couplet.m2}
        </p>
      ) : (
        <p className="flex flex-wrap items-end gap-x-2 gap-y-0.5 font-poem text-[21px] leading-[1.9]">
          {wordsOf(hemistichOf(puzzle)).map((word, index) => (index === puzzle.wordIndex ? <Boxes key={index} count={puzzle.letters.length} /> : <span key={index}>{word}</span>))}
        </p>
      )}
      <div className="flex justify-end pt-0.5">
        <PressLink
          href="/games/daily"
          {...press}
          data-testid="daily-open"
          className="rounded-[14px] border-[3px] border-white bg-amber px-2.5 pt-1 font-title text-[19px] leading-[1.5] text-ink shadow-[0_2px_6px_rgba(20,17,43,0.3)]"
        >
          {finished ? "ببین" : "بزن بریم"}
        </PressLink>
      </div>
    </section>
  );
}
