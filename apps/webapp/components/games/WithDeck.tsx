"use client";

import type { ReactNode } from "react";
import type { GameDeck } from "../../lib/games/couplet";
import { useDeck } from "../../lib/games/browser";
import { LoadFailed } from "../library/WithLibrary";

/**
 * Calls `children` with the game deck once it has loaded in the browser; until then the page is empty and busy, and when it fails it says so and
 * offers «دوباره». `wrap` puts that placeholder in the screen's own frame.
 */
export function WithDeck({ children, wrap }: { children: (deck: GameDeck) => ReactNode; wrap: (placeholder: ReactNode) => ReactNode }) {
  const { value, failed, retry } = useDeck();
  if (value) return <>{children(value)}</>;
  return wrap(failed ? <LoadFailed title="بازی‌ها باز نشد" onRetry={retry} /> : <div aria-busy className="h-[60dvh]" />);
}
