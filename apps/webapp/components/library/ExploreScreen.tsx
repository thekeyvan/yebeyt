"use client";

import Link from "next/link";
import { moodHref, libraryHref, poetHref, poetsHref, searchHref, bookHref } from "../../lib/library/routes";
import { Screen } from "../shell/Screen";
import { ExploreIcon } from "../ui/icons";
import { BookTile } from "./rows";
import { FalCard } from "./FalCard";
import { PoetTile } from "./PoetCircle";
import { WithLibrary } from "./WithLibrary";

const rowScroll = "-mx-[18px] flex overflow-x-auto px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** A heading with its link on the other side («شاعرها» … «همه»). */
function SectionHeading({ title, link, href }: { title: string; link: string; href: string }) {
  return (
    <div className="flex items-center justify-between pt-0.5">
      <h2 className="text-[22px] text-ink">{title}</h2>
      <Link href={href} className="text-[13px] font-bold text-lapis">
        {link}
      </Link>
    </div>
  );
}

/** The کاوش tab: search, the Hafez fal, moods, poets and the library shelf. «پرطرفدارها» stays hidden until friends exist (Explore/ExploreView.swift). */
export function ExploreScreen() {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <h1 className="text-[40px] leading-[1.4] text-ink">کاوش</h1>
        <Link href={searchHref()} aria-label="جستجو" data-testid="search-field" className="flex h-[50px] items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_2px_5px_rgba(20,17,43,0.12)]">
          <span className="text-muted">
            <ExploreIcon size={20} lineWidth={2.4} />
          </span>
          <span className="text-[15px] text-[#8A8698]">شاعر، شعر یا یه تیکه از بیت…</span>
        </Link>
        <FalCard />
        <WithLibrary inScreen>
          {({ library }) => (
            <>
              <div className={`${rowScroll} gap-2 py-1`}>
                {library.moods.map((mood) => (
                  <Link key={mood.key} href={moodHref(mood.key)} className="shrink-0 rounded-full bg-white px-[13px] py-1.5 text-[13px] font-medium text-ink shadow-[0_2px_3px_rgba(20,17,43,0.1)]">
                    {mood.title}
                  </Link>
                ))}
              </div>
              <SectionHeading title="شاعرها" link="همه" href={poetsHref} />
              <div className={`${rowScroll} items-start gap-2.5 pt-0.5 pb-3`}>
                {library.explorePoets.map((poet) => (
                  <Link key={poet.slug} href={poetHref(poet.slug)} className="shrink-0">
                    <PoetTile poet={poet} />
                  </Link>
                ))}
              </div>
              <SectionHeading title="کتابخونه" link="همه‌ی کتاب‌ها" href={libraryHref} />
              <div className="grid grid-cols-3 gap-3">
                {library.books.slice(0, 3).map((book) => (
                  <BookTile key={book.id} book={book} poetName={library.poetOf(book)?.name ?? ""} titleSize={16} />
                ))}
              </div>
            </>
          )}
        </WithLibrary>
      </div>
    </Screen>
  );
}
