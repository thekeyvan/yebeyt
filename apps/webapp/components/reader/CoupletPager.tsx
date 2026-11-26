"use client";

import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { dragStep } from "../../lib/reader/paging";

/** How long the scroll has to rest before the page it rests on counts as the couplet. */
const settleMilliseconds = 90;
/** How far the mouse has to move before it is a drag and not a click. */
const dragSlop = 6;
/** How close to a page, in pages, the scroll has to be to be on it (a page is not a whole number of pixels, a scroll position is). */
const nearPage = 0.01;
/** How long a scroll that the pager itself started may take to arrive before the page it rests on counts again. */
const arriveMilliseconds = 1500;

/**
 * Couplets page vertically and snap, a page at a time, as the scroll view of iOS's `CoupletModeView` does: a finger moves the page natively, and the
 * mouse drags it (a mouse cannot scroll by dragging). The page the scroll rests on is the couplet (`onPage`); when `index` is changed from outside
 * (a key, a button, the recitation) the pager scrolls there. `locked` stops it while a card, a menu or a sheet is open.
 */
export function CoupletPager({ count, index, onPage, locked, children }: { count: number; index: number; onPage: (index: number) => void; locked: boolean; children: (page: number) => ReactNode }) {
  const pager = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = useRef(index);
  const drag = useRef<{ y: number; top: number; at: number; moved: boolean }>(undefined);
  /** The page a scroll that the pager started (opening, a key, the recitation) is going to, until it gets there: a pause on the way is not a page. */
  const heading = useRef<{ page: number; until: number }>(undefined);
  const reduce = useReducedMotion();
  current.current = index;

  const pageHeight = () => pager.current?.clientHeight ?? 1;

  function scrollTo(page: number, smooth: boolean) {
    const element = pager.current;
    if (!element) return;
    heading.current = { page, until: performance.now() + arriveMilliseconds };
    element.scrollTo({ top: page * element.clientHeight, behavior: smooth && !reduce ? "smooth" : "instant" });
  }

  // Opens on the couplet, with no scrolling to it, and keeps it there when the screen changes size.
  useLayoutEffect(() => {
    const element = pager.current;
    if (!element) return;
    const place = () => scrollTo(current.current, false);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Moves to a couplet that was chosen from outside.
  useLayoutEffect(() => {
    const element = pager.current;
    if (!element || Math.abs(element.scrollTop / element.clientHeight - index) < nearPage) return;
    scrollTo(index, true);
  }, [index]);

  function rest() {
    const element = pager.current;
    // A pager that is locked does not move, whatever scrolls it (a browser bringing a control into view).
    if (locked && element) return element.scrollTo({ top: current.current * element.clientHeight, behavior: "instant" });
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const going = heading.current;
      const top = pager.current?.scrollTop ?? 0;
      if (going && performance.now() < going.until && Math.abs(top / pageHeight() - going.page) >= nearPage) return rest();
      heading.current = undefined;
      const page = Math.round(top / pageHeight());
      if (page !== current.current) onPage(Math.max(0, Math.min(page, count - 1)));
    }, settleMilliseconds);
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    heading.current = undefined; // a hand on the page takes over
    const element = pager.current;
    if (event.pointerType !== "mouse" || event.button !== 0 || locked || !element) return;
    drag.current = { y: event.clientY, top: element.scrollTop, at: event.timeStamp, moved: false };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const element = pager.current;
    if (!start || !element) return;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dy) < dragSlop) return;
    if (!start.moved) {
      start.moved = true;
      element.setPointerCapture(event.pointerId); // the click that ends a drag then lands on the pager, not on a couplet
      element.style.scrollSnapType = "none";
    }
    element.scrollTop = start.top - dy;
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const element = pager.current;
    drag.current = undefined;
    if (!start?.moved || !element) return;
    const dy = event.clientY - start.y;
    const target = Math.max(0, Math.min(current.current + dragStep(dy, dy / Math.max(event.timeStamp - start.at, 1), pageHeight()), count - 1));
    element.style.scrollSnapType = "";
    scrollTo(target, true);
    rest();
  }

  return (
    <div
      ref={pager}
      onScroll={rest}
      onPointerDown={press}
      onWheel={() => (heading.current = undefined)}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      className={`h-full snap-y snap-mandatory overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${locked ? "overflow-y-hidden" : "overflow-y-auto"}`}
    >
      {Array.from({ length: count }, (_, page) => (
        // The neighbours are drawn so a swipe has something to show, but they are not the page: nothing in them is reached, read or focused.
        <div key={page} className="h-full snap-start snap-always" data-page={page} inert={page !== index} aria-hidden={page !== index || undefined}>
          {children(page)}
        </div>
      ))}
    </div>
  );
}
