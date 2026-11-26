"use client";

import type { PointerEvent } from "react";
import type { ReaderMode } from "../../lib/reader/route";
import { Segmented } from "../ui/Segmented";
import { ChevronDownIcon, GamesIcon } from "../ui/icons";
import type { ReaderContent } from "./useReader";

const round = "grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink";

/**
 * The header both reading modes share (Reader/ReaderHeader.swift): the grabber, close, title and subtitle and «آ», with the mode toggle
 * under it. It is one piece above the mode's content, so switching modes cannot move it, and it stays at the top. The reader is a
 * bottom sheet, and this is its handle: a drag down on it closes the reader (`onGrab` starts that drag).
 */
export function ReaderHeader({
  content,
  mode,
  onMode,
  onClose,
  onText,
  onPlay,
  onGrab,
  secondary,
}: {
  content?: ReaderContent;
  mode: ReaderMode;
  onMode: (mode: ReaderMode) => void;
  onClose: () => void;
  onText: () => void;
  /** «بازی با این غزل»: جورچین with the couplets of this poem. */
  onPlay: () => void;
  onGrab: (event: PointerEvent) => void;
  secondary: string;
}) {
  return (
    <header className="flex shrink-0 touch-none flex-col items-center gap-3 pt-[calc(env(safe-area-inset-top)+8px)] pb-2" onPointerDown={onGrab}>
      <span aria-hidden className={`mt-0.5 h-[5px] w-10 rounded-pill bg-current opacity-40 ${secondary}`} />
      <div className="flex w-full items-center gap-2.5 px-[18px]">
        <button type="button" aria-label="بستن" onClick={onClose} className={round}>
          <ChevronDownIcon size={22} lineWidth={2.6} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-xl leading-[1.5]" data-testid="reader-title">
            {content?.title ?? " "}
          </h1>
          <p className={`truncate text-xs leading-[1.5] ${secondary}`} data-testid="reader-subtitle">
            {content?.subtitle ?? " "}
          </p>
        </div>
        <button type="button" aria-label="بازی با این غزل" disabled={!content} onClick={onPlay} className={`${round} text-lapis disabled:opacity-40`}>
          <GamesIcon size={20} lineWidth={2.2} />
        </button>
        <button type="button" aria-label="اندازه‌ی حروف" disabled={!content} onClick={onText} className={`${round} font-title text-lg disabled:opacity-40`}>
          <span className="pt-[3px]">آ</span>
        </button>
      </div>
      {content && (
        <Segmented
          look="pill"
          label="حالت خوندن"
          value={mode}
          onValueChange={onMode}
          options={[
            { value: "couplet", label: "بیت به بیت" },
            { value: "scroll", label: "کل شعر" },
          ]}
        />
      )}
    </header>
  );
}
