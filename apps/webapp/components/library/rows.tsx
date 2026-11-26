import Link from "next/link";
import type { ReactNode } from "react";
import type { LibraryBook, LibraryPoet } from "../../lib/library/models";
import { plain } from "../../lib/library/normalize";
import { bookHref, poetHref } from "../../lib/library/routes";
import type { CoupletEntry } from "../../lib/library/search";
import { routeURL } from "../../lib/reader/route";
import { caption } from "../../lib/reader/text";
import { ChevronLeftIcon } from "../ui/icons";
import { BookCover } from "./BookCover";
import { PoetCircle } from "./PoetCircle";

/** The card behind a row of a list (`listCard`): white, a faint shadow. */
export const listCard = "bg-white shadow-[0_2px_4px_rgba(20,17,43,0.05)]";

const quietIcon = "text-[#8A8698]";

/** A book cover with its title (up to two lines) and the poet's name under it. */
export function BookTile({ book, poetName, titleSize = 15 }: { book: LibraryBook; poetName: string; titleSize?: number }) {
  return (
    <Link href={bookHref(book)} data-testid={`book-${book.id}`} className="flex flex-col gap-1.5">
      <BookCover color={book.color} className="w-full" />
      <span className="line-clamp-2 font-title leading-[1.5] text-ink" style={{ fontSize: titleSize }}>
        {book.title}
      </span>
      <span className="-mt-1 truncate text-xs text-muted">{poetName}</span>
    </Link>
  );
}

/** A row of the book's sections or a section's children: the title, «۴۹۵ غزل», the «داری می‌خونی» badge and the chevron. */
export function SectionRow({ title, detail, reading, href }: { title: string; detail: string; reading?: boolean; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-1 py-[13px]">
      <span className="text-[15px] font-bold text-ink">{title}</span>
      <span className="text-xs text-[#8A8698]">{detail}</span>
      {reading && <span className="rounded-full bg-lapis-tint px-2 py-0.5 text-[11px] font-bold text-lapis">داری می‌خونی</span>}
      <span className={`ms-auto ${quietIcon}`}>
        <ChevronLeftIcon size={16} lineWidth={2.4} />
      </span>
    </Link>
  );
}

/** The white card round a list of `SectionRow`s, with a hairline between them. */
export function SectionList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="divide-y-2 divide-paper rounded-[22px] bg-white px-3.5 py-0.5 shadow-[0_2px_5px_rgba(20,17,43,0.06)]">
      {children}
    </div>
  );
}

/** A couplet in a list (search, a mood): the two hemistichs, and «حافظ · غزل ۳ · بیت ۲» under them. Opens the reader at it. */
export function CoupletRow({ entry, poetName }: { entry: CoupletEntry; poetName: string }) {
  return (
    <Link href={routeURL(entry.path, entry.index, "couplet")} data-testid={`couplet-${entry.id}`} className={`block rounded-[18px] px-3.5 py-2.5 text-ink ${listCard}`}>
      <span className="block font-poem text-base leading-[1.7]">{plain(entry.couplet.m1)}</span>
      {entry.couplet.m2 && <span className="block font-poem text-base leading-[1.7]">{plain(entry.couplet.m2)}</span>}
      <span className="mt-1 block text-[11px] text-[#8A8698]">{caption(poetName, entry.title, entry.index)}</span>
    </Link>
  );
}

/** «چیزی پیدا نشد» */
export const NothingFound = () => (
  <p data-testid="nothing-found" className="pt-10 text-center font-title text-xl text-muted">
    چیزی پیدا نشد
  </p>
);

/** A poet in the search results: the circle, the name and what they are known for. */
export function PoetRow({ poet }: { poet: LibraryPoet }) {
  return (
    <Link href={poetHref(poet.slug)} className={`flex items-center gap-3 rounded-[18px] px-3 py-2 text-ink ${listCard}`}>
      <PoetCircle poet={poet} size={40} border={3} />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="text-[15px] font-bold">{poet.name}</span>
        <span className="text-xs text-muted">{poet.tag}</span>
      </span>
      <span className={quietIcon}>
        <ChevronLeftIcon size={16} lineWidth={2.4} />
      </span>
    </Link>
  );
}

/** A book in the search results: the little cover, the title and the poet. */
export function BookRow({ book, poetName }: { book: LibraryBook; poetName: string }) {
  return (
    <Link href={bookHref(book)} className={`flex items-center gap-3 rounded-[20px] px-3 py-2 text-ink ${listCard}`}>
      <BookCover color={book.color} className="w-[34px] shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="line-clamp-2 text-sm font-bold">{book.title}</span>
        <span className="text-xs text-muted">{poetName}</span>
      </span>
      <span className={quietIcon}>
        <ChevronLeftIcon size={16} lineWidth={2.4} />
      </span>
    </Link>
  );
}
