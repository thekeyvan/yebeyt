"use client";

import { useEffect } from "react";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";

/**
 * Keeps this browser and the account the same (the phone's RootView): when someone signs in (and when the page opens signed in), when the page comes to the
 * front or the network comes back, the divan, the likes and reposts and the unsent scores sync, the face is reconciled with the account's, and the points shown and the number on the tab bar's «پیام‌ها» (the friend requests) are asked for again. A change made
 * meanwhile is sent after a short wait (`DivanSync`) or at once (`ReactionsSync`, `ScoreSync`); what could not be sent waits and goes on the next of these.
 */
export function SyncHost({ services }: { services: Services }) {
  const { session, divan, reactions, scores, myStats, stats, avatar, friends } = services;
  const state = useStore(session);
  const signedIn = state?.status === "in";
  const userId = state?.user?.id;

  useEffect(() => {
    if (!signedIn) {
      void myStats.refresh(); // forgets the server's points after signing out
      friends.reset();
    } else syncAll();
    // A new sign-in (or the user arriving) syncs again; the rest is the same.
  }, [signedIn, userId]);

  useEffect(() => {
    const wake = () => {
      stats.refreshToday();
      if (session.isSignedIn) syncAll();
    };
    const visible = () => document.visibilityState === "visible" && wake();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, []);

  function syncAll() {
    void divan.syncNow();
    void reactions.syncNow();
    void scores.flush();
    void myStats.refresh();
    void avatar.reconcile(session.user);
    void friends.refreshUnread();
  }

  return null;
}
