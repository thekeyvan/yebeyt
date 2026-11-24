import { describe, expect, it } from "vitest";
import { firstLetter, lastLetter, normalizeText } from "../src/persian.js";

describe("lastLetter and firstLetter", () => {
  const ends: [string, string, string][] = [
    ["plain", "به خال هندویش بخشم سمرقند و بخارا را", "ا"],
    ["diacritics are skipped", "کنارِ آبِ رُکناباد و گُل‌گَشتِ مُصَلّا را", "ا"],
    ["a final mark after the letter", "چو بر آتش نشیند آبَ", "ب"],
    ["آ is ا", "ز عشقت آ", "ا"],
    ["Arabic ي is ی", "ماي", "ی"],
    ["Arabic ى is ی", "موسى", "ی"],
    ["Arabic ك is ک", "ملك", "ک"],
    ["ۀ is ه", "خانۀ", "ه"],
    ["ۀ decomposed (ه and a hamza mark) is ه", "خانه\u0654", "ه"],
    ["ة is ه", "رحمة", "ه"],
    ["ئ is ی", "جزئ", "ی"],
    ["trailing punctuation is skipped", "گفتم که ماه من شو، گفتا اگر برآید؟", "د"],
    ["a trailing half-space and spaces are skipped", "دل مرا\u200c ", "ا"],
    ["a quote and a dash after the line", "رفت «و رفت»…-", "ت"],
    ["a tatweel is skipped", "دلـــ", "ل"],
    ["digits are skipped", "بیت ۱۲", "ت"],
  ];
  for (const [name, text, letter] of ends) it(`ends with ${letter}: ${name}`, () => expect(lastLetter(text)).toBe(letter));

  const starts: [string, string, string][] = [
    ["plain", "اگر آن ترک شیرازی", "ا"],
    ["آ is ا", "آمد بهار", "ا"],
    ["a leading mark and quote", "«دلم» گفت", "د"],
    ["Arabic ي is ی", "يا رب", "ی"],
    ["ئ is ی", "ئاگاه", "ی"],
    ["Arabic ك is ک", "كه", "ک"],
    ["diacritics before the first letter", "ـَبرگ", "ب"],
  ];
  for (const [name, text, letter] of starts) it(`starts with ${letter}: ${name}`, () => expect(firstLetter(text)).toBe(letter));

  it("is undefined for a text with no letter", () => {
    expect(firstLetter("۱۲ ، !")).toBeUndefined();
    expect(lastLetter("")).toBeUndefined();
  });

  it("matches آ-ending and ا-starting couplets", () => expect(lastLetter("بیا")).toBe(firstLetter("آمد")));
});

describe("normalizeText", () => {
  it("makes two spellings of a hemistich equal", () => {
    expect(normalizeText("اگر آن تُرکِ شیرازی، به‌‌ دست‌ آرَد؟")).toBe(normalizeText("اگر ان ترک شیرازي به دست ارد"));
  });
  it("folds ك, ي, digits and whitespace", () => {
    expect(normalizeText("  ملك   ١٢ ۱۲ ")).toBe("ملک 12 12");
  });
  it("keeps different words different", () => {
    expect(normalizeText("دل")).not.toBe(normalizeText("دلا"));
  });
});
