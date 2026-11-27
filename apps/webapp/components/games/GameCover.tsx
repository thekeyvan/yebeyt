"use client";

import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { gameInFront } from "../../lib/games/entry";
import { isGamePage, type PlayableKind } from "../../lib/games/kinds";
import { deckStart, type JigsawStart } from "../../lib/games/jigsawStart";
import { leaveGame } from "../../lib/games/leave";
import { canGoBack } from "../../lib/nav";
import { coverAway, coverDrop, coverRise, useVariant } from "../../lib/motion";
import { RoundContext } from "../play/RoundContext";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GameScreen } from "./GameScreen";

type Game = {
  /** Closes the game, after asking when `setAsks(true)` said a round has started. */
  requestClose: () => void;
  /** Closes the game at once, with no question: a game that can't go on (a recitation that won't play) leaves like this. */
  leave: () => void;
  /** The screen says whether leaving now loses a round (`LeaveGame.asks`). */
  setAsks: (asks: boolean) => void;
  /** The question «از بازی بری بیرون؟» is open: the clock waits for the answer. */
  asking: boolean;
  /** False while the reader is over the game: nothing under it takes keys. */
  active: boolean;
  /** Opened inside the app, over the page it came from: another game goes in its place with `router.replace`; one opened by its link has nothing of the app under it, and is replaced by a page load. */
  modal: boolean;
};

const GameContext = createContext<Game>({ requestClose: () => {}, leave: () => {}, setAsks: () => {}, asking: false, active: true, modal: true });

export const useGame = (): Game => useContext(GameContext);

/** A solo game in front of the tabs: `start` is where a جورچین round starts, `poet` the one a مصراع دوم round is of, `invite` the friends a challenge made from the round goes to. */
export function GameCover({ kind, modal, start = deckStart, poet, invite }: { kind: PlayableKind; modal: boolean; start?: JigsawStart; poet?: string; invite?: readonly string[] }) {
  return (
    <GameLayer modal={modal}>
      <RoundContext value={{ invite: invite ?? [] }}>
        <GameScreen kind={kind} start={start} poet={poet} />
      </RoundContext>
    </GameLayer>
  );
}

/**
 * A game in front of the tabs (Games/GameHost.swift): one layer, all of it, that rises from the bottom like the reader (the page under it and the
 * tab bar stay as they are) and drops when it closes. Opened inside the app (`modal`) it closes back to where it came from; opened by its link it is
 * just there (in a layer of the document's own), and closes to the games tab. Escape and the × close it, asking first when a round has started. The reader opens over it («کل شعر»).
 */
export function GameLayer({ modal, children }: { modal: boolean; children: ReactNode }) {
  const router = useRouter();
  const v = useVariant();
  const pathname = usePathname();
  const reading = pathname.startsWith("/poem/");
  // The slot keeps what it showed when the app goes to a page that is not the game's (a soft navigation does not clear it): there is no game then.
  const here = isGamePage(pathname) || reading;
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [leaving, setLeaving] = useState(false);
  const [asks, setAsks] = useState(false);
  const [asking, setAsking] = useState(false);

  const close = () => (modal && canGoBack() ? setLeaving(true) : router.push("/games"));
  const asksNow = here && asks;
  useEffect(() => {
    gameInFront.open = here;
    return () => {
      gameInFront.open = false;
    };
  }, [here]);
  useEffect(() => {
    gameInFront.asks = asksNow;
    return () => {
      gameInFront.asks = false;
    };
  }, [asksNow]);
  const requestClose = () => (asks ? setAsking(true) : close());

  // Escape closes, unless the reader is over the game, a sheet is open (it takes the key itself) or a control wants it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || reading || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!here) return null;
  const cover = (
    <motion.div
      initial={modal ? coverAway(v) : false}
      animate={leaving ? coverAway(v) : { y: "0%", opacity: 1 }}
      transition={leaving ? coverDrop(v) : coverRise(v)}
      onAnimationComplete={() => leaving && router.back()}
      className="dotted-paper fixed inset-0 z-[32] overflow-hidden"
      data-testid="game"
    >
      <div inert={reading} className="mx-auto h-full w-full max-w-[640px]">
        <GameContext value={{ requestClose, leave: close, setAsks, asking, active: !reading, modal }}>
          {children}
        </GameContext>
      </div>
      <ConfirmSheet open={asking} onOpenChange={setAsking} title={leaveGame.title} message={leaveGame.message} confirm={leaveGame.leave} cancel={leaveGame.stay} onConfirm={close} />
    </motion.div>
  );
  // Opened by its link it is the content of a page, which is inert while a game covers it: a layer of the document's own keeps the game reachable.
  return modal ? cover : inBrowser ? createPortal(cover, document.body) : null;
}
