import { describe, expect, it } from "vitest";
import { contains, normalize, plain } from "../lib/library/normalize";

// The tests of YebeytTests/TextNormalizerTests.swift.
describe("normalize", () => {
  it("removes diacritics and tatweel", () => {
    expect(normalize("اَلا یا اَیُّهَا السّاقی")).toBe("الا یا ایها الساقی");
    expect(normalize("عـشـق")).toBe("عشق");
  });

  it("unifies Arabic letters with Persian ones", () => {
    expect(normalize("كتاب")).toBe("کتاب");
    expect(normalize("علي")).toBe("علی");
    expect(normalize("موسى")).toBe("موسی");
  });

  it("turns a ZWNJ into a space", () => {
    expect(normalize("می\u200Cرود")).toBe("می رود");
    expect(normalize("می\u200C\u200C رود")).toBe("می رود");
  });

  it("turns alef with madda into alef", () => {
    expect(normalize("آرام")).toBe("ارام");
    expect(normalize("کآرام")).toBe("کارام");
  });

  it("turns digits Latin and punctuation into spaces", () => {
    expect(normalize("غزل ۱۲ و ٣")).toBe("غزل 12 و 3");
    expect(normalize("کجایی؟ «من»، تو!")).toBe("کجایی من تو");
  });

  it("collapses spaces and lowercases", () => {
    expect(normalize("  Hafez \n  Shirazi ")).toBe("hafez shirazi");
    expect(normalize("")).toBe("");
  });

  it("also unifies teh marbuta, heh with yeh above and the hamza forms", () => {
    expect(normalize("رحمة ۀ")).toBe("رحمه ه");
    expect(normalize("مسأله إن ٱلله")).toBe("مساله ان الله");
  });
});

describe("contains", () => {
  it("matches across spellings", () => {
    expect(contains("ای ساربان آهسته رو کآرام جانم می‌رود", "ارام جانم")).toBe(true);
    expect(contains("می‌رود", "می رود")).toBe(true);
    expect(contains("عشق", "عشق")).toBe(true);
    expect(contains("عشق", "عاشق")).toBe(false);
  });

  it("matches nothing for an empty query", () => {
    expect(contains("عشق", "")).toBe(false);
    expect(contains("عشق", " ؟ ")).toBe(false);
  });
});

describe("plain", () => {
  it("only removes the marks", () => {
    expect(plain("اَلا یا اَیُّهَا السّاقی اَدِرْ کَأسَاً")).toBe("الا یا ایها الساقی ادر کأسا");
    expect(plain("می\u200Cرود، آي")).toBe("می\u200Cرود، آي");
  });
});
