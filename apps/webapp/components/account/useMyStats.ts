"use client";

import type { MyStats } from "../../lib/account/myStats";
import { accountServices } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";

/** The points and the streak to show (the account's, once the server has said; this browser's for a guest); the page draws again when they change. */
export function useMyStats(): MyStats {
  const { myStats, session, stats } = accountServices();
  useStore(myStats);
  useStore(session);
  useStore(stats);
  return myStats;
}
