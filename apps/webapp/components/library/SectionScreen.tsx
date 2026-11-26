"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBookIndex, useProgress, type LibraryData } from "../../lib/library/browser";
import type { IndexedPoem } from "../../lib/library/bookIndex";
import { subtreeIds, type BookSection, type LibraryBook } from "../../lib/library/models";
import { normalize, plain } from "../../lib/library/normalize";
import { bookHref, ganjoorPath, sectionHref } from "../../lib/library/routes";
import { filtered, sectionSorts, sorted, type SectionSort } from "../../lib/library/sectionList";
import { persianDigits } from "../../lib/persian";
import { routeURL } from "../../lib/reader/route";
import { Screen } from "../shell/Screen";
import { Segmented } from "../ui/Segmented";
import { SegmentPage } from "../ui/SegmentPage";
import { CheckIcon } from "../ui/icons";
import { ScreenHeader, SearchBox } from "./chrome";
import { listCard, SectionList, SectionRow } from "./rows";
import { Missing, WithLibrary } from "./WithLibrary";

/** A poem in a section list: its number, the first line, the couplet count and the read mark. The poem in progress is tinted. */
function PoemRow({ poem }: { poem: IndexedPoem }) {
  const progress = useProgress();
  const reading = progress.isInProgress(poem.path);
  return (
    <Link
      href={routeURL(poem.path, 0, "couplet")}
      data-testid={`poem-${poem.number}`}
      className={`flex items-center gap-3 rounded-[18px] px-3 py-2.5 [contain-intrinsic-size:auto_69px] [content-visibility:auto] ${reading ? "bg-lapis-tint" : listCard}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl pt-[3px] font-title text-base ${reading ? "bg-lapis text-white" : "bg-paper text-ink"}`}>{persianDigits(poem.number)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-poem text-base leading-[1.7] text-ink">{plain(poem.first)}</span>
        <span className="flex items-center gap-2 text-[11px] text-[#8A8698]">
          {`${persianDigits(poem.couplets)} بیت`}
          {reading ? (
            <b className="text-lapis">داری می‌خونی</b>
          ) : (
            progress.isRead(poem.path) && (
              <b className="flex items-center gap-[3px] text-[#3E9A1E]">
                <span className="text-green">
                  <CheckIcon size={16} lineWidth={3} />
                </span>
                خوندی
              </b>
            )
          )}
        </span>
      </span>
    </Link>
  );
}

/** A section of a book: its child sections, then its poems, searchable and sortable, with the read marks (Library/SectionScreen.swift). */
export function SectionScreen({ segments }: { segments: string[] }) {
  return (
    <WithLibrary>
      {(data) => {
        const found = data.library.sectionAt(ganjoorPath(segments));
        return found ? <Section data={data} book={found.book} section={found.section} /> : <Missing fallback="/explore/library" />;
      }}
    </WithLibrary>
  );
}

function Section({ data, book, section }: { data: LibraryData; book: LibraryBook; section: BookSection }) {
  const index = useBookIndex(data, book);
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SectionSort>("number");
  const poems = useMemo(() => index?.poemsIn(section.id) ?? [], [index, section.id]);
  const shown = useMemo(() => sorted(filtered(poems, query), sort), [poems, query, sort]);
  const read = progress.readCount(poems.map((poem) => poem.path));
  const children = section.sections ?? [];
  const readingCat = progress.last && progress.isInProgress(progress.last.path) ? index?.poem(progress.last.path)?.catId : undefined;
  // «دیوان حافظ · ۴۹۵ غزل · ۲ تا خوندی»
  const subtitle = [book.title, `${persianDigits(section.count)} ${section.unit}`, read > 0 && `${persianDigits(read)} تا خوندی`].filter(Boolean).join(" · ");
  return (
    <Screen header={<ScreenHeader title={section.title} subtitle={subtitle} fallback={bookHref(book)} />}>
      <div className="flex flex-col gap-2 pt-1.5">
        <SearchBox value={query} onChange={setQuery} placeholder={`یه کلمه یا شماره‌ی ${section.unit}…`} />
        <div className="flex items-center gap-2.5 py-1.5">
          <span className="text-[13px] font-bold text-muted">ترتیب:</span>
          <Segmented look="divan" label="ترتیب" value={sort} onValueChange={setSort} options={sectionSorts.map(({ sort: value, title }) => ({ value, label: title }))} />
        </div>
        {children.length > 0 && normalize(query) === "" && (
          <div className="pb-1">
            <SectionList>
              {children.map((child) => (
                <SectionRow key={child.id} title={child.title} detail={`${persianDigits(child.count)} ${child.unit}`} reading={readingCat !== undefined && subtreeIds(child).has(readingCat)} href={sectionHref(child.path)} />
              ))}
            </SectionList>
          </div>
        )}
        <SegmentPage value={sort} order={sectionSorts.map(({ sort: value }) => value)}>
          <div className="flex flex-col gap-2">
            {shown.map((poem) => (
              <PoemRow key={poem.id} poem={poem} />
            ))}
          </div>
        </SegmentPage>
      </div>
    </Screen>
  );
}
