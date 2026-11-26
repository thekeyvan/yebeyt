import { mainSection, type LibraryBook } from "./models";
import type { BookIndex, IndexedPoem } from "./bookIndex";

/** «فال حافظ»: a random ghazal of the main section of the book of Hafez (Explore/FalCard.swift); `random` is `Math.random`, or what a test gives. */
export function falPoem(hafez: LibraryBook, index: BookIndex, random: () => number = Math.random): IndexedPoem | undefined {
  const poems = index.poemsIn(mainSection(hafez).id);
  return poems[Math.floor(random() * poems.length)];
}
