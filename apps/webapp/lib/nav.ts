// Whether the app went from one page to another since it was opened: only then does «برگشت» have a page of ours to go back to (a screen opened by
// its link has none, and goes to the screen above it).
let last: string | undefined;
let moved = false;

/** Told by the shell every time the path changes. */
export function trackNavigation(pathname: string): void {
  if (last !== undefined && last !== pathname) moved = true;
  last = pathname;
}

export const canGoBack = (): boolean => moved;
