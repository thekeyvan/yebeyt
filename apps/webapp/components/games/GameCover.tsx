"use client";

import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { leaveGame } from "../../lib/games/leave";
import { coverAway, coverDrop, coverRise, useVariant } from "../../lib/motion";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { DailyScreen } from "./DailyScreen";
import { JigsawScreen } from "./JigsawScreen";

type Game = {
  /** Closes the game, after asking when `setAsks(true)` said a round has started. */
  requestClose: () => void;
  /** The screen says whether leaving now loses a round (`LeaveGame.asks`). */
  setAsks: (asks: boolean) => void;
  /** The question «از بازی بری بیرون؟» is open: the clock waits for the answer. */
  asking: boolean;
  /** False while the reader is over the game: nothing under it takes keys. */
  active: boolean;
};

const GameContext = createContext<Game>({ requestClose: () => {}, setAsks: () => {}, asking: false, active: true });

export const useGame = (): Game => useContext(GameContext);

const screens = { daily: DailyScreen, jigsaw: JigsawScreen };

/**
 * A game in front of the tabs (Games/GameHost.swift): one layer, all of it, that rises from the bottom like the reader (the page under it and the
 * tab bar stay as they are) and drops when it closes. Opened inside the app (`modal`) it closes back to where it came from; opened by its link it is
 * just there, and closes to the games tab. Escape and the × close it, asking first when a round has started. The reader opens over it («کل شعر»).
 */
export function GameCover({ kind, modal }: { kind: keyof typeof screens; modal: boolean }) {
  const router = useRouter();
  const v = useVariant();
  const reading = usePathname().startsWith("/poem/");
  const [leaving, setLeaving] = useState(false);
  const [asks, setAsks] = useState(false);
  const [asking, setAsking] = useState(false);
  const Screen = screens[kind];

  const close = () => (modal ? setLeaving(true) : router.push("/games"));
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

  return (
    <motion.div
      initial={modal ? coverAway(v) : false}
      animate={leaving ? coverAway(v) : { y: "0%", opacity: 1 }}
      transition={leaving ? coverDrop(v) : coverRise(v)}
      onAnimationComplete={() => leaving && router.back()}
      className="dotted-paper fixed inset-0 z-[32] overflow-hidden"
      data-testid="game"
    >
      <div inert={reading} className="mx-auto h-full w-full max-w-[640px]">
        <GameContext value={{ requestClose, setAsks, asking, active: !reading }}>
          <Screen />
        </GameContext>
      </div>
      <ConfirmSheet open={asking} onOpenChange={setAsking} title={leaveGame.title} message={leaveGame.message} confirm={leaveGame.leave} cancel={leaveGame.stay} onConfirm={close} />
    </motion.div>
  );
}
