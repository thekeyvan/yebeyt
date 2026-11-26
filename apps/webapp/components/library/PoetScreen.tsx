"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useBookIndex, useFollows, type LibraryData } from "../../lib/library/browser";
import { poetPlace, type LibraryPoet } from "../../lib/library/models";
import { plain } from "../../lib/library/normalize";
import { poetChips, topPoems, type TopPoems } from "../../lib/library/poetPage";
import { usePress } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";
import { routeURL } from "../../lib/reader/route";
import { Screen } from "../shell/Screen";
import { ChevronDownIcon, ChevronLeftIcon } from "../ui/icons";
import { PoetCircle } from "./PoetCircle";
import { BackButton } from "./chrome";
import { onColor, tokenColor } from "./palette";
import { Missing, WithLibrary } from "./WithLibrary";

/** The name at 64, shrunk to one line for a long one (the card's width, as the board's `minimumScaleFactor` 0.4): Lalezar's letters are about half an em wide. */
const nameSize = (name: string): string => `max(26px, min(64px, ${(100 / (Math.max(name.length, 1) * 0.55)).toFixed(1)}cqw))`;

function FollowButton({ slug }: { slug: string }) {
  const follows = useFollows();
  const press = usePress();
  const item = { kind: "poet", slug } as const;
  const following = follows.contains(item);
  return (
    <motion.button
      type="button"
      {...press}
      aria-pressed={following}
      data-testid="follow"
      onClick={() => follows.toggle(item)}
      className={`rounded-full border-[3px] border-white px-4 py-[7px] text-sm font-bold shadow-[0_2px_8px_rgba(20,17,43,0.22)] ${following ? "bg-white text-ink" : "bg-lapis text-white"}`}
    >
      {following ? "دنبال می‌کنی" : "دنبال کن"}
    </motion.button>
  );
}

/** The card in the poet's colour: the name at 64, the place, the bio (three lines, then «بیشتر بخون»), the circle and the tilted tag. */
function Hero({ poet }: { poet: LibraryPoet }) {
  const [open, setOpen] = useState(false);
  const place = poetPlace(poet);
  return (
    <div className={`relative mt-2 rounded-[28px] border-[5px] border-white px-5 pt-5 pb-[18px] shadow-[0_4px_14px_rgba(20,17,43,0.22)] ${onColor(poet.color)}`} style={{ background: tokenColor[poet.color] }}>
      <div className="flex flex-col items-start gap-1.5">
        <div className="min-h-16 w-full pe-[110px] pt-2 [container-type:inline-size]">
          <h1 data-testid="poet-name" className="truncate leading-none" style={{ fontSize: nameSize(poet.name) }}>
            {poet.name}
          </h1>
        </div>
        {place && <p className="text-sm opacity-80">{place}</p>}
        <p className={`text-sm leading-[1.8] ${open ? "" : "line-clamp-3"}`}>{poet.bio}</p>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 flex items-center gap-1 rounded-full bg-current/[0.18] px-3 py-1 text-[13px] font-bold">
          بیشتر بخون
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <ChevronDownIcon size={12} lineWidth={3} />
          </span>
        </button>
      </div>
      <span className="absolute end-[21px] top-[21px]">
        <PoetCircle poet={poet} size={96} border={4} onCard />
      </span>
      <span aria-hidden className="pointer-events-none absolute start-[23px] -top-[9px] rotate-[6deg] rounded-full border-[3px] border-white bg-amber px-[11px] pt-[5px] pb-[3px] font-title text-[15px] leading-[1.3] text-ink shadow-[0_2px_6px_rgba(20,17,43,0.22)]">
        {poet.tag}
      </span>
    </div>
  );
}

/** «پرخواننده‌ترین غزل‌ها»: the poet's three most recited poems. */
function TopCard({ top }: { top: TopPoems }) {
  return (
    <section className="rounded-[22px] bg-white px-3.5 pb-1 shadow-[0_3px_6px_rgba(20,17,43,0.12)]">
      <h2 className="pt-2.5 font-ui text-[13px] leading-[1.8] font-bold text-lapis">{top.heading}</h2>
      <ol className="divide-y-2 divide-chip-border">
        {top.poems.map((poem, offset) => (
          <li key={poem.id}>
            <Link href={routeURL(poem.path, 0, "couplet")} data-testid={`top-${offset + 1}`} className="flex items-center gap-3 py-3">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-[10px] bg-paper text-[13px] font-bold text-muted">{persianDigits(offset + 1)}</span>
              <span className="min-w-0 flex-1 truncate font-poem text-base text-ink">{plain(poem.first)}</span>
              <span className="text-[#B9B4C6]">
                <ChevronLeftIcon size={16} lineWidth={2.6} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A poet's page: follow, the card in the poet's colour, their books or sections and the most read poems (Library/PoetScreen.swift). The game card comes with the games (W3). */
export function PoetScreen({ slug }: { slug: string }) {
  return (
    <WithLibrary>
      {(data) => {
        const poet = data.library.poet(slug);
        return poet ? <Poet data={data} poet={poet} /> : <Missing fallback="/explore" />;
      }}
    </WithLibrary>
  );
}

function Poet({ data, poet }: { data: LibraryData; poet: LibraryPoet }) {
  const { library } = data;
  const index = useBookIndex(data, library.mainBook(poet.slug));
  const top = index && topPoems(library, poet.slug, index);
  return (
    <Screen
      header={
        <div className="flex items-center justify-between">
          <BackButton fallback="/explore" />
          <FollowButton slug={poet.slug} />
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 pt-1.5">
        <Hero poet={poet} />
        <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {poetChips(library, poet.slug).map((chip) => (
            <Link key={chip.id} href={chip.href} className="flex-1 rounded-2xl bg-white px-3 py-2.5 text-center text-[13px] font-bold whitespace-nowrap text-ink shadow-[0_2px_4px_rgba(20,17,43,0.1)]">
              {chip.title}
            </Link>
          ))}
        </div>
        {top && top.poems.length > 0 && <TopCard top={top} />}
      </div>
    </Screen>
  );
}
