"use client";

import { useSyncExternalStore } from "react";
import { devPagesEnabled } from "../dev";
import { seedDivan } from "../me/seed";
import { ReaderMarks } from "./marks";
import { defaultSettings, TextSettingsStore, type TextSettings } from "./settings";

// What the reader keeps in this browser: the text settings and the marks, in localStorage (made when first asked for, in the browser only).
let settings: TextSettingsStore | undefined;
let marks: ReaderMarks | undefined;

const settingsStore = (): TextSettingsStore => (settings ??= new TextSettingsStore(localStorage));
/** The marks of this browser (also what the account syncs). A debug build can be told to keep sample couplets first (`sessionStorage.beytSeedDivan = "1"`, the phone's `-beytSeedDivan 1`). */
export function marksStore(): ReaderMarks {
  if (!marks) {
    marks = new ReaderMarks(localStorage);
    if (devPagesEnabled() && sessionStorage.getItem("beytSeedDivan") === "1") seedDivan(marks);
  }
  return marks;
}

/** The text settings, and the way to change them. On the server (and while hydrating) they are the defaults. */
export function useTextSettings(): [TextSettings, (change: Partial<TextSettings>) => void] {
  const current = useSyncExternalStore((listener) => settingsStore().subscribe(listener), () => settingsStore().snapshot(), () => defaultSettings);
  return [current, (change) => settingsStore().update(change)];
}

/** The reader's marks; the component draws again when they change. Only for what is drawn after the poem has loaded in the browser. */
export function useMarks(): ReaderMarks {
  const store = marksStore();
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
