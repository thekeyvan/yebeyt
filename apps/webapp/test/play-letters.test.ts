import { describe, expect, it } from "vitest";
import { firstLetter, lastLetter, lastLetterRange, letters, prefixEnd } from "../lib/play/moshLetters";
import { normalize } from "../lib/library/normalize";

// The port of MoshLettersTests.swift: the same table as the server's `test/persian.test.ts`, so the page and the server agree on the letters.

describe("the last letter of a couplet", () => {
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
    ["a trailing half-space and spaces are skipped", "دل مرا\u200C ", "ا"],
    ["a quote and a dash after the line", "رفت «و رفت»…-", "ت"],
    ["a tatweel is skipped", "دلـــ", "ل"],
    ["digits are skipped", "بیت ۱۲", "ت"],
  ];
  it.each(ends)("%s", (_name, text, expected) => expect(lastLetter(text)).toBe(expected));
});

describe("the first letter of a couplet", () => {
  const starts: [string, string, string][] = [
    ["plain", "اگر آن ترک شیرازی", "ا"],
    ["آ is ا", "آمد بهار", "ا"],
    ["a leading mark and quote", "«دلم» گفت", "د"],
    ["Arabic ي is ی", "يا رب", "ی"],
    ["ئ is ی", "ئاگاه", "ی"],
    ["Arabic ك is ک", "كه", "ک"],
    ["diacritics before the first letter", "ـَبرگ", "ب"],
  ];
  it.each(starts)("%s", (_name, text, expected) => expect(firstLetter(text)).toBe(expected));

  it("a text with no letter has none", () => {
    expect(firstLetter("۱۲ ، !")).toBeUndefined();
    expect(lastLetter("")).toBeUndefined();
    expect(letters("د ل")).toEqual(["د", "ل"]);
  });

  it("an alef ending matches an alef with madda start", () => {
    expect(lastLetter("بیا")).toBe(firstLetter("آمد"));
  });
});

describe("the text normaliser the matching uses (the server's `normalizeText` table)", () => {
  it("two spellings of a hemistich normalise alike", () => {
    expect(normalize("اگر آن تُرکِ شیرازی، به‌‌ دست‌ آرَد؟")).toBe(normalize("اگر ان ترک شیرازي به دست ارد"));
  });

  it("Arabic forms and digits fold", () => {
    expect(normalize("  ملك   ١٢ ۱۲ ")).toBe("ملک 12 12");
    expect(normalize("خانۀ جزئی ٱلله")).toBe("خانه جزیی الله");
  });

  it("different words stay different", () => {
    expect(normalize("دل")).not.toBe(normalize("دلا"));
  });
});

describe("where the last letter is", () => {
  it("covers the letter with the marks that go with it", () => {
    const text = "بود، آبَ!";
    const range = lastLetterRange(text)!;
    expect(text.slice(range.start, range.end)).toBe("بَ");
    expect(lastLetterRange("۱۲ !")).toBeUndefined();
  });
});

describe("what a suggestion has in common with the typed text", () => {
  it("is the first letters of the hemistich, with their marks", () => {
    const text = "دَلا نزد کسی";
    expect(text.slice(0, prefixEnd(text, 1))).toBe("دَ");
    expect(text.slice(0, prefixEnd(text, 3))).toBe("دَلا");
    expect(text.slice(0, prefixEnd(text, 4))).toBe("دَلا ن");
    expect(prefixEnd(text, 99)).toBe(text.length);
    expect(prefixEnd("۱۲ !", 2)).toBe(0);
  });
});
