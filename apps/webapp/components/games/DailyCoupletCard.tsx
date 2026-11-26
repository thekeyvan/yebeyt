import { wordsOf } from "../../lib/games/letters";
import { persianDigits } from "../../lib/persian";
import type { DailyPuzzle } from "../../lib/games/dailyPuzzle";

/** The couplet of معمای امروز on a lapis card, with the hidden word as a dashed blank until the puzzle is over (Games/DailyCoupletCard.swift). */
export function DailyCoupletCard({ puzzle, revealed, compact }: { puzzle: DailyPuzzle; revealed: boolean; compact: boolean }) {
  const { couplet, wordIndex, inSecondHemistich } = puzzle;
  const line = (text: string, blank: boolean, className: string) => (
    <p className={`flex flex-wrap gap-x-1.5 font-poem text-xl text-white ${compact ? "leading-[1.7]" : "leading-[2]"} ${className}`}>
      {blank
        ? wordsOf(text).map((word, index) =>
            index !== wordIndex ? (
              <span key={index}>{word}</span>
            ) : revealed ? (
              <span key={index} className="text-amber">
                {word}
              </span>
            ) : (
              <span key={index} role="img" aria-label="کلمه‌ی گم‌شده" data-testid="blank" className="h-6 w-16 self-end border-b-[3px] border-dashed border-amber" />
            ),
          )
        : text}
    </p>
  );
  return (
    <section data-testid="daily-couplet" aria-label="بیت" className={`flex flex-col gap-1.5 rounded-[26px] bg-lapis shadow-[0_6px_8px_rgba(47,53,245,0.28)] ${compact ? "px-[18px] pt-3.5 pb-3" : "px-5 pt-5 pb-[18px]"}`}>
      {line(couplet.m1, !inSecondHemistich, "self-start")}
      {line(couplet.m2, inSecondHemistich, "self-end")}
      <p className="self-start text-xs text-[#D6D8FF]">{`${couplet.poetName} · یه کلمه‌ی ${persianDigits(puzzle.letters.length)} حرفی`}</p>
    </section>
  );
}
