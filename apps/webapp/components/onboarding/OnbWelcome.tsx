"use client";

import type { OnboardingModel } from "../../lib/onboarding/model";
import { useLibraryData } from "../../lib/library/browser";
import { GameIcon } from "../games/GameIcon";
import { PoetCircle } from "../library/PoetCircle";
import { OnbButton, OnbScreen } from "./chrome";

/** A sticker card, blue or orange, with a white bar. */
function Card({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span className={`grid h-[88px] w-[58px] place-items-center rounded-[18px] border-[6px] border-white shadow-[0_6px_16px_rgba(20,17,43,0.22)] ${color} ${className}`}>
      <span className="h-[9px] w-[34px] rounded-pill bg-white" />
    </span>
  );
}

/** OnbWelcome: the name, the promise, «بزن بریم», and a way in for people who already have an account (Onboarding/OnbWelcomeView.swift). */
export function OnbWelcome({ onboarding }: { onboarding: OnboardingModel }) {
  const hafez = useLibraryData().value?.library.poet("hafez");
  return (
    <OnbScreen
      step="welcome"
      header={
        <button type="button" onClick={() => onboarding.signIn()} data-testid="onb-have-account" className="min-h-11 text-sm font-bold text-lapis">
          از قبل حساب داری؟ وارد شو
        </button>
      }
      footer={
        <div className="flex flex-col items-center gap-2.5">
          <OnbButton onClick={() => onboarding.next()} testId="onb-start">
            بزن بریم
          </OnbButton>
          <p className="text-xs text-[#8A8698]">بدون حساب هم می‌شه شروع کرد</p>
        </div>
      }
    >
      {(compact) => (
        <div className="relative flex min-h-full flex-col items-center justify-center">
          <div className={`flex flex-col items-center ${compact ? "gap-3" : "gap-[18px]"}`}>
            <div aria-hidden className="-rotate-6">
              <div className="flex gap-2.5">
                <Card color="bg-lapis" />
                <Card color="bg-fire" className="translate-y-1.5 rotate-[10deg]" />
              </div>
            </div>
            <h1 className="pt-2.5 font-title text-[64px] leading-[1.2] text-ink">یه بیت</h1>
            <p className="text-lg font-bold text-ink">هر بیت، یه بازی.</p>
            <p className="whitespace-pre-line text-center text-sm leading-[1.9] text-muted">{"هر روز یه بیت برای تو، بازی با شعر،\nو مشاعره با دوستات."}</p>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <p className="absolute start-0 top-5 rotate-[5deg] whitespace-pre-line rounded-[18px] border-4 border-white bg-white px-2.5 py-1.5 font-poem text-sm leading-[1.6] text-ink shadow-[0_4px_12px_rgba(20,17,43,0.14)]">{"الا یا ایها الساقی\nادر کأسا و ناولها"}</p>
            <span className="absolute end-2.5 top-[60px]">
              <GameIcon kind="jigsaw" size={56} />
            </span>
            {hafez && (
              <span className="absolute bottom-10 end-0 -rotate-[8deg]">
                <PoetCircle poet={hafez} size={64} border={4} />
              </span>
            )}
          </div>
        </div>
      )}
    </OnbScreen>
  );
}
