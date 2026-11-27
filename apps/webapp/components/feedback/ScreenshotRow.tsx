"use client";

import { cn } from "../../lib/cn";
import { WriteIcon } from "../me/icons";
import { FeedbackSwitch } from "./controls";
import { useObjectUrl } from "./useObjectUrl";

/** «عکس صفحه»: the thumbnail of the screenshot, «خط بکش یا بپوشون» to mark it, and the switch that takes it off the report. */
export function ScreenshotRow({ image, on, locked, setOn, edit }: { image: Blob; on: boolean; locked: boolean; setOn: (on: boolean) => void; edit: () => void }) {
  const url = useObjectUrl(image);
  return (
    <div className="flex items-center gap-3">
      {url && <img src={url} alt="عکس صفحه" data-testid="feedback-thumbnail" className={cn("h-auto max-h-[87px] w-auto max-w-[120px] shrink-0 rounded-[10px] border-4 border-white bg-white shadow-[0_6px_8px_rgba(20,17,43,0.22)]", !on && "opacity-40")} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-medium text-ink">عکس صفحه</span>
        <button type="button" disabled={!on || locked} data-testid="feedback-edit" onClick={edit} className="flex items-center gap-1 self-start text-[11.5px] font-bold text-lapis disabled:opacity-50">
          <WriteIcon size={14} lineWidth={2.4} />
          خط بکش یا بپوشون
        </button>
      </div>
      <FeedbackSwitch on={on} onChange={setOn} label="عکس صفحه" disabled={locked} testId="feedback-screenshot-switch" />
    </div>
  );
}
