"use client";

import { bindPersistentLayer } from "@ui-sdk/core";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A small fire sticker at the top: a dot and «در حال ضبط · تموم» (RecordingPill in FeedbackOverlayView.swift). The whole pill is the stop button, 44 high at least.
 * It is above everything: the game, the reader and every sheet. The sheets are in the browser's top layer, so the pill is a popover too (shown in the top layer,
 * where UI SDK's persistent layer puts it back above any sheet that opens later and keeps it from being made inert).
 */
export function RecordingPill({ stop }: { stop: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const pill = layer.current;
    if (!pill) return;
    pill.showPopover?.(); // a browser with no popovers has the z-index below
    button.current?.focus({ preventScroll: true });
    return bindPersistentLayer(pill);
  }, []);
  return createPortal(
    <div
      ref={layer}
      popover="manual"
      data-testid="recording-pill"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[max(4px,env(safe-area-inset-top))] bottom-auto z-[9500] m-0 flex h-auto w-full justify-center overflow-visible border-0 bg-transparent p-0"
    >
      <button type="button" aria-label="ضبط رو تموم کن" data-testid="recording-stop" ref={button} onClick={stop} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-pill border-badge border-white bg-fire px-3.5 text-[13px] font-bold text-white shadow-badge">
        <span aria-hidden className="size-[9px] rounded-full bg-white" />
        <span>در حال ضبط</span>
        <span aria-hidden>·</span>
        <span className="underline">تموم</span>
      </button>
    </div>,
    document.body,
  );
}
