"use client";

import type { FeedbackCenter } from "../../lib/feedback/center";
import type { Recording } from "../../lib/feedback/model";
import { persianClock } from "../../lib/persian";
import { CloseIcon } from "../ui/icons";
import { RecordGlyph } from "./icons";

/**
 * A bug's recording: «دوباره انجامش بده، ما فیلم می‌گیریم» until there is one, then «فیلم ضبط شد · ۰:۰۹» with the × that deletes it (`ask` shows the question). Hidden where the
 * browser can't record.
 */
export function RecordingRow({ center, recording, locked, ask }: { center: FeedbackCenter; recording?: Recording; locked: boolean; ask: () => void }) {
  if (recording) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-[14px] bg-white px-3.5 text-fire">
        <RecordGlyph size={16} />
        <span data-testid="feedback-recorded" className="flex-1 text-[13px] font-bold text-ink">
          فیلم ضبط شد · {persianClock(recording.seconds)}
        </span>
        <button type="button" aria-label="حذف فیلم" disabled={locked} data-testid="feedback-remove-recording" onClick={ask} className="grid size-[30px] place-items-center rounded-full bg-paper text-muted disabled:opacity-50">
          <CloseIcon size={14} lineWidth={2.6} />
        </button>
      </div>
    );
  }
  if (!center.recordingAvailable) return null;
  return (
    <button type="button" disabled={locked} data-testid="feedback-record" onClick={() => void center.startRecording()} className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-fire/35 bg-white text-[13px] font-bold text-fire disabled:opacity-50">
      <RecordGlyph size={16} />
      دوباره انجامش بده، ما فیلم می‌گیریم
    </button>
  );
}
