import { persianDigits } from "../../lib/persian";

/** The dots of a round, one for each question: right ones green, wrong ones red, the one in play lapis with a halo (Games/JigsawScreen.swift `ProgressDots`). */
export function ProgressDots({ total, results, sheetOpen, noun = "بیت" }: { total: number; results: (boolean | null)[]; sheetOpen: boolean; noun?: string }) {
  const done = results.length;
  return (
    <div
      role="img"
      aria-label={`${noun} ${persianDigits(Math.min(done + 1, total))} از ${persianDigits(total)}`}
      data-testid="progress"
      className="flex flex-1 items-center justify-between rounded-full bg-white px-2.5 py-[7px] shadow-[0_2px_4px_rgba(20,17,43,0.12)]"
    >
      {Array.from({ length: total }, (_, index) => {
        if (index < done) return <span key={index} data-dot={results[index] === null ? "skipped" : results[index] ? "right" : "wrong"} className={`size-3.5 rounded-full ${results[index] === null ? "bg-track-light" : results[index] ? "bg-green" : "bg-fire"}`} />;
        if (index === done && !sheetOpen) return <span key={index} data-dot="current" className="size-[18px] rounded-full bg-lapis shadow-[0_0_0_3px_#D6D8FF]" />;
        return <span key={index} data-dot="waiting" className="size-3.5 rounded-full bg-track-light" />;
      })}
    </div>
  );
}
