// Ganjoor's raw JSON for a poem and a category (github.com/ganjoor/ganjoor-data): the only place it is read
// (Poetry/GanjoorRaw.swift). Mirrors `convert_poem` and `group_couplets` in tools/ganjoor/build.py.
import type { Book, Couplet, Poem } from "./models";

export type RawVerse = {
  VOrder: number;
  /** GanjoorService's `VersePosition`: Right, Left, CenteredVerse1, CenteredVerse2, Single, Comment, Paragraph. */
  Position: string;
  Text: string;
  /** Comment verses (editor notes) have none. */
  CoupletIndex?: number;
  CoupletSummary?: string;
};

export type RawPoem = {
  Id: number;
  Title: string;
  FullUrl: string;
  PoemSummary?: string;
  Metre?: { Rhythm?: string };
  Verses: RawVerse[];
};

type RawEntry = { Id: number; Title: string; FullUrl: string };

export type RawCategory = {
  Id: number;
  PoetId?: number;
  Title: string;
  FullUrl: string;
  TableOfContentsStyle: string;
  ChildCats: RawEntry[];
  Poems: RawEntry[];
};

const withoutCarriageReturns = (text: string): string => text.replaceAll("\r", "");

const aiLabel = "هوش مصنوعی:";

/** A Ganjoor note without carriage returns and without the «هوش مصنوعی:» label, and whether it had the label (`split_ai` in tools/ganjoor/couplets.py). */
export function aiNote(raw: string): { text: string; ai: boolean } {
  const note = withoutCarriageReturns(raw);
  return note.startsWith(aiLabel) ? { text: note.slice(aiLabel.length).trim(), ai: true } : { text: note, ai: false };
}

/**
 * Verses → couplets, grouped by `CoupletIndex`, in verse order. Left and CenteredVerse2 are the second hemistich; every other
 * position (Right, Single, Paragraph, …) goes in the first. Comment verses are editor notes, not poem lines, and are dropped.
 * A verse that would fill an occupied slot starts a new couplet.
 */
export function groupCouplets(verses: RawVerse[]): Couplet[] {
  const couplets: Couplet[] = [];
  let index: number | undefined;
  let hasFirst = false;
  let hasSecond = false;
  const ordered = [...verses].filter((verse) => verse.Position !== "Comment").sort((a, b) => a.VOrder - b.VOrder);
  for (const verse of ordered) {
    const isSecond = verse.Position === "Left" || verse.Position === "CenteredVerse2";
    if (couplets.length === 0 || verse.CoupletIndex !== index || (isSecond ? hasSecond : hasFirst)) {
      couplets.push({ m1: "", m2: "" });
      index = verse.CoupletIndex;
      hasFirst = false;
      hasSecond = false;
    }
    const couplet = couplets[couplets.length - 1]!;
    const text = withoutCarriageReturns(verse.Text);
    if (isSecond) {
      couplet.m2 = text;
      hasSecond = true;
    } else {
      couplet.m1 = text;
      hasFirst = true;
    }
    if (couplet.meaning === undefined && verse.CoupletSummary) {
      const note = aiNote(verse.CoupletSummary);
      if (note.text) {
        couplet.meaning = note.text;
        if (note.ai) couplet.ai = true;
      }
    }
  }
  return couplets;
}

export function poemFromRaw(raw: RawPoem): Poem {
  const note = raw.PoemSummary === undefined ? undefined : aiNote(raw.PoemSummary);
  const poem: Poem = { id: raw.Id, title: raw.Title, path: raw.FullUrl, couplets: groupCouplets(raw.Verses) };
  if (note?.text) {
    poem.summary = note.text;
    if (note.ai) poem.summaryAi = true;
  }
  if (raw.Metre?.Rhythm) poem.rhythm = raw.Metre.Rhythm;
  return poem;
}

/** A book with its poem list; each poem's text comes from `poemFromRaw`. */
export function bookFromRaw(raw: RawCategory): Book {
  return {
    id: raw.Id,
    title: raw.Title,
    path: raw.FullUrl,
    poetId: raw.PoetId,
    toc: raw.TableOfContentsStyle,
    poems: raw.Poems.map(({ Id, Title, FullUrl }) => ({ id: Id, title: Title, path: FullUrl })),
    children: raw.ChildCats.map(({ Id, Title, FullUrl }) => ({ id: Id, title: Title, path: FullUrl })),
  };
}
