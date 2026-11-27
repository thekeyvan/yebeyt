"use client";

import { useEffect, useRef } from "react";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { playCopy } from "../../lib/play/copy";
import { FacePerson } from "../friends/FacePerson";
import { GameCloseButton, GameLoading } from "../games/chrome";
import { GameIcon } from "../games/GameIcon";
import { TimerIcon } from "../ui/icons";
import { MoshEnd } from "./MoshEnd";
import { MoshMoves } from "./MoshMoves";
import { MoshPanel } from "./MoshPanel";
import { useNow } from "./useNow";
import { useSignedInServices } from "./useGuarded";

/**
 * PlayMosh: the scores and the time left, the couplets played so far, and, on my turn, the input with the letter to start with and the couplets of the divan and the
 * books that fit. Live events and the clock keep it up to date (Play/MoshScreen.swift).
 */
export function MoshScreen({ gameId }: { gameId: string }) {
  const services = useSignedInServices();
  return services ? <Mosh services={services} gameId={gameId} /> : <GameLoading>{null}</GameLoading>;
}

function Mosh({ services, gameId }: { services: Services; gameId: string }) {
  const { games } = services;
  useStore(games);
  const state = games.mosh(gameId);
  const now = useNow(1000);
  const lastOverdueRead = useRef(0);
  useEffect(() => void games.load(gameId), [games, gameId]);

  // The clock of the header runs every second; when a turn has run out the server is asked, as it ends the game then.
  const left = state?.secondsLeft(now);
  useEffect(() => {
    if (left === 0 && now - lastOverdueRead.current > 4000) {
      lastOverdueRead.current = now;
      void games.load(gameId);
    }
  }, [left, now]);

  if (!state) return <GameLoading>{null}</GameLoading>;
  const time = state.timeLabel(now);
  const name = state.otherName;
  return (
    <div data-testid="mosh" className="flex h-full flex-col gap-3.5 pt-[calc(env(safe-area-inset-top)+8px)]">
      <header className="flex shrink-0 items-center gap-2.5 px-[18px]">
        <GameCloseButton />
        <div
          role="group"
          aria-label={`تو ${persianDigits(state.myScore)} در برابر ${name} ${persianDigits(state.theirScore)}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full bg-white px-3 py-1 text-ink shadow-[0_2px_4px_rgba(20,17,43,0.12)]"
        >
          <FacePerson parts={state.mine?.avatar ?? null} size={34} />
          <span data-testid="mosh-my-score" className="pt-[3px] font-title text-xl">
            {persianDigits(state.myScore)}
          </span>
          <span className="text-[11px] text-[#8A8698]">در برابر</span>
          <span data-testid="mosh-their-score" className="pt-[3px] font-title text-xl">
            {persianDigits(state.theirScore)}
          </span>
          <FacePerson parts={state.other?.avatar ?? null} size={34} />
        </div>
        {time && (
          <span role="timer" aria-label="زمان باقی‌مونده" data-testid="mosh-time" className="inline-flex items-center gap-1 rounded-full bg-white px-[11px] py-1.5 text-[13px] font-bold leading-none text-ink shadow-[0_2px_4px_rgba(20,17,43,0.14)]">
            <TimerIcon size={15} lineWidth={2.4} />
            {time}
          </span>
        )}
      </header>
      <div className="flex shrink-0 items-center gap-2.5 px-[18px]">
        <GameIcon kind="mosh" size={44} />
        <h1 className="min-w-0 truncate pt-[3px] text-[26px] leading-[1.3] text-ink">{name ? `مشاعره با ${name}` : "مشاعره"}</h1>
        <span data-testid="mosh-round" className="shrink-0 text-xs text-muted">
          {state.roundLine}
        </span>
      </div>
      {state.isWaiting ? (
        <div data-testid="mosh-waiting" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          <p className="text-2xl text-ink">{playCopy.waiting("")}</p>
          <p dir="ltr" className="text-[13px] font-bold text-lapis">
            {playCopy.gameLink(state.game.code)}
          </p>
        </div>
      ) : (
        <MoshMoves state={state} />
      )}
      {state.isDone ? <MoshEnd state={state} /> : state.isActive && <MoshPanel state={state} services={services} />}
    </div>
  );
}
