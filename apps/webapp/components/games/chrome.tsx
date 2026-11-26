"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { persianDigits } from "../../lib/persian";
import { usePress } from "../../lib/motion";
import { RoundButton } from "../library/chrome";
import { BulbIcon, CloseIcon, TimerIcon } from "../ui/icons";
import { Reaction } from "../ui/Reaction";
import { useGame } from "./GameCover";

/**
 * The frame of a game's screen (the sticky header of Design/Chrome.swift, the content that scrolls under it, the bar at the bottom): the header and the bar
 * stay in place, and only the content scrolls. `bar` is the row of buttons at the foot.
 */
export function GamePage({ header, bar, children }: { header: ReactNode; bar?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-[18px] pt-[calc(env(safe-area-inset-top)+8px)] pb-2">{header}</header>
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[18px] pt-2 pb-4">{children}</main>
      {bar && <footer className="shrink-0 px-[18px] pt-2 pb-[max(12px,env(safe-area-inset-bottom))] [@media(min-height:700px)]:pb-[max(26px,env(safe-area-inset-bottom))]">{bar}</footer>}
    </div>
  );
}

/** The round white close button at the start of a game's header: 44 px, an ×. The cover asks first when a round has started. */
export function GameCloseButton() {
  const { requestClose } = useGame();
  return (
    <RoundButton label="بستن" onClick={requestClose}>
      <CloseIcon size={18} lineWidth={2.6} />
    </RoundButton>
  );
}

/** What a game shows while it gets ready: the close button and a busy page. */
export function GameLoading({ children }: { children: ReactNode }) {
  return <GamePage header={<GameCloseButton />}>{children}</GamePage>;
}

/** «بچسبون!» and «بیت بعدی»: a big lapis button with a white border; `compact` is the quiz games' «همینه!» (58 px, a 4 px border). */
export function BigButton({ className = "", compact, children, ...props }: ComponentProps<typeof motion.button> & { compact?: boolean }) {
  const press = usePress();
  return (
    <motion.button
      type="button"
      {...press}
      className={`flex w-full items-center justify-center rounded-[20px] bg-lapis pt-1 font-title leading-none text-white shadow-card disabled:opacity-45 ${compact ? "h-[58px] border-4 border-white text-[22px]" : "h-[60px] border-[5px] border-white text-[25px]"} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/** The 58 px round button beside it: the bulb (amber, with a white ring) or shuffle (white). */
export function RoundAction({ label, amber, onClick, disabled, testId, children }: { label: string; amber?: boolean; onClick: () => void; disabled?: boolean; testId?: string; children: ReactNode }) {
  const press = usePress();
  return (
    <motion.button
      type="button"
      {...press}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`grid size-[58px] shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_3px_4px_rgba(20,17,43,0.2)] disabled:opacity-45 ${amber ? "p-1" : ""}`}
    >
      {amber ? <span className="grid size-full place-items-center rounded-full bg-amber">{children}</span> : children}
    </motion.button>
  );
}

/** The bulb: its icon and, under it, a small label («یه حرف», «−۲۰»). */
export function Bulb({ caption }: { caption: string }) {
  return (
    <span className="flex flex-col items-center gap-px leading-none">
      <BulbIcon size={21} lineWidth={2.3} />
      <span className="text-[10px] font-bold">{caption}</span>
    </span>
  );
}

/** The white capsule with the clock and the time left («۰:۱۲»). */
export function TimerCapsule({ text }: { text: string }) {
  return (
    <span role="timer" aria-label="زمان" data-testid="timer" className="inline-flex items-center gap-1 rounded-full bg-white px-[11px] py-1.5 text-[15px] font-bold leading-none text-ink shadow-[0_2px_4px_rgba(20,17,43,0.14)]">
      <TimerIcon size={15} lineWidth={2.4} />
      <span>{text}</span>
    </span>
  );
}

/** The amber score sticker: «+۳۶۰». It pops when the points change. */
export function ScoreSticker({ points }: { points: number }) {
  return (
    <Reaction when={points} effect="pop">
      <span data-testid="score" className="inline-block rounded-pill border-4 border-white bg-amber px-[13px] pt-1.5 pb-[3px] font-title text-[22px] leading-[1.3] text-ink shadow-[0_3px_8px_rgba(20,17,43,0.22)]">
        {`+${persianDigits(points)}`}
      </span>
    </Reaction>
  );
}

/** A peeled corner at the bottom edge of a big card (JigsawE): one per screen, at the physical left. */
export function PeeledCorner() {
  return (
    <span
      aria-hidden
      className="absolute end-0 bottom-0 size-[26px] rounded-ee-[26px] shadow-[2px_-2px_2px_rgba(20,17,43,0.12)]"
      style={{ background: "linear-gradient(to top right, var(--color-paper) 50%, var(--color-ring) 50%, var(--color-white) 90%)" }}
    />
  );
}
