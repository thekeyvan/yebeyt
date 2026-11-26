"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useDeck } from "../../lib/games/browser";
import { poetGameURL } from "../../lib/games/kinds";
import { hasRound } from "../../lib/games/quizRounds";
import type { LibraryPoet } from "../../lib/library/models";
import { usePress } from "../../lib/motion";
import { ChevronLeftIcon, GamesIcon } from "../ui/icons";

const PressLink = motion.create(Link);

/** «بازی با بیت‌های حافظ»: مصراع دوم with that poet's couplets only. It shows for the poets the game deck has (Library/PoetScreen.swift `gameCard`). */
export function PoetGameCard({ poet }: { poet: LibraryPoet }) {
  const press = usePress();
  const deck = useDeck().value;
  if (!deck || !hasRound(deck, poet.slug)) return null;
  return (
    <PressLink
      href={poetGameURL(poet.slug)}
      {...press}
      data-testid="poet-game"
      className="flex items-center gap-3 rounded-[22px] border-[5px] border-white bg-amber py-3 ps-3.5 pe-3.5 text-ink shadow-card"
    >
      <span className="grid size-[42px] shrink-0 place-items-center rounded-full border-[3px] border-white bg-lapis text-white">
        <GamesIcon size={22} lineWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-title text-xl leading-[1.4]">{`بازی با بیت‌های ${poet.name}`}</span>
        <span className="truncate text-xs font-medium">{`یه دورِ ۱۰ سؤالی، فقط از ${poet.name}`}</span>
      </span>
      <span className="flex items-center gap-1 rounded-full bg-lapis px-3 py-[7px] text-[13px] font-bold text-white">
        شروع
        <ChevronLeftIcon size={14} lineWidth={3} />
      </span>
    </PressLink>
  );
}
