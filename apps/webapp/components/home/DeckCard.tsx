"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { Pick } from "../../lib/library/home";
import { bouncy, dealArrival, restingPose, settle, throwAway, thrownPose, useVariant } from "../../lib/motion";
import { DailyCard } from "./DailyCard";

/** How long the card is in the air before the next one is dealt (`DeckCard`'s 0.28 s). */
const flightMs = 280;

/**
 * «بیتِ امروز» on the deck: «رد کن» throws the card off with a spring and a tilt before the next one is dealt (Home/DeckCard.swift). `dealing` is
 * true while a thrown card is being replaced: only then does a new card spring in (never when the page opens). `onReject` shows the next card.
 */
export function DeckCard({ pick, dealing, onReject }: { pick: Pick; dealing: boolean; onReject: () => Promise<void> }) {
  const v = useVariant();
  const [thrown, setThrown] = useState(false);

  async function toss() {
    if (thrown) return;
    setThrown(true);
    await new Promise((resolve) => setTimeout(resolve, flightMs));
    await onReject();
    setThrown(false); // the same card again if there is no other; a new card has its own state
  }

  return (
    <motion.div
      data-testid="deck-card"
      initial={dealing ? dealArrival(v) : false}
      animate={thrown ? thrownPose(v) : { ...restingPose, scale: 1 }}
      transition={thrown ? (v === "full" ? throwAway : settle(v)) : v === "full" ? bouncy : settle(v)}
    >
      <DailyCard pick={pick} onReject={() => void toss()} />
    </motion.div>
  );
}
