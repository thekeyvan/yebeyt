"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { gameInFront } from "../../lib/games/entry";
import { jigsawURL, type JigsawStart } from "../../lib/games/jigsawStart";
import { leaveGame } from "../../lib/games/leave";
import { pagesBack } from "../../lib/nav";
import { ConfirmSheet } from "../ui/ConfirmSheet";

/** Goes back `steps` pages of the app, and when the browser has got there, does `then`. */
function backThen(steps: number, then: () => void): void {
  if (steps === 0) return then();
  window.addEventListener("popstate", () => setTimeout(then, 0), { once: true });
  window.history.go(-steps);
}

/**
 * «بازی با این بیت» and «بازی با این غزل» from the reader (`AppModel.startGame`, `playWithCouplet`, `playWithPoem`): the reader and any game under it are
 * left, so closing the new game comes back to the page they were opened from. A round that has started would be thrown away, so that asks «از بازی بری بیرون؟»
 * first (`question` is its sheet, to be put in the page); otherwise the game starts at once. `modal` is whether the reader rose over a page of the app.
 */
export function useStartGame(modal: boolean): { start: (start: JigsawStart) => void; question: ReactNode } {
  const router = useRouter();
  const [pending, setPending] = useState<string>();

  function go(url: string) {
    if (!modal) return router.push(url);
    const steps = Math.min(gameInFront.open ? 2 : 1, pagesBack());
    // A game opened by its link has no page of the app before it, and it is the page: the new game is its replacement, loaded afresh (opened inside the app
    // it would rise over the old one).
    const replace = gameInFront.open && steps < 2;
    backThen(steps, () => (replace ? window.location.replace(url) : router.push(url)));
  }

  return {
    start(target) {
      const url = jigsawURL(target);
      if (gameInFront.asks) setPending(url);
      else go(url);
    },
    question: (
      <ConfirmSheet
        open={pending !== undefined}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={leaveGame.title}
        message={leaveGame.message}
        confirm={leaveGame.leave}
        cancel={leaveGame.stay}
        onConfirm={() => go(pending!)}
      />
    ),
  };
}
