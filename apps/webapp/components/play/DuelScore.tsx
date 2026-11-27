"use client";

import type { AvatarParts } from "@yebeyt/avatar";
import { cn } from "../../lib/cn";
import { persianDigits } from "../../lib/persian";
import { roundCount, type DuelState, type Segment } from "../../lib/play/duelState";
import { FacePerson } from "../friends/FacePerson";

const segmentColor = (segment: Segment, state: DuelState): string => {
  switch (segment.kind) {
    case "won":
      return segment.by === state.me ? "bg-amber" : "bg-magenta";
    case "current":
      return "bg-lapis";
    default:
      return "bg-track-light";
  }
};

function Player({ name, parts, score, color, chip, id }: { name: string; parts: AvatarParts | null; score: number; color: string; chip: boolean; id: string }) {
  return (
    <div className="relative flex w-[72px] flex-col items-center gap-0.5">
      <FacePerson parts={parts} size={54} />
      <span className="max-w-full truncate text-xs font-bold text-ink">{name}</span>
      <span data-testid={`duel-${id}-score`} className={cn("h-7 font-title text-[28px] leading-7 [text-shadow:0.6px_0.6px_0_var(--color-ink),-0.6px_-0.6px_0_var(--color-ink)]", color)}>
        {persianDigits(score)}
      </span>
      {chip && (
        <span data-testid="duel-answered" className="absolute -top-2 -end-3.5 rotate-6 whitespace-nowrap rounded-full border-[3px] border-white bg-green px-2 text-[10px] font-bold leading-[1.6] text-ink shadow-[0_1px_4px_rgba(20,17,43,0.15)]">
          جواب داد
        </span>
      )}
    </div>
  );
}

/** The scores of the two players with the strip of the five rounds between them (Play/DuelScreen.swift `scoreCard`). */
export function DuelScore({ state, myParts, otherParts, otherName }: { state: DuelState; myParts: AvatarParts | null; otherParts: AvatarParts | null; otherName: string }) {
  return (
    <div data-testid="duel-scores" className="flex items-center justify-between rounded-[26px] bg-white px-4 py-3 shadow-[0_3px_6px_rgba(20,17,43,0.08)]">
      <Player id="mine" name="تو" parts={myParts} score={state.myScore} color="text-amber" chip={false} />
      <div className="flex flex-col items-center gap-1.5">
        <span className="pt-1 font-title text-xl text-fire">در برابر</span>
        <div className="flex gap-1" aria-hidden>
          {state.segments.map((segment, index) => (
            <span key={index} data-segment={segment.kind} className={cn("h-2 rounded-full", segment.kind === "current" ? "w-[30px]" : "w-6", segmentColor(segment, state))} />
          ))}
        </div>
        <span data-testid="duel-round" className="text-[11px] text-muted">
          {`دور ${persianDigits(Math.max(state.round, 1))} از ${persianDigits(roundCount)}`}
        </span>
      </div>
      <Player id="theirs" name={otherName} parts={otherParts} score={state.theirScore} color="text-magenta" chip={state.otherAnswered && !state.isRoundOver} />
    </div>
  );
}
