"use client";

import type { Services } from "../../lib/account/services";
import { useGameStats } from "../../lib/games/browser";
import { useProgress } from "../../lib/library/browser";
import { allBadges, type Badge } from "../../lib/me/badges";

/** The four badges with what this browser has done: the longest daily streak, the Hafez answers, the couplets read. */
export function useBadges({ achievements }: Services): Badge[] {
  const stats = useGameStats();
  const reading = useProgress();
  return allBadges({ bestStreak: stats.bestStreak, hafezRight: achievements.hafezRight, coupletsRead: reading.coupletsRead });
}
