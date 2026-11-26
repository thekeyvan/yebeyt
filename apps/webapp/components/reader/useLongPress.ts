"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";

/** How long a press has to last to be a long press (iOS: `minimumDuration: 0.5`). */
const holdSeconds = 0.5;
/** How far a press may move and still be held. */
const slop = 10;

/**
 * A long press on a couplet, and the right-click and the keyboard's menu key that mean the same (they send `contextmenu`). The click that
 * comes after a long press is swallowed, so lifting the finger does not also pick the couplet.
 */
export function useLongPress(onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef<{ x: number; y: number }>(undefined);
  const held = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = undefined;
  };

  return {
    onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      held.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        held.current = true;
        onHold();
      }, holdSeconds * 1000);
    },
    onPointerMove(event: PointerEvent) {
      if (origin.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > slop) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(event: MouseEvent) {
      event.preventDefault();
      cancel();
      held.current = true;
      onHold();
    },
    onClickCapture(event: MouseEvent) {
      if (!held.current) return;
      held.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
