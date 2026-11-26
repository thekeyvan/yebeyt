"use client";

import { above, below } from "../../lib/reader/paging";
import { showsAIMark } from "../../lib/poetry/models";
import { spacingFactor, type TextSettings } from "../../lib/reader/settings";
import { toast } from "../ui/Toast";
import { BookIcon } from "../ui/icons";
import { ActionRow } from "./ActionRow";
import { CoupletText, lineStyle } from "./CoupletText";
import { MeaningCard, aiMeaning } from "./MeaningCard";
import { fontClass, themeClasses } from "./theme";
import { useCoupletActions } from "./useCoupletActions";
import { useLongPress } from "./useLongPress";
import type { Reader } from "./useReader";
import { usePlayerView } from "./usePlayerView";

/** The nearest hemistich of the next or previous couplet. The space stays when there is none, so the couplet doesn't jump. */
function Faint({ line, settings }: { line?: string; settings: TextSettings }) {
  return (
    <p aria-hidden className={`truncate text-center ${fontClass(settings)} ${themeClasses[settings.theme].faint}`} style={lineStyle(15, 1.8)}>
      {line ?? " "}
    </p>
  );
}

/**
 * One couplet's page (Reader/CoupletModeView.swift `CoupletPage`): the couplet with the nearest hemistich of the ones before and after faintly
 * above and below, the action row, and «معنی این بیت» when there is a meaning; opened, the meaning's card takes the place of the faint lines.
 * With the «آ» sheet open only the couplet shows, at the top, where the sheet doesn't cover it.
 */
export function CoupletPage({ reader, index, settings }: { reader: Reader; index: number; settings: TextSettings }) {
  const couplet = reader.couplets[index]!;
  const actions = useCoupletActions(reader, index);
  const view = usePlayerView(reader.player);
  const hold = useLongPress(() => reader.setHoldIndex(index));
  const text = themeClasses[settings.theme].text;
  const showsMeaning = reader.meaning.open && index === reader.index && !reader.textSheetOpen;
  const lifted = (
    <CoupletText
      couplet={couplet}
      settings={settings}
      size={settings.size}
      factor={spacingFactor(settings.spacing)}
      className={`${text} w-full cursor-default touch-pan-y select-none [-webkit-touch-callout:none]`}
      {...hold}
      data-testid={`couplet-${index}`}
      tabIndex={0}
    />
  );
  if (reader.textSheetOpen) return <div className="px-[30px]">{lifted}</div>;
  return (
    <div className="flex h-full flex-col overflow-y-auto px-10" style={{ paddingBottom: showsMeaning ? 84 : 40 }}>
      <div className="my-auto flex flex-col" style={{ gap: showsMeaning ? 22 : 34 }}>
        {!showsMeaning && <Faint line={above(index, reader.couplets)} settings={settings} />}
        <div className="flex flex-col items-center gap-[22px]">
          {lifted}
          {showsMeaning && couplet.meaning && (
            <MeaningCard
              text={couplet.meaning}
              ai={showsAIMark(couplet)}
              expanded={reader.meaning.expanded}
              onExpand={reader.expandMeaning}
              onExplainAI={() => toast(aiMeaning.toast)}
              onClose={reader.closeMeaning}
            />
          )}
          <ActionRow actions={actions} view={view} onToggle={reader.togglePlayback} text={text} />
          {!showsMeaning && couplet.meaning && (
            <button type="button" onClick={reader.openMeaning} className="flex items-center gap-1.5 rounded-pill bg-lapis-tint px-4 py-[7px] text-sm font-bold text-lapis">
              <BookIcon size={16} lineWidth={2.2} />
              معنی این بیت
            </button>
          )}
        </div>
        {!showsMeaning && <Faint line={below(index, reader.couplets)} settings={settings} />}
      </div>
    </div>
  );
}
