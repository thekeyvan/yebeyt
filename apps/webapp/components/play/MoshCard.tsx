"use client";

import { useRouter } from "next/navigation";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { gameURL, lobbyURL } from "../../lib/play/routes";
import { FacePerson } from "../friends/FacePerson";
import { GameIcon } from "../games/GameIcon";

/** The مشاعره card of the بازی tab (GamesE): the game that is waiting for my answer, and «با یه دوست» (Play/MoshCard.swift). */
export function MoshCard({ services }: { services: Services }) {
  const router = useRouter();
  const { games } = services;
  useStore(games);
  const urgent = games.urgentMosh;
  return (
    <div data-testid="mosh-card" className="relative flex flex-col gap-2.5 rounded-[26px] border-[5px] border-white bg-amber px-3.5 pt-3.5 pb-3 text-ink shadow-card">
      <div className="flex flex-col">
        <h2 className="pt-[3px] text-[26px] leading-[1.3]">مشاعره</h2>
        <p className="text-xs font-medium">نوبتی بیت بگید، با آخرین حرفِ بیتِ قبلی</p>
      </div>
      {urgent && (
        <button type="button" data-testid="mosh-active" onClick={() => router.push(gameURL("mosh", urgent.game.id))} className="flex items-center gap-2.5 rounded-[18px] bg-white px-2.5 py-2 text-start">
          <FacePerson parts={urgent.other?.avatar ?? null} size={44} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{urgent.cardTitle}</span>
            <span className="truncate text-xs text-muted">{urgent.turnLine}</span>
          </span>
          <span className="rounded-xl bg-lapis px-3 pt-[7px] pb-[3px] font-title text-base text-white">جواب بده</span>
        </button>
      )}
      <button type="button" data-testid="mosh-with-friend" onClick={() => router.push(lobbyURL())} className="h-10 rounded-[14px] bg-white/55 text-[13px] font-bold">
        با یه دوست
      </button>
      <span className="absolute -top-4 end-3">
        <GameIcon kind="mosh" size={50} />
      </span>
    </div>
  );
}
