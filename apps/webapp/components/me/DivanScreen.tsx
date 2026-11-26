"use client";

import Link from "next/link";
import { useState } from "react";
import { DivanCards } from "./DivanCard";
import { useLibraryData, useStore, type LibraryData } from "../../lib/library/browser";
import { groupings, filterEntries, groupSections, type DivanEntry, type DivanGrouping, type DivanSection } from "../../lib/me/divanLogic";
import { persianDigits } from "../../lib/persian";
import { useMarks } from "../../lib/reader/browser";
import type { Services } from "../../lib/account/services";
import { PoetCircle } from "../library/PoetCircle";
import { SearchBox } from "../library/chrome";
import { NothingFound } from "../library/rows";
import { Screen } from "../shell/Screen";
import { Segmented } from "../ui/Segmented";
import { SegmentPage } from "../ui/SegmentPage";
import { toast } from "../ui/Toast";
import { MeCard, MeHeader } from "./chrome";
import { LockIcon } from "./icons";
import { PoetChips } from "./PoetChips";
import { useDivanEntries } from "./useDivanEntries";
import { WithServices } from "./WithServices";

/** دیوانِ من: the kept couplets, with search, grouping by poet, topic or newest, and poet chips (Me/Divan/DivanScreen.swift). */
export function DivanScreen() {
  return <WithServices>{(services) => <Divan services={services} />}</WithServices>;
}

function Divan({ services }: { services: Services }) {
  const marks = useMarks();
  const privacy = useStore(services.privacy);
  const { value: data } = useLibraryData();
  const [query, setQuery] = useState("");
  const [grouping, setGrouping] = useState<DivanGrouping>("poet");
  const [poet, setPoet] = useState<string>();
  const kept = marks.keptItems();
  const { entries: loaded, loading } = useDivanEntries(kept);
  // What the divan holds now: a couplet taken out stays out of the lists at once, without waiting for a reload.
  const keptKeys = marks.keys("kept");
  const entries = loaded.filter((entry) => keptKeys.has(entry.key));
  const poetName = (slug: string) => data?.library.poet(slug)?.name ?? slug;
  const shown = filterEntries(entries, query, poet, poetName);
  const sections = groupSections(shown, grouping, data?.library.moods ?? [], poetName);
  const unkeep = ({ path, index }: DivanEntry) => marks.toggleKept(path, index, (text, undo) => toast(text, undo));
  const everyone = privacy?.keptVisibility !== "me";
  return (
    <Screen
      header={
        <MeHeader title="دیوانِ من" subtitle={`${persianDigits(kept.length)} بیت`}>
          <Link href="/me/privacy" data-testid="divan-visibility" className="flex h-8 items-center gap-1.5 rounded-full bg-white px-[11px] text-xs font-bold text-muted">
            {!everyone && <LockIcon size={14} lineWidth={2.4} />}
            {everyone ? "دوستا" : "فقط من"}
          </Link>
        </MeHeader>
      }
    >
      <div className="flex flex-col gap-3.5">
        {entries.length === 0 && !loading ? (
          <MeCard data-testid="divan-empty" className="rounded-[20px] p-4 text-sm leading-[2] text-muted">
            هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.
          </MeCard>
        ) : (
          <>
            <SearchBox value={query} onChange={setQuery} placeholder="توی دیوانت بگرد: یه کلمه، یه شاعر…" />
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-bold text-muted">دسته‌بندی:</span>
              <div className="flex-1">
                <Segmented value={grouping} onValueChange={setGrouping} options={groupings} label="دسته‌بندی" look="divan" />
              </div>
            </div>
            <PoetChips entries={entries} poet={poet} onPoet={setPoet} library={data?.library} />
            {shown.length === 0 && entries.length > 0 && <NothingFound />}
            <SegmentPage value={grouping} order={groupings.map(({ value }) => value)}>
              <div className="flex flex-col gap-[18px]">
                {sections.map((section) => (
                  <Section key={section.id} section={section} onPoet={setPoet} data={data} onUnkeep={unkeep} />
                ))}
              </div>
            </SegmentPage>
          </>
        )}
      </div>
    </Screen>
  );
}

function Section({ section, onPoet, data, onUnkeep }: { section: DivanSection; onPoet: (slug: string) => void; data: LibraryData | undefined; onUnkeep: (entry: DivanEntry) => void }) {
  const known = section.poetSlug ? data?.library.poet(section.poetSlug) : undefined;
  return (
    <section aria-label={section.title || undefined} className="flex flex-col gap-2">
      {section.title && (
        <div className="flex items-center gap-2">
          {known && <PoetCircle poet={known} size={30} border={2} />}
          <h2 className="pt-[3px] text-xl leading-[1.3] text-ink">{section.title}</h2>
          <span className="text-xs text-muted">{persianDigits(section.entries.length)} بیت</span>
          {section.poetSlug && (
            <button type="button" data-testid={`poet-all-${section.poetSlug}`} onClick={() => onPoet(section.poetSlug!)} className="ms-auto text-[13px] font-bold text-lapis">
              همه
            </button>
          )}
        </div>
      )}
      <DivanCards entries={section.entries} now={new Date()} onUnkeep={onUnkeep} />
    </section>
  );
}
