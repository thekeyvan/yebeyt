/** Persian letters as the word game sees them (Games/PersianLetters.swift): one letter per box, no diacritics, Arabic forms folded into the Persian ones. آ stays its own letter. */
export const alphabet: readonly string[] = Array.from("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآئؤ");

const edges = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/** The letters of a word (ي ى → ی, ك → ک, أ إ → ا, ة → ه; diacritics and tatweel dropped), or undefined when it holds anything else (digits, a half-space, a hyphen…). Punctuation around the word is ignored. */
export function lettersOf(text: string): string[] | undefined {
  const result: string[] = [];
  for (const char of text.replace(edges, "")) {
    const code = char.codePointAt(0)!;
    if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640) continue;
    if (code === 0x064a || code === 0x0649) result.push("ی");
    else if (code === 0x0643) result.push("ک");
    else if (code === 0x0623 || code === 0x0625) result.push("ا");
    else if (code === 0x0629) result.push("ه");
    else if (alphabet.includes(char)) result.push(char);
    else return undefined;
  }
  return result.length === 0 ? undefined : result;
}

/** The words of a hemistich, split at white space. */
export const wordsOf = (text: string): string[] => text.split(/\s+/).filter(Boolean);
