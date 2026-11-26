"use client";

import { useState } from "react";
import Link from "next/link";
import { useBookIndex, useProgress, type LibraryData } from "../../lib/library/browser";
import { bookTypes, type BookType, type LibraryBook } from "../../lib/library/models";
import { contains, normalize } from "../../lib/library/normalize";
import type { Last } from "../../lib/library/progress";
import { bookHref } from "../../lib/library/routes";
import { persianDigits } from "../../lib/persian";
import { Screen } from "../shell/Screen";
import { BookCover } from "./BookCover";
import { ProgressBar, ScreenHeader, SearchBox } from "./chrome";
import { BookTile } from "./rows";
import { WithLibrary } from "./WithLibrary";

function Chip({ title, on, onClick }: { title: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`h-[34px] shrink-0 rounded-full px-[13px] text-[13px] ${on ? "bg-ink font-bold text-white" : "bg-white font-medium text-ink"}`}>
      {title}
    </button>
  );
}

/** «ادامه بده»: the book last read from, where it was left, and how far along it is. */
function ContinueCard({ data, book, last }: { data: LibraryData; book: LibraryBook; last: Last }) {
  const fraction = useBookIndex(data, book)?.fraction(last.path) ?? 0;
  return (
    <Link href={bookHref(book)} data-testid="continue" className="flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-2.5 shadow-[0_2px_4px_rgba(20,17,43,0.05)]">
      <BookCover color={book.color} className="w-[34px] shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span className="text-xs text-muted">ادامه بده</span>
        <span className="truncate text-sm font-bold text-ink">{`${book.title} · ${last.title}`}</span>
        <ProgressBar fraction={fraction} height={6} track="bg-track-light" fill="bg-lapis" />
      </span>
    </Link>
  );
}

/** All the books: search, «ادامه بده», type chips and a three-column grid (Library/LibraryScreen.swift). */
export function LibraryScreen() {
  return <WithLibrary>{(data) => <Books data={data} />}</WithLibrary>;
}

function Books({ data }: { data: LibraryData }) {
  const { library } = data;
  const progress = useProgress();
  const [type, setType] = useState<BookType>();
  const [query, setQuery] = useState("");
  const last = progress.last;
  const lastBook = last && library.bookContaining(last.path);
  const shown = library.books.filter(
    (book) => (type === undefined || book.type === type) && (normalize(query) === "" || contains(book.title, query) || contains(library.poetOf(book)?.name ?? "", query)),
  );
  return (
    <Screen header={<ScreenHeader title="کتابخونه" subtitle={`${persianDigits(library.books.length)} کتاب از ${persianDigits(library.poetCount)} شاعر`} fallback="/explore" />}>
      <div className="flex flex-col gap-3.5 pt-1.5">
        <SearchBox value={query} onChange={setQuery} placeholder="کتاب یا شاعر…" />
        {last && lastBook && <ContinueCard data={data} book={lastBook} last={last} />}
        <div role="group" aria-label="نوع کتاب" className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip title="همه" on={type === undefined} onClick={() => setType(undefined)} />
          {bookTypes.map((kind) => (
            <Chip key={kind.type} title={kind.title} on={type === kind.type} onClick={() => setType(kind.type)} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-x-3.5 gap-y-4">
          {shown.map((book) => (
            <BookTile key={book.id} book={book} poetName={library.poetOf(book)?.name ?? ""} />
          ))}
        </div>
      </div>
    </Screen>
  );
}
