"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { rowArrival, useVariant, bouncy } from "../../lib/motion";
import { relativeDay } from "../../lib/me/divanDays";
import type { DivanEntry } from "../../lib/me/divanLogic";
import { routeURL } from "../../lib/reader/route";
import { BookmarkIcon } from "../ui/icons";

/** One kept couplet (Me/Divan/DivanScreen.swift `card`): the two hemistichs, «غزل ۳ · دیروز», and the bookmark that takes it out (with «برگردون»). A tap on the card opens the reader at it. */
export function DivanCard({ entry, now, onUnkeep }: { entry: DivanEntry; now: Date; onUnkeep: (entry: DivanEntry) => void }) {
  const v = useVariant();
  const arrival = rowArrival(v);
  return (
    <motion.div layout="position" initial={arrival} animate={{ opacity: 1, scale: 1, y: 0 }} exit={arrival} transition={bouncy} data-testid={`divan-couplet-${entry.key}`} className="relative rounded-[20px] bg-white py-3 ps-4 pe-2 pb-1.5 shadow-[0_3px_6px_rgba(20,17,43,0.06)]">
      <Link href={routeURL(entry.path, entry.index, "couplet")} aria-label={`${entry.couplet.m1} ${entry.couplet.m2}`} className="absolute inset-0 rounded-[20px]" />
      <div className="font-poem text-base leading-[2.1] text-ink">
        <p>{entry.couplet.m1}</p>
        {entry.couplet.m2 && <p className="text-end">{entry.couplet.m2}</p>}
      </div>
      <div className="flex items-center">
        <span className="flex-1 text-[11px] text-[#8A8698]">
          {entry.title} · {relativeDay(entry.keptAt, now)}
        </span>
        <button type="button" aria-label="نگه دار" aria-pressed data-testid={`unkeep-${entry.key}`} onClick={() => onUnkeep(entry)} className="relative z-10 grid h-7 w-9 place-items-center text-lapis">
          <BookmarkIcon size={18} lineWidth={2} fill="currentColor" />
        </button>
      </div>
    </motion.div>
  );
}

/** The cards of a section, which scale in and out as couplets come and go (`Motion.row`). */
export function DivanCards({ entries, now, onUnkeep }: { entries: readonly DivanEntry[]; now: Date; onUnkeep: (entry: DivanEntry) => void }) {
  return (
    <AnimatePresence initial={false}>
      {entries.map((entry) => (
        <DivanCard key={entry.key} entry={entry} now={now} onUnkeep={onUnkeep} />
      ))}
    </AnimatePresence>
  );
}
