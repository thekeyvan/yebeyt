import { cn } from "../../lib/cn";

export type WordStatus = "onSheet" | "stuck" | "held" | "correct" | "wrong";

const look: Record<WordStatus, string> = {
  onSheet: "border-0 bg-white px-[14px] pb-1 text-ink shadow-word-on-sheet",
  stuck: "border-word border-white bg-lapis px-3 pb-0.5 text-white shadow-word-stuck",
  held: "border-word border-white bg-fire px-3 pb-0.5 text-white shadow-word-held scale-(--scale-held) rotate-(--tilt-word)",
  correct: "border-word border-white bg-green px-3 pb-0.5 text-ink shadow-word-stuck",
  wrong: "border-word border-white bg-fire px-3 pb-0.5 text-white shadow-word-stuck",
};

/**
 * A word on a sticker sheet (Design/Badge.swift `WordSticker`): loose on the sheet, stuck in place, held in the hand
 * (bigger, tilted, longer shadow), correct (green) or wrong (red).
 */
export function WordSticker({ word, status, size = 21 }: { word: string; status: WordStatus; size?: number }) {
  return (
    <span
      className={cn("inline-block whitespace-nowrap rounded-word font-poem leading-[1.5]", look[status])}
      style={{ fontSize: size }}
    >
      {word}
    </span>
  );
}
