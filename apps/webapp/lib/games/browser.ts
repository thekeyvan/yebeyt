"use client";

import { useEffect } from "react";
import { libraryData, useLoaded, useStore } from "../library/browser";
import { poetryStore } from "../poetry/browser";
import { GameDeck, parseDeck, type GameCouplet } from "./couplet";
import { openingCouplets, type JigsawStart } from "./jigsawStart";
import { GameStats } from "./stats";
import { tehranNow } from "./debug";

let stats: GameStats | undefined;
let deck: Promise<GameDeck> | undefined;
let ready: GameDeck | undefined;

/** What this browser keeps of the games, in localStorage; the day is Tehran's (or the one a debug page is told). */
export const statsStore = (): GameStats => (stats ??= new GameStats(localStorage, () => tehranNow()));

/** The game deck (games.json, copied into /data at build) with the poets' short names from the library; a failed load is tried again next time. */
function gameDeck(): Promise<GameDeck> {
  deck ??= Promise.all([libraryData(), fetch("/data/games.json").then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing bundled file games"))))])
    .then(([{ library }, file]) => (ready = parseDeck(file, (slug) => library.poet(slug)?.name)))
    .catch((error: unknown) => {
      deck = undefined;
      throw error;
    });
  return deck;
}

export const useDeck = () => useLoaded(gameDeck, ready);

/**
 * The stats of this browser; the page draws again when they change. The Tehran day turns by itself while the page stays open (at midnight there, and
 * when the page comes back to the front).
 */
export function useGameStats(): GameStats {
  const store = statsStore();
  useStore(store);
  useEffect(() => {
    const refresh = () => store.refreshToday();
    const timer = setTimeout(refresh, store.secondsUntilNextDay * 1000 + 500);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [store, store.today.number]);
  return store;
}

/** The couplets a round starts with: from the poem of «بازی با این بیت / غزل», with its poet and book from the library. A poem that can't be loaded gives none, and the round is the deck's. */
export async function loadOpening(start: JigsawStart): Promise<GameCouplet[]> {
  if (start.kind === "deck") return [];
  try {
    const [store, { library }] = await Promise.all([poetryStore(), libraryData()]);
    const slug = start.poem.split("/")[1] ?? "";
    return openingCouplets(start, await store.poem(start.poem), { slug, name: library.poet(slug)?.name ?? "" }, library.bookContaining(start.poem)?.title ?? "");
  } catch {
    return [];
  }
}
