"use client";

import { playCopy } from "../../lib/play/copy";
import type { MoshState } from "../../lib/play/moshState";
import { BigButton } from "../games/chrome";
import { useGame } from "../games/GameCover";

/** The end of a game: the result, why, and the way out (Play/MoshScreen.swift `MoshEnd`). */
export function MoshEnd({ state }: { state: MoshState }) {
  const { requestClose } = useGame();
  return (
    <div data-testid="mosh-end" className="flex flex-col items-center gap-2 rounded-t-[26px] bg-white/70 px-[18px] pt-[18px] pb-[max(26px,env(safe-area-inset-bottom))]">
      <h2 data-testid="mosh-outcome" className="text-[34px] leading-[1.3] text-ink">
        {state.outcomeTitle}
      </h2>
      {state.endLine && (
        <p data-testid="mosh-end-line" className="text-sm text-muted">
          {state.endLine}
        </p>
      )}
      <p className="text-[13px] text-muted">{playCopy.scores(state.myScore, state.otherName, state.theirScore)}</p>
      <BigButton compact className="mt-2 h-14 text-[21px]" onClick={requestClose} data-testid="mosh-back">
        برگشت
      </BigButton>
    </div>
  );
}
