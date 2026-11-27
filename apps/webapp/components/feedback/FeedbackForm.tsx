"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";
import type { FeedbackCenter } from "../../lib/feedback/center";
import type { FeedbackModel } from "../../lib/feedback/model";
import { withMarks } from "../../lib/feedback/screenshot";
import { frequencies, sendsTechnical, takesRecording, takesScreenshot } from "../../lib/feedback/types";
import { useStore } from "../../lib/library/browser";
import { Segmented } from "../ui/Segmented";
import { FailureLine, FeedbackLabel, FeedbackTextArea, hint } from "./controls";
import { RecordingRow } from "./RecordingRow";
import { ScreenshotEditor } from "./ScreenshotEditor";
import { ScreenshotRow } from "./ScreenshotRow";
import { TechnicalRow } from "./TechnicalRow";

/** What goes with the report on its own: the screenshot and, for a bug, the technical info, with the line about what never goes. */
function Attachment({ model }: { model: FeedbackModel }) {
  const { draft, technicalOpen } = useStore(model)!;
  const [editing, setEditing] = useState(false);
  const image = model.image;
  const locked = model.isLocked;
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-[22px] bg-white px-4 py-3 shadow-[0_3px_6px_rgba(20,17,43,0.06)]">
      <p className="text-[13px] font-bold text-ink">از همون لحظه همراهش می‌فرستیم</p>
      {takesScreenshot(draft.type) && image && <ScreenshotRow image={image} on={draft.screenshotOn} locked={locked} setOn={(screenshotOn) => model.edit({ screenshotOn })} edit={() => setEditing(true)} />}
      {sendsTechnical(draft.type) && <TechnicalRow info={model.moment.info} open={technicalOpen} toggle={() => model.toggleTechnical()} />}
      <p className={cn("text-[11px] leading-[1.9]", hint)}>چیزی که جای دیگه تایپ کردی یا پیام‌هات هیچ‌وقت همراهش نمیاد. عکس صفحه رو خودت تصمیم می‌گیری.</p>
      {image && (
        <ScreenshotEditor
          open={editing}
          image={image}
          done={async (marks) => {
            setEditing(false);
            const marked = marks.length > 0 ? await withMarks(image, marks) : undefined;
            if (marked) model.setEdited(marked);
          }}
        />
      )}
    </div>
  );
}

/** FeedbackBug, and its three text-only relatives (یه جاش اذیتم کرد, یه ایده دارم, خوشم اومد): the same layout without the parts the type does not take. */
export function FeedbackForm({ center, model }: { center: FeedbackCenter; model: FeedbackModel }) {
  const { draft, recording, failure } = useStore(model)!;
  const bug = draft.type === "bug";
  const locked = model.isLocked;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {bug && <FeedbackLabel title="چی شد؟" />}
        <FeedbackTextArea value={draft.text} onChange={(text) => model.edit({ text })} minHeight={bug ? 74 : 118} placeholder={bug ? "" : "بنویس…"} label={bug ? "چی شد؟" : "بنویس…"} testId="feedback-text" disabled={locked} />
      </div>
      {bug && (
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 text-[13px] font-bold text-ink">چند بار پیش اومده؟</span>
          <div className="min-w-0 flex-1">
            <Segmented value={draft.frequency} onValueChange={(frequency) => model.edit({ frequency })} options={frequencies} label="چند بار پیش اومده؟" look="divan" disabled={locked} />
          </div>
        </div>
      )}
      {takesRecording(draft.type) && <RecordingRow center={center} recording={recording} locked={locked} onRemove={() => model.setRecording(undefined)} />}
      {failure && <FailureLine line={failure} />}
      {(sendsTechnical(draft.type) || (takesScreenshot(draft.type) && model.image)) && <Attachment model={model} />}
    </div>
  );
}
