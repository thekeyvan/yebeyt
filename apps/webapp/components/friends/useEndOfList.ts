"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `more` when the end of a list comes into view (the lists are lazy, so the next page is asked for only then). Put the returned ref on an empty element at
 * the end; `last` is the key of the last row, so that a longer list sets the watch again (and a short list that already shows its end asks again).
 */
export function useEndOfList(last: string | undefined, more: () => void) {
  const end = useRef<HTMLDivElement>(null);
  const ask = useRef(more);
  ask.current = more;
  useEffect(() => {
    const node = end.current;
    if (!node) return;
    const watch = new IntersectionObserver((seen) => seen.some((one) => one.isIntersecting) && ask.current());
    watch.observe(node);
    return () => watch.disconnect();
  }, [last]);
  return end;
}
