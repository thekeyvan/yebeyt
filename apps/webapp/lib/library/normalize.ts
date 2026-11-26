// The one text normalisation used for matching (Search/TextNormalizer.swift): search, mood words, section search.
// The server's `normalizeText` does the same.

const replaced = (code: number): string | undefined => {
  if (code === 0x064a || code === 0x0649 || code === 0x0626) return "\u06CC"; // ي ى ئ → ی
  if (code === 0x0643) return "\u06A9"; // ك → ک
  if ([0x0622, 0x0623, 0x0625, 0x0671].includes(code)) return "\u0627"; // آ أ إ ٱ → ا
  if (code === 0x0629 || code === 0x06c0) return "\u0647"; // ة ۀ → ه
  if (code === 0x200c || code === 0x200d) return " "; // ZWNJ and ZWJ
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  return undefined;
};

/** Diacritics (the Arabic marks and the dagger alef) and tatweel: shown text keeps Ganjoor's marks, matching drops them. */
const isMark = (code: number): boolean => (code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640;

/** No diacritics or tatweel, Arabic ي/ى/ئ → ی, ك → ک, ZWNJ → space, آ/أ/إ/ٱ → ا, ة/ۀ → ه, Persian and Arabic digits → 0–9, punctuation → space, lower case, single spaces. */
export function normalize(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (isMark(code)) continue;
    result += replaced(code) ?? (/\p{P}/u.test(char) ? " " : char);
  }
  return result.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

/** The text without diacritics and tatweel, for list rows (the first lines of the index keep Ganjoor's marks). */
export const plain = (text: string): string => [...text].filter((char) => !isMark(char.codePointAt(0)!)).join("");

/** Whether `text` contains `query` once both are normalised. An empty query matches nothing. */
export function contains(text: string, query: string): boolean {
  const wanted = normalize(query);
  return wanted !== "" && normalize(text).includes(wanted);
}
