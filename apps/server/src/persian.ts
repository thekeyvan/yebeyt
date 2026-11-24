/** Persian text as the games compare it. Mirrors the phone's `TextNormalizer` and `PersianLetters` (apps/ios). */

/** The letters that count as another letter: Arabic ي ى and ئ → ی, ك → ک, أ إ آ ٱ → ا, ة and ۀ → ه. */
const FOLD: Record<string, string> = {
  "\u064A": "\u06CC",
  "\u0649": "\u06CC",
  "\u0626": "\u06CC",
  "\u0643": "\u06A9",
  "\u0622": "\u0627",
  "\u0623": "\u0627",
  "\u0625": "\u0627",
  "\u0671": "\u0627",
  "\u0629": "\u0647",
  "\u06C0": "\u0647",
};

/** Hamza on its own (ء) and tatweel are skipped like a diacritic. */
const SKIPPED = /[\p{M}\u0621\u0640]/u;

/** The letters of a text, folded as above: no diacritics, digits, punctuation, spaces or half-spaces. */
export function letters(text: string): string[] {
  const result: string[] = [];
  for (const ch of text) {
    if (SKIPPED.test(ch) || !/\p{L}/u.test(ch)) continue;
    result.push(FOLD[ch] ?? ch.toLowerCase());
  }
  return result;
}

/** The letter a couplet starts with (its first hemistich), or undefined when the text has none. */
export const firstLetter = (m1: string): string | undefined => letters(m1)[0];

/** The letter a couplet ends with (its second hemistich), or undefined when the text has none. */
export const lastLetter = (m2: string): string | undefined => letters(m2).at(-1);

/**
 * A text made comparable: no diacritics or tatweel, letters folded as above, digits as 0 to 9, a half-space or punctuation as a space,
 * lower case, one space between words.
 */
export function normalizeText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640) continue;
    if (code === 0x200c || code === 0x200d) out += " ";
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (/\p{P}/u.test(ch)) out += " ";
    else out += FOLD[ch] ?? ch;
  }
  return out.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}
