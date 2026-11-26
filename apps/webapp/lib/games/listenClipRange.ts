/**
 * Where a گوش کن clip stops, and how it fades out (Games/ListenClipRange.swift). A deck couplet usually carries the end measured in the real audio
 * (`ListenRange`); this is the rule for any other: Ganjoor's marks are approximate, so the clip does not run to the start mark of the second hemistich:
 * it stops inside the silence before it, and fades over its last moments.
 *
 * Measured on 30 Hafez ghazals (Farahandouz, the first recitation in sync; 204 couplets where the silence between the hemistichs could be found, 20 ms
 * energy windows): the second hemistich starts a median 0.4–0.6 s *before* its mark, the silence between the hemistichs is a median 0.2–0.4 s long and
 * lies a median 0.7–1.1 s before the mark. A fixed margin of 0.8 s lands inside the silence most often and leaves the next hemistich out in about four of five.
 */
export const listenClipRange = {
  /** How long before the second hemistich's mark the clip stops, in seconds. */
  margin: 0.8,
  /** The clip is never shorter than this (or than the hemistich itself, when that is shorter). */
  minimumLength: 1.2,
  /** The volume falls from full to nothing over this many seconds before the end, so a stray syllable is not heard: the fade of a clip cut by the margin rule, where the end may still be inside the voice. */
  fade: 0.25,
  /** The fade of a measured clip: it ends 80 ms after the silence begins, so the fade lies wholly in the silence and never touches the voiced last syllable. */
  measuredFade: 0.08,
} as const;

/** The clip's end for a first hemistich read from `start` to the next hemistich's mark `nextMark`. */
export const clipEnd = (start: number, nextMark: number): number => Math.min(nextMark, Math.max(nextMark - listenClipRange.margin, start + listenClipRange.minimumLength));

/** The part of the audio the fade covers: the last `fade` seconds of the clip, but never before its start. */
export const fadeRange = (start: number, end: number, fade: number = listenClipRange.fade): [number, number] => [Math.max(start, end - fade), end];
