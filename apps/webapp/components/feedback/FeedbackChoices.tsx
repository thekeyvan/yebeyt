"use client";

import { menuOrder, isNew, subtitleOf, titleOf, type FeedbackType } from "../../lib/feedback/types";
import { useMediaQuery } from "../../lib/media";
import { ChevronLeftIcon } from "../ui/icons";
import { hint } from "./controls";
import { TypeIcon } from "./icons";

/** The words of the choices (FeedbackShake): the title of the sheet and the line under it. */
export const choicesTitle = "می‌خوای چیزی بگی؟";
export const choicesLead = "هر چی تو ذهنته بگو، همه‌ش رو خودمون می‌خونیم.";

/** The keys that open the sheet from anywhere (a keyboard has them; a phone doesn't). */
export const shortcutNote = "از هر صفحه‌ای با Shift + ? هم می‌شه همین‌جا رو باز کرد.";

function Row({ type, choose }: { type: FeedbackType; choose: (type: FeedbackType) => void }) {
  return (
    <li className="border-t border-paper first:border-t-0">
      <button type="button" data-testid={`feedback-type-${type}`} onClick={() => choose(type)} className="flex w-full items-center gap-3 px-1 py-[9px] text-start focus-visible:outline-offset-[-3px]">
        <TypeIcon type={type} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1">
            <span className="text-[15px] font-bold text-ink">{titleOf(type)}</span>
            {isNew(type) && <span className="rounded-full bg-lapis-tint px-2 text-[11px] text-lapis">تازه</span>}
          </span>
          <span className="text-xs text-muted">{subtitleOf(type)}</span>
        </span>
        <span className={hint}>
          <ChevronLeftIcon size={16} lineWidth={2.4} />
        </span>
      </button>
    </li>
  );
}

/** FeedbackShake: the five types, and for a keyboard the note about the shortcut (there is no shaking on the web). */
export function FeedbackChoices({ choose }: { choose: (type: FeedbackType) => void }) {
  const keyboard = useMediaQuery("(hover: hover) and (pointer: fine)");
  return (
    <div className="flex w-full flex-col gap-3">
      <ul data-testid="feedback-choices">
        {menuOrder.map((type) => (
          <Row key={type} type={type} choose={choose} />
        ))}
      </ul>
      {keyboard && (
        <p data-testid="feedback-shortcut-note" className={`text-center text-[11px] ${hint}`}>
          {shortcutNote}
        </p>
      )}
    </div>
  );
}
