"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { canGoBack } from "../../lib/nav";
import { usePress } from "../../lib/motion";
import { ChevronRightIcon, ExploreIcon } from "../ui/icons";

/** A round white button with an icon (`RoundButton` in Design/Chrome.swift). */
export function RoundButton({ label, onClick, selected, children }: { label: string; onClick: () => void; selected?: boolean; children: ReactNode }) {
  const press = usePress();
  return (
    <motion.button type="button" {...press} aria-label={label} aria-pressed={selected} onClick={onClick} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_2px_4px_rgba(20,17,43,0.16)]">
      {children}
    </motion.button>
  );
}

/**
 * The back button of pushed screens: a round button with the chevron pointing right. It goes back to the page before, or to `fallback` when the screen was opened
 * by its link; a screen that must ask first (a face not saved) gives `onBack`, which is what a press does then.
 */
export function BackButton({ fallback, onBack }: { fallback: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <RoundButton label="برگشت" onClick={onBack ?? (() => (canGoBack() ? router.back() : router.push(fallback)))}>
      <ChevronRightIcon size={20} lineWidth={2.6} />
    </RoundButton>
  );
}

/** The header of Library, Section and similar screens: back button, title (Lalezar 30) and a small line under it. */
export function ScreenHeader({ title, subtitle, fallback }: { title: string; subtitle?: string; fallback: string }) {
  return (
    <div className="flex items-center gap-3">
      <BackButton fallback={fallback} />
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-2 text-[30px] text-ink">{title}</h1>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/** The search field of the library screens: a white box with the magnifier (`round` is the capsule of the search screen). */
export function SearchBox({ value, onChange, placeholder, round, autoFocus }: { value: string; onChange: (value: string) => void; placeholder: string; round?: boolean; autoFocus?: boolean }) {
  return (
    <label className={`flex items-center gap-2.5 bg-white px-4 ${round ? "h-[50px] flex-1 rounded-full shadow-[0_2px_5px_rgba(20,17,43,0.12)]" : "h-12 rounded-2xl shadow-[0_2px_4px_rgba(20,17,43,0.06)]"}`}>
      <span className="text-muted">
        <ExploreIcon size={round ? 20 : 18} lineWidth={round ? 2.4 : 2.2} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-[#8A8698] [&::-webkit-search-cancel-button]:hidden ${round ? "text-[15px]" : "text-sm"}`}
      />
    </label>
  );
}

/** A thin progress bar; a little is always visible once there is any progress. */
export function ProgressBar({ fraction, height, track, fill }: { fraction: number; height: number; track: string; fill: string }) {
  return (
    <div aria-hidden className={`relative w-full overflow-hidden rounded-full ${track}`} style={{ height }}>
      <div className={`absolute inset-y-0 start-0 rounded-full ${fill}`} style={{ width: `${fraction * 100}%`, minWidth: fraction > 0 ? height : 0 }} />
    </div>
  );
}
