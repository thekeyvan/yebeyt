"use client";

import { cn } from "../../lib/cn";
import type { Library } from "../../lib/library/library";
import { persianDigits } from "../../lib/persian";
import { poetCounts, type DivanEntry } from "../../lib/me/divanLogic";
import { PoetCircle } from "../library/PoetCircle";

const chip = "flex h-10 shrink-0 items-center gap-1.5 rounded-full text-[13px] shadow-[0_2px_3px_rgba(20,17,43,0.06)]";

/** «همه ۳۸» and a chip for each poet of the divan with its count: one is on at a time and filters the list (Me/Divan/DivanScreen.swift `poetChips`). */
export function PoetChips({ entries, poet, onPoet, library }: { entries: readonly DivanEntry[]; poet: string | undefined; onPoet: (slug: string | undefined) => void; library: Library | undefined }) {
  return (
    <div className="-mx-[18px] overflow-x-auto px-[18px] pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        <button type="button" aria-pressed={poet === undefined} data-testid="poet-chip-all" onClick={() => onPoet(undefined)} className={cn(chip, "px-3.5", poet === undefined ? "bg-ink text-white shadow-none" : "bg-white text-ink")}>
          <span className="font-bold">همه</span>
          <span className="opacity-70">{persianDigits(entries.length)}</span>
        </button>
        {poetCounts(entries).map(({ slug, count }) => {
          const on = poet === slug;
          const known = library?.poet(slug);
          return (
            <button key={slug} type="button" aria-pressed={on} data-testid={`poet-chip-${slug}`} onClick={() => onPoet(on ? undefined : slug)} className={cn(chip, "pe-3 ps-1", on ? "bg-ink text-white shadow-none" : "bg-white text-ink")}>
              {known && <PoetCircle poet={known} size={32} border={2} />}
              <span className={on ? "font-bold" : "font-medium"}>{known?.name ?? slug}</span>
              <span className={on ? "text-white/70" : "text-[#8A8698]"}>{persianDigits(count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
