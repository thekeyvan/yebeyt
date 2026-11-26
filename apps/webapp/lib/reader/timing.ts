import type { Couplet } from "../poetry/models";

/** One verse (a hemistich, numbered from 0) and the millisecond it starts. */
export type Start = { verse: number; milliseconds: number };

export class TimingError extends Error {}

const versesIn = (couplet: Couplet): number => (couplet.m2 ? 2 : 1);

/**
 * Ganjoor's timing file for a recitation (`xmlUrl`): when each verse starts (Reader/RecitationTiming.swift). Two verses make a
 * couplet; a single-line couplet is one verse.
 */
export class RecitationTiming {
  /** In time order. */
  readonly starts: Start[];

  constructor(starts: Start[]) {
    this.starts = [...starts].sort((a, b) => a.milliseconds - b.milliseconds);
  }

  /** Reads the `SyncInfo` entries of the first `PoemAudio` in the file; throws when it has none. */
  static parse(xml: string): RecitationTiming {
    const document = new DOMParser().parseFromString(xml, "text/xml");
    const starts: Start[] = [];
    for (const info of document.querySelector("PoemAudio")?.querySelectorAll("SyncInfo") ?? []) {
      const verse = Number.parseInt(info.querySelector("VerseOrder")?.textContent ?? "", 10);
      const milliseconds = Number.parseInt(info.querySelector("AudioMiliseconds")?.textContent ?? "", 10);
      // Real files end with a marker entry whose VerseOrder is negative (-2); it starts no verse.
      if (verse >= 0 && !Number.isNaN(milliseconds)) starts.push({ verse, milliseconds });
    }
    if (document.querySelector("parsererror") || starts.length === 0) throw new TimingError("no timings");
    return new RecitationTiming(starts);
  }

  /**
   * The couplet being read `seconds` into the audio. Before the first entry it is the first couplet; a verse past the text sticks to
   * the last couplet. Undefined only when there are no couplets.
   */
  couplet(seconds: number, couplets: Couplet[]): number | undefined {
    if (couplets.length === 0) return undefined;
    const milliseconds = Math.round(seconds * 1000); // 1.001 × 1000 is 1000.9999…: a position at a start is that couplet
    const verse = this.starts.findLast((start) => start.milliseconds <= milliseconds)?.verse ?? 0;
    let first = 0;
    for (const [index, couplet] of couplets.entries()) {
      first += versesIn(couplet);
      if (verse < first) return index;
    }
    return couplets.length - 1;
  }

  /**
   * The seconds a couplet starts being read: the start of its first verse. The inverse of `couplet`. Undefined when the couplet is
   * not in the text or its verse has no timing.
   */
  start(index: number, couplets: Couplet[]): number | undefined {
    if (index < 0 || index >= couplets.length) return undefined;
    const verse = couplets.slice(0, index).reduce((count, couplet) => count + versesIn(couplet), 0);
    const start = this.starts.find((entry) => entry.verse === verse);
    return start && start.milliseconds / 1000;
  }
}
