/**
 * The letters of مشاعره, by the rules of the server (`apps/server/src/persian.ts`): no diacritics, a lone hamza or tatweel, no digits, punctuation, spaces or
 * half-spaces; ي ى ئ → ی, ك → ک, أ إ آ ٱ → ا, ة ۀ → ه. A couplet starts with the first letter of its first hemistich and ends with the last letter of its
 * second (Play/MoshLetters.swift).
 */
const folded: Record<number, string> = { 0x064a: "ی", 0x0649: "ی", 0x0626: "ی", 0x0643: "ک", 0x0622: "ا", 0x0623: "ا", 0x0625: "ا", 0x0671: "ا", 0x0629: "ه", 0x06c0: "ه" };

/** The letter of a character, folded as above; undefined for what is skipped (marks, digits, punctuation, spaces and the half-space, a lone hamza, tatweel). */
function letter(character: string): string | undefined {
  if (!/^\p{L}$/u.test(character)) return undefined;
  const code = character.codePointAt(0)!;
  if (code === 0x0621 || code === 0x0640) return undefined;
  return folded[code] ?? character.toLowerCase();
}

/** The letters of a text, folded as above. */
export const letters = (text: string): string[] => [...text].flatMap((character) => letter(character) ?? []);

/** The letter a couplet starts with (its first hemistich), undefined when the text has none. */
export const firstLetter = (m1: string): string | undefined => letters(m1)[0];

/** The letter a couplet ends with (its second hemistich), undefined when the text has none. */
export const lastLetter = (m2: string): string | undefined => letters(m2).at(-1);

/** Where the last letter of a text is, with the marks that go with it (UTF-16 offsets), for the highlight in the last couplet. */
export function lastLetterRange(text: string): { start: number; end: number } | undefined {
  const clusters = [...new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(text)];
  const last = clusters.findLast(({ segment }) => letters(segment).length > 0);
  return last && { start: last.index, end: last.index + last.segment.length };
}

/** Where the first `count` letters of a hemistich end (UTF-16 offset, with the marks that go with the last): what a suggestion has in common with what is typed. 0 when there is no letter. */
export function prefixEnd(text: string, count: number): number {
  let seen = 0;
  let end = 0;
  for (const { segment, index } of new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(text)) {
    if (seen >= count) break;
    if (letters(segment).length > 0) seen += 1;
    end = index + segment.length;
  }
  return seen > 0 ? end : 0;
}
