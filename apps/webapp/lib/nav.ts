// How deep the app is in its own pages since it was opened: only above 0 does «برگشت» have a page of ours to go back to (a screen opened by its link
// has none, and goes to the screen above it). The depth is kept in each history entry (`history.state`), so the browser's own back and forward
// buttons, and a reload, keep it right.
const key = "yebeytDepth";
let depth = 0;
let started = false;

/** Told by the shell every time the path changes: an entry already marked gives its depth back; a new one is one deeper than the page before. */
export function trackNavigation(): void {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  if (typeof state[key] === "number") {
    depth = state[key];
  } else {
    depth = started ? depth + 1 : 0;
    window.history.replaceState({ ...state, [key]: depth }, "");
  }
  started = true;
}

export const canGoBack = (): boolean => depth > 0;
