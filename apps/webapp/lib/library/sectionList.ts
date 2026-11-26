import { normalize } from "./normalize";
import type { IndexedPoem } from "./bookIndex";

export type SectionSort = "number" | "lastLetter" | "popularity";

/** The sorts of the section screen, in order, with the board's titles. */
export const sectionSorts: { sort: SectionSort; title: string }[] = [
  { sort: "number", title: "شماره" },
  { sort: "lastLetter", title: "حرف آخر" },
  { sort: "popularity", title: "پرخواننده" },
];

/** The Persian alphabet in dictionary order, for sorting by the last letter of the rhyme: the hamza follows alef, and waw with hamza follows waw. */
const alphabet = [..."اءبپتثجچحخدذرزژسشصضطظعغفقکگلمنوؤهی"];

/**
 * The rhyme's letters from the last backwards as alphabet places, then an end marker (-1) that sorts before every letter, so «ا» comes before
 * «ارا». A poem without a rhyme goes last; letters outside the alphabet go after all letters.
 */
export function rhymeKey(rhyme: string): number[] {
  const letters = [...normalize(rhyme)].filter((letter) => letter !== " ");
  if (letters.length === 0) return [Number.MAX_SAFE_INTEGER];
  const places = letters.reverse().map((letter) => {
    const place = alphabet.indexOf(letter === "ئ" ? "ی" : letter);
    return place === -1 ? alphabet.length : place;
  });
  return [...places, -1];
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/** The poems of a section as the section screen lists them, sorted (the book's order by number; most recited first, then by number; or by the alphabet of the rhyme's last letters). */
export function sorted(poems: IndexedPoem[], by: SectionSort): IndexedPoem[] {
  const list = [...poems];
  switch (by) {
    case "number":
      return list.sort((a, b) => a.number - b.number);
    case "popularity":
      return list.sort((a, b) => b.recitations - a.recitations || a.number - b.number);
    case "lastLetter":
      return list.sort((a, b) => compareKeys(a.rhymeKey, b.rhymeKey) || a.number - b.number);
  }
}

/** The poems whose first line contains the query, or whose number it is. */
export function filtered(poems: IndexedPoem[], query: string): IndexedPoem[] {
  const wanted = normalize(query);
  if (wanted === "") return poems;
  const number = /^\d+$/.test(wanted) ? Number(wanted) : undefined;
  return poems.filter((poem) => poem.number === number || poem.searchText.includes(wanted));
}
