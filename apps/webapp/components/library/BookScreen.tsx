"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { useBookIndex, useFollows, useProgress, type LibraryData } from "../../lib/library/browser";
import type { BookIndex } from "../../lib/library/bookIndex";
import { bookMeta, bookRows, mainSection, poemShortTitle, subtreeIds, type LibraryBook } from "../../lib/library/models";
import type { Last } from "../../lib/library/progress";
import { ganjoorPath, poetHref, sectionHref } from "../../lib/library/routes";
import { usePress } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";
import { routeURL } from "../../lib/reader/route";
import { Screen } from "../shell/Screen";
import { BookmarkIcon, DiceIcon } from "../ui/icons";
import { BookCover } from "./BookCover";
import { PoetCircle } from "./PoetCircle";
import { ProgressBar, BackButton, RoundButton } from "./chrome";
import { SectionList, SectionRow } from "./rows";
import { Missing, WithLibrary } from "./WithLibrary";

const primaryCard = "flex flex-1 flex-col gap-1.5 rounded-[20px] border-4 border-white bg-lapis px-3.5 py-2.5 text-white shadow-[0_4px_12px_rgba(20,17,43,0.28)]";

/** «ادامه: غزل ۳» with progress when this book is being read, else «شروع: غزل ۱». */
function Primary({ book, index, last }: { book: LibraryBook; index: BookIndex; last?: Last }) {
  const first = index.firstIn(bookRows(book)[0]!) ?? index.poems[0];
  if (!last && !first) return null;
  return (
    <Link href={last ? routeURL(last.path, last.couplet, "couplet") : routeURL(first!.path, 0, "couplet")} data-testid="primary" className={primaryCard}>
      <span className="truncate text-[15px] font-bold">{last ? `ادامه: ${last.title}` : `شروع: ${poemShortTitle(book, first!)}`}</span>
      {last && <ProgressBar fraction={index.fraction(last.path) ?? 0} height={5} track="bg-white/30" fill="bg-white" />}
    </Link>
  );
}

function RandomButton({ book, index }: { book: LibraryBook; index: BookIndex }) {
  const router = useRouter();
  const press = usePress();
  function pick() {
    const poems = index.poemsInAny(subtreeIds(mainSection(book)));
    const poem = poems[Math.floor(Math.random() * poems.length)];
    if (poem) router.push(routeURL(poem.path, 0, "couplet"));
  }
  return (
    <motion.button type="button" {...press} onClick={pick} data-testid="random" className="flex items-center gap-1.5 rounded-[20px] bg-white px-3.5 text-sm font-bold text-ink shadow-[0_2px_4px_rgba(20,17,43,0.08)]">
      <DiceIcon size={18} lineWidth={2.2} />
      {`یه ${book.unit} تصادفی`}
    </motion.button>
  );
}

function Header({ book, chip }: { book: LibraryBook; chip: ReactNode }) {
  return (
    <div className="flex items-end gap-4">
      <BookCover color={book.color} className="w-28 shrink-0 -rotate-3" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pb-2">
        <h1 className="line-clamp-3 text-[30px] text-ink">{book.title}</h1>
        {chip}
        <p className="text-xs text-muted">{bookMeta(book)}</p>
      </div>
    </div>
  );
}

/** One book: cover, poet, where to start or continue, a random poem, the blurb and the sections (Library/BookScreen.swift). */
export function BookScreen({ segments }: { segments: string[] }) {
  return (
    <WithLibrary>
      {(data) => {
        const book = data.library.bookAt(ganjoorPath(segments));
        return book ? <Book data={data} book={book} /> : <Missing fallback="/explore/library" />;
      }}
    </WithLibrary>
  );
}

function Book({ data, book }: { data: LibraryData; book: LibraryBook }) {
  const { library } = data;
  const index = useBookIndex(data, book);
  const progress = useProgress();
  const follows = useFollows();
  const poet = library.poetOf(book);
  const item = { kind: "book", id: book.id } as const;
  const kept = follows.contains(item);
  const last = progress.last && library.bookContaining(progress.last.path)?.id === book.id ? progress.last : undefined;
  const readingCat = progress.last && progress.isInProgress(progress.last.path) ? index?.poem(progress.last.path)?.catId : undefined;
  return (
    <Screen
      header={
        <div className="flex items-center justify-between">
          <BackButton fallback="/explore/library" />
          <RoundButton label="نگه داشتن کتاب" selected={kept} onClick={() => follows.toggle(item)}>
            <BookmarkIcon size={20} lineWidth={2.2} fill={kept ? "currentColor" : undefined} />
          </RoundButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 pt-1.5">
        <Header
          book={book}
          chip={
            poet && (
              <Link href={poetHref(poet.slug)} data-testid="poet-chip" className="flex items-center gap-1.5 rounded-full bg-white py-[3px] ps-1 pe-3">
                <PoetCircle poet={poet} size={26} border={0} />
                <span className="text-[13px] font-bold text-ink">{poet.name}</span>
              </Link>
            )
          }
        />
        {index && (
          <div className="flex gap-2">
            <Primary book={book} index={index} last={last} />
            <RandomButton book={book} index={index} />
          </div>
        )}
        <p className="line-clamp-3 text-[13px] leading-[1.9] text-muted">{book.blurb}</p>
        <SectionList label="بخش‌های کتاب">
          {bookRows(book).map((section) => (
            <SectionRow
              key={section.id}
              title={section.title}
              detail={`${persianDigits(section.count)} ${section.unit}`}
              reading={readingCat !== undefined && subtreeIds(section).has(readingCat)}
              href={sectionHref(section.path)}
            />
          ))}
          {book.poems?.map((poem) => <SectionRow key={poem.id} title={poem.title} detail={persianDigits(1)} href={routeURL(poem.path, 0, "couplet")} />)}
        </SectionList>
      </div>
    </Screen>
  );
}
