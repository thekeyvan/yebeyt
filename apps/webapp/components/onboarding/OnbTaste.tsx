"use client";

import type { OnboardingModel } from "../../lib/onboarding/model";
import { tasteMoods, type Taste } from "../../lib/onboarding/taste";
import { useLibraryData, useStore } from "../../lib/library/browser";
import type { LibraryPoet } from "../../lib/library/models";
import { PoetCircle } from "../library/PoetCircle";
import { CheckIcon } from "../ui/icons";
import { OnbButton, OnbHeading, OnbScreen, OnbTopBar } from "./chrome";

function Tile({ poet, on, size, toggle }: { poet: LibraryPoet; on: boolean; size: number; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={poet.name} data-testid={`poet-${poet.slug}`} className="flex min-h-11 flex-col items-center gap-1.5">
      <span className="relative">
        <span className={`block rounded-full ${on ? "ring-4 ring-lapis" : ""}`}>
          <PoetCircle poet={poet} size={size} border={3} />
        </span>
        {on && (
          <span aria-hidden className="absolute -end-0.5 bottom-0 grid size-6 place-items-center rounded-full border-[3px] border-white bg-lapis text-white">
            <CheckIcon size={12} lineWidth={3.6} />
          </span>
        )}
      </span>
      <span aria-hidden className={`text-[13px] text-ink ${on ? "font-bold" : "font-medium"}`}>
        {poet.name}
      </span>
    </button>
  );
}

/** OnbTaste: the poets (multi-select, with check marks) and the moods the person likes. Kept in this browser; «بیتِ امروز» prefers these poets (Onboarding/OnbTasteView.swift). */
export function OnbTaste({ onboarding, taste }: { onboarding: OnboardingModel; taste: Taste }) {
  const poets = useLibraryData().value?.library.explorePoets.slice(0, 9) ?? [];
  const picked = useStore(taste);
  return (
    <OnbScreen
      step="taste"
      header={<OnbTopBar step="taste" skip={() => onboarding.next()} />}
      footer={
        <OnbButton onClick={() => onboarding.next()} testId="onb-next">
          بعدی
        </OnbButton>
      }
    >
      {(compact) => (
        <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
          <OnbHeading title="کدوم شاعرها رو دوست داری؟" text="«بیت امروز»ت رو از روی همین انتخاب می‌کنیم. هر چند تا خواستی." />
          <div className={`grid grid-cols-3 gap-x-2 rounded-[26px] bg-white px-2.5 shadow-[0_6px_11px_rgba(20,17,43,0.08)] ${compact ? "gap-y-2.5 py-3" : "gap-y-3.5 py-[18px]"}`}>
            {poets.map((poet) => (
              <Tile key={poet.slug} poet={poet} on={picked?.poets.has(poet.slug) ?? false} size={compact ? 56 : 72} toggle={() => taste.togglePoet(poet.slug)} />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold text-ink">چه حالی رو بیشتر دوست داری؟</h2>
            <div className="flex flex-wrap gap-2">
              {tasteMoods.map(({ key, title }) => {
                const on = picked?.moods.has(key) ?? false;
                return (
                  <button key={key} type="button" aria-pressed={on} onClick={() => taste.toggleMood(key)} data-testid={`mood-${key}`} className={`h-11 rounded-pill px-3.5 text-[13px] ${on ? "bg-lapis font-bold text-white" : "bg-white font-medium text-ink"}`}>
                    {title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </OnbScreen>
  );
}
