import type { Couplet } from "../poetry/models";

// Which couplet the reader is on, and what is near it (Reader/CoupletPaging.swift).

export const clamp = (index: number, count: number): number => Math.max(0, Math.min(index, count - 1));

export const next = (index: number, count: number): number => clamp(index + 1, count);

export const previous = (index: number, count: number): number => clamp(index - 1, count);

/** The faint line above the couplet: the previous couplet's nearest hemistich. */
export function above(index: number, couplets: Couplet[]): string | undefined {
  const before = couplets[index - 1];
  return before && (before.m2 || before.m1);
}

/** The faint line below the couplet: the next couplet's first hemistich. */
export const below = (index: number, couplets: Couplet[]): string | undefined => couplets[index + 1]?.m1;

/** A couplet row of the whole-poem list and where it is on screen. */
export type Row = { index: number; minY: number; maxY: number };

/** The couplet «at the top of the screen» in the whole-poem list (y = 0 is the top of the list): the first row whose middle is still on screen. */
export function nearestToTop(rows: Row[]): number | undefined {
  const ordered = [...rows].sort((a, b) => a.index - b.index);
  return (ordered.find((row) => (row.minY + row.maxY) / 2 > 0) ?? ordered[ordered.length - 1])?.index;
}

/**
 * Couplets page vertically, as on iOS (a scroll view that snaps a page at a time): the next couplet is the page below, which
 * a finger or the mouse reaches by moving up. Left and right are for the keys: the page is right-to-left, so ← is the way
 * forward and → the way back, as on a book.
 */
export function keyStep(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft" || key === "ArrowDown" || key === "PageDown") return 1;
  if (key === "ArrowRight" || key === "ArrowUp" || key === "PageUp") return -1;
  return 0;
}

/** A drag of `dy` pixels at `velocity` pixels per millisecond (both positive downward) on a page `height` tall: a fifth of the page, or a quick flick, turns it. */
export function dragStep(dy: number, velocity: number, height: number): -1 | 0 | 1 {
  if (Math.abs(dy) < height / 5 && Math.abs(velocity) < 0.5) return 0;
  const toward = Math.abs(velocity) >= 0.5 ? velocity : dy;
  return toward < 0 ? 1 : toward > 0 ? -1 : 0;
}
