import type { ReaderMarks } from "../reader/marks";

const DAY = 86_400_000;

/** Couplets of the bundled books (so they show offline), as the phone's `-beytSeedDivan` keeps them (Debug/DivanSeed.swift). */
export function seedKeys(): string[] {
  const hafez = [["sh1", 0], ["sh1", 2], ["sh3", 0], ["sh3", 1], ["sh3", 5], ["sh2", 0], ["sh2", 3], ["sh4", 0], ["sh4", 2], ["sh5", 0], ["sh6", 0], ["sh7", 1]] as const;
  return [
    ...hafez.map(([poem, couplet]) => `/hafez/ghazal/${poem}#${couplet}`),
    ...[1, 2, 3, 4, 5].map((poem) => `/khayyam/robaee/sh${poem}#0`),
    ...[["sh1", 0], ["sh2", 0], ["sh3", 1]].map(([poem, couplet]) => `/babataher/2beytiha/${poem}#${couplet}`),
  ];
}

const daysAgo = [0, 1, 1, 2, 3, 6, 9, 12, 15, 20];

/** The seeded couplets, each kept on a different day, a minute apart within it. */
export const seedItems = (now: number): { key: string; keptAt: number }[] => seedKeys().map((key, offset) => ({ key, keptAt: now - (daysAgo[offset % daysAgo.length] ?? 0) * DAY - offset * 60_000 }));

/** `sessionStorage.beytSeedDivan = "1"` in a debug build: keeps sample couplets first, for the tests and the screenshots of the divan and the profile. Only couplets the divan has no record of are added. */
export function seedDivan(marks: ReaderMarks, now = Date.now()): void {
  const known = new Set(marks.divanItems().map((item) => item.key));
  marks.applyDivan(seedItems(now).filter((item) => !known.has(item.key)));
}
