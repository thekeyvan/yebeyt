"use client";

import { useCorpus } from "../../lib/library/browser";
import { Screen } from "../shell/Screen";
import { Missing, WithLibrary } from "./WithLibrary";
import { ScreenHeader } from "./chrome";
import { CoupletRow, NothingFound } from "./rows";

/** How many couplets a mood shows. */
const limit = 60;

/** A mood: couplets of the bundled books that contain the mood's words, the most recited first (Search/MoodScreen.swift). */
export function MoodScreen({ moodKey }: { moodKey: string }) {
  const { value: corpus } = useCorpus();
  return (
    <WithLibrary>
      {({ library }) => {
        const mood = library.moods.find(({ key }) => key === moodKey);
        if (!mood) return <Missing fallback="/explore" />;
        const entries = corpus?.matching(mood, limit);
        return (
          <Screen header={<ScreenHeader title={mood.title} fallback="/explore" />}>
            <div className="flex flex-col gap-2 pt-1.5" aria-busy={!entries}>
              {entries?.length === 0 && <NothingFound />}
              {entries?.map((entry) => <CoupletRow key={entry.id} entry={entry} poetName={library.poet(entry.poet)?.name ?? ""} />)}
            </div>
          </Screen>
        );
      }}
    </WithLibrary>
  );
}
