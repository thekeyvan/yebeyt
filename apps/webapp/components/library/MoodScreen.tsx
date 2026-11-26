"use client";

import { useMemo } from "react";
import { useCorpus } from "../../lib/library/browser";
import type { Mood } from "../../lib/library/models";
import type { CoupletCorpus } from "../../lib/library/search";
import { Screen } from "../shell/Screen";
import { LoadFailed, Missing, WithLibrary } from "./WithLibrary";
import { ScreenHeader } from "./chrome";
import { CoupletRow, NothingFound } from "./rows";

/** How many couplets a mood shows. */
const limit = 60;

/** A mood: couplets of the bundled books that contain the mood's words, the most recited first (Search/MoodScreen.swift). */
export function MoodScreen({ moodKey }: { moodKey: string }) {
  const { value: corpus, failed, retry } = useCorpus();
  return (
    <WithLibrary>
      {({ library }) => {
        const mood = library.moods.find(({ key }) => key === moodKey);
        if (!mood) return <Missing fallback="/explore" />;
        return (
          <Screen header={<ScreenHeader title={mood.title} fallback="/explore" />}>
            {failed ? <LoadFailed title="بیت‌ها باز نشد" onRetry={retry} /> : <Couplets mood={mood} corpus={corpus} poetName={(slug) => library.poet(slug)?.name ?? ""} />}
          </Screen>
        );
      }}
    </WithLibrary>
  );
}

function Couplets({ mood, corpus, poetName }: { mood: Mood; corpus: CoupletCorpus | undefined; poetName: (slug: string) => string }) {
  const entries = useMemo(() => corpus?.matching(mood, limit), [corpus, mood]);
  return (
    <div className="flex flex-col gap-2 pt-1.5" aria-busy={!entries}>
      {entries?.length === 0 && <NothingFound />}
      {entries?.map((entry) => <CoupletRow key={entry.id} entry={entry} poetName={poetName(entry.poet)} />)}
    </div>
  );
}
