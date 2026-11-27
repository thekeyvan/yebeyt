"use client";

import type { FeedbackModel } from "../../lib/feedback/model";
import { clip, nameLimit, playerChoices } from "../../lib/feedback/types";
import { useStore } from "../../lib/library/browser";
import { Segmented } from "../ui/Segmented";
import { FailureLine, FeedbackLabel, FeedbackTextArea, field, hint } from "./controls";

/** FeedbackGame: a game idea with its name (optional), how it plays and who plays it. No screenshot. */
export function FeedbackGameForm({ model }: { model: FeedbackModel }) {
  const { draft, failure } = useStore(model)!;
  const locked = model.isLocked;
  return (
    <div className="flex w-full flex-col gap-3.5">
      <div className="flex flex-col gap-[7px]">
        <FeedbackLabel title="اسمش" note="اگه داره" />
        <input
          value={draft.gameName}
          onChange={(event) => model.edit({ gameName: clip(event.target.value, nameLimit) })}
          placeholder="مثلاً «بیت عوضی»"
          aria-label="اسمش"
          disabled={locked}
          data-testid="feedback-game-name"
          className={`${field} h-[46px]`}
        />
      </div>
      <div className="flex flex-col gap-[7px]">
        <FeedbackLabel title="چطوری بازی می‌شه؟" />
        <FeedbackTextArea value={draft.text} onChange={(text) => model.edit({ text })} minHeight={118} label="چطوری بازی می‌شه؟" testId="feedback-text" disabled={locked} />
      </div>
      <div className="flex flex-col gap-[7px]">
        <FeedbackLabel title="با کی بازی می‌شه؟" />
        <Segmented value={draft.players} onValueChange={(players) => model.edit({ players })} options={playerChoices} label="با کی بازی می‌شه؟" look="divan" disabled={locked} />
      </div>
      {failure && <FailureLine line={failure} />}
      <p data-testid="feedback-account-note" className={`px-1 text-xs leading-[2] ${hint}`}>
        بدون حساب هم می‌شه فرستاد. اگه وارد شده باشی، نام کاربریت هم میاد تا بتونیم جوابت رو بدیم.
      </p>
    </div>
  );
}
