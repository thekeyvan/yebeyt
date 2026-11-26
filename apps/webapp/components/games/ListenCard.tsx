"use client";

import { motion } from "motion/react";
import type { ClipState } from "../../lib/games/clipPlayer";
import type { ListenClip } from "../../lib/games/quizQuestion";
import { usePress } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";
import { PlayIcon } from "../ui/icons";

/** The heights of the bars, as drawn on the board. */
const bars = [14, 26, 40, 22, 34, 52, 30, 18, 44, 58, 36, 24, 46, 30, 20, 38, 50, 28, 16, 32, 44, 22, 12, 26];

type ListenCardProps = {
  state: ClipState;
  /** How far the clip has played, 0–1: the waveform's bars turn white up to it. */
  progress: number;
  clip: ListenClip;
  replaysLeft: number;
  playOrPause: () => void;
  replay: () => void;
};

/** گوش کن: the dark card with the play/pause button, the decorative waveform and what is left to do. The text is not shown; only the first hemistich is heard. */
export function ListenCard({ state, progress, clip, replaysLeft, playOrPause, replay }: ListenCardProps) {
  const press = usePress();
  const playing = state === "playing" || state === "loading";
  return (
    <div
      data-testid="listen-card"
      data-state={state}
      data-clip-start={clip.start}
      data-clip-end={clip.end}
      data-clip-fade={clip.fade}
      className="flex flex-col items-center gap-3.5 rounded-[28px] bg-ink px-[18px] pt-[22px] pb-[18px] shadow-[0_6px_9px_rgba(20,17,43,0.28)]"
    >
      <motion.button
        type="button"
        {...press}
        onClick={playOrPause}
        aria-label={playing ? "مکث" : "پخش"}
        data-testid="listen-play"
        className="grid size-[76px] place-items-center rounded-full border-[5px] border-white bg-lapis text-white shadow-[0_6px_8px_rgba(47,53,245,0.4)]"
      >
        {playing ? (
          <span className="flex gap-1.5">
            <span className="h-[26px] w-[7px] rounded-[3px] bg-white" />
            <span className="h-[26px] w-[7px] rounded-[3px] bg-white" />
          </span>
        ) : (
          <PlayIcon size={28} />
        )}
      </motion.button>
      <div aria-hidden className="flex h-[60px] items-center gap-1">
        {bars.map((height, index) => (
          <span key={index} style={{ height }} className={`w-[5px] rounded-[3px] bg-white ${index < progress * bars.length ? "opacity-100" : "opacity-35"}`} />
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        <p className="text-xs text-[#B9B4C6]">متن رو نمی‌بینی، فقط می‌شنوی</p>
        <button type="button" onClick={replay} disabled={replaysLeft === 0} data-testid="listen-replay" className="text-xs font-bold text-amber disabled:opacity-50">
          {`دوباره بشنو (${persianDigits(replaysLeft)})`}
        </button>
      </div>
    </div>
  );
}
