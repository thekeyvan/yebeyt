"use client";

import { useEffect, useState } from "react";

/** The time now in milliseconds, drawn again every `every` ms: the clocks of a game (the page has no clock of its own for them). */
export function useNow(every: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}
