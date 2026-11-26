"use client";

import { useEffect, useState, type ReactNode } from "react";
import { barIndex, barLabels, type OnboardingStep } from "../../lib/onboarding/model";
import { persianDigits } from "../../lib/persian";
import { Button } from "../ui/Button";

/** A screen shorter than this (an iPhone SE is 667 high) is set tighter (`CompactHeight`). */
const compactBelow = 700;

/** Whether the screen is too short for the board's sizes: it goes by the tallest it has been, so the keyboard coming up does not change the density. */
export function useCompact(): boolean {
  const [tallest, setTallest] = useState(0);
  useEffect(() => {
    const measure = () => setTallest((before) => Math.max(before, window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return tallest > 0 && tallest < compactBelow;
}

/** A large text size (the browser's font size at 125 % or more): only the sign-in buttons stay at the bottom of the account step. */
export function useLargeText(): boolean {
  const [large, setLarge] = useState(false);
  useEffect(() => setLarge(parseFloat(getComputedStyle(document.documentElement).fontSize) >= 20), []);
  return large;
}

/**
 * An onboarding page on dotted paper (the phone's `OnbScreen`): the header (skip, back) and the main button stay where they are, and what is between them scrolls only
 * when it is taller than the room (a small screen, a large text size). It covers everything, the tab bar too, and a sheet opens over it. `children` is given whether the
 * screen is compact.
 */
export function OnbScreen({ header, footer, step, children }: { header: ReactNode; footer: ReactNode; step: OnboardingStep; children: (compact: boolean) => ReactNode }) {
  const compact = useCompact();
  return (
    <div role="dialog" aria-modal="true" aria-label="شروع" data-testid="onboarding" data-step={step} className="dotted-paper fixed inset-0 z-[45] flex justify-center">
      <div className="flex h-dvh w-full max-w-[560px] flex-col">
        <div className="shrink-0 px-[22px] pt-[calc(env(safe-area-inset-top)+6px)]">{header}</div>
        <div data-testid="onb-scroll" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[22px] pt-1 pb-2">
          {children(compact)}
        </div>
        <div className={`shrink-0 px-[22px] pb-[max(8px,env(safe-area-inset-bottom))] ${compact ? "pt-2" : "pt-3"}`}>{footer}</div>
      </div>
    </div>
  );
}

/** The big lapis button at the bottom of a screen: «بزن بریم», «بعدی», «همینه». */
export function OnbButton({ disabled, onClick, testId, children }: { disabled?: boolean; onClick: () => void; testId: string; children: ReactNode }) {
  return (
    <Button disabled={disabled} onClick={onClick} data-testid={testId} className="min-h-[50px] w-full border-4 text-[22px] shadow-[0_6px_16px_rgba(20,17,43,0.3)] disabled:opacity-45">
      {children}
    </Button>
  );
}

/** «سلیقه · اولین بازی · حساب» and «رد شو» at the end. */
export function OnbTopBar({ step, skip }: { step: OnboardingStep; skip: () => void }) {
  const current = barIndex(step) ?? 0;
  return (
    <div className="flex items-start gap-3.5">
      <div role="img" aria-label={`مرحله‌ی ${persianDigits(current + 1)} از ۳، ${barLabels[current]}`} className="flex flex-1 gap-1.5 pt-1.5">
        {barLabels.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col gap-[5px]">
            <div className={`h-1.5 rounded-[3px] ${index <= current ? "bg-lapis" : "bg-ring"}`} />
            <span className={`truncate text-[11px] ${index === current ? "font-bold text-ink" : "font-medium text-[#8A8698]"}`}>{label}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={skip} data-testid="onb-skip" className="min-h-11 px-1 text-[13px] font-bold text-[#8A8698]">
        رد شو
      </button>
    </div>
  );
}

/** A title and the line under it, as on every onboarding screen: Lalezar 30 and a 13 px line. */
export function OnbHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-title text-[30px] leading-[1.3] text-ink">{title}</h1>
      <p className="text-[13px] leading-[1.9] text-muted">{text}</p>
    </div>
  );
}
