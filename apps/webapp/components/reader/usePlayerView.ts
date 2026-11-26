"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { PlayerView, RecitationPlayer } from "../../lib/reader/player";

const noPlayer = { subscribe: () => () => {}, snapshot: (): PlayerView | undefined => undefined };

/** What the player shows now; undefined until the poem is open and the player made. */
export function usePlayerView(player?: RecitationPlayer): PlayerView | undefined {
  const source = player ?? noPlayer;
  return useSyncExternalStore(source.subscribe, source.snapshot, () => undefined);
}

/**
 * The lock screen and the media keys (`MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` on iOS): the poem's title and the poet while
 * the recitation plays or is paused, and play and pause from outside the page.
 */
export function useMediaSession(player: RecitationPlayer | undefined, view: PlayerView | undefined, title: string, artist: string) {
  const state = view?.state;
  useEffect(() => {
    if (!player || !("mediaSession" in navigator) || state === undefined) return;
    const session = navigator.mediaSession;
    if (state === "idle" || state === "loading") {
      session.metadata = null;
      session.playbackState = "none";
      return;
    }
    session.metadata = new MediaMetadata({ title, artist });
    session.playbackState = state;
    session.setActionHandler("play", () => state === "paused" && player.toggle());
    session.setActionHandler("pause", () => state === "playing" && player.toggle());
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
    };
  }, [player, state, title, artist]);
}
