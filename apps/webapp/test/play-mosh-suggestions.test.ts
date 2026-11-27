import { describe, expect, it } from "vitest";
import { normalize } from "../lib/library/normalize";
import type { CoupletEntry } from "../lib/library/search";
import type { DivanEntry } from "../lib/me/divanLogic";
import { match, suggestions } from "../lib/play/moshSuggestions";

// The port of MoshSuggestionsTests.swift.

const book = (path: string, index: number, m1: string, m2: string, popularity = 0): CoupletEntry => ({ id: `${path}#${index}`, path, index, couplet: { m1, m2 }, poet: "hafez", title: "غزل ۱", popularity, text: normalize(`${m1} ${m2}`) });
const divanEntry = (path: string, index: number, m1: string, m2: string): DivanEntry => ({ key: `${path}#${index}`, path, index, couplet: { m1, m2 }, poetSlug: "hafez", title: "غزل ۲", keptAt: 1 });

const books = [
  book("/hafez/ghazal/sh1", 0, "دلا نزد کسی بنشین که او از دل خبر دارد", "به زیر کلک نکته‌ها", 5),
  book("/hafez/ghazal/sh2", 0, "دل می‌رود ز دستم صاحب‌دلان خدا را", "دردا که راز پنهان خواهد شد آشکارا", 50),
  book("/hafez/ghazal/sh3", 0, "ألا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول", 90),
  book("/hafez/ghazal/sh4", 0, "یاد باد آن که نهانت نظری با ما بود", "رقم مهر تو بر چهره پیدا بود", 80),
];
const keys = (found: { key: string }[]) => found.map((one) => one.key);
const none = new Set<string>();
const pick = (letter: string | undefined, extra: { typed?: string; divan?: DivanEntry[]; used?: Set<string>; limit?: number } = {}) =>
  keys(suggestions({ letter, typed: extra.typed ?? "", divan: extra.divan ?? [], books, used: extra.used ?? none, limit: extra.limit ?? 10 }));

describe("the couplets to pick from", () => {
  it("come from the divan, then the books by popularity", () => {
    const mine = [divanEntry("/hafez/ghazal/sh9", 2, "دوش دیدم که ملایک در میخانه زدند", "گل آدم بسرشتند")];
    const found = suggestions({ letter: "د", typed: "", divan: mine, books, used: none, limit: 10 });
    expect(keys(found)).toEqual(["/hafez/ghazal/sh9#2", "/hafez/ghazal/sh2#0", "/hafez/ghazal/sh1#0"]);
    expect(found.map((one) => one.inDivan)).toEqual([true, false, false]);
  });

  it("leave out a couplet that starts with another letter", () => expect(pick("ی")).toEqual(["/hafez/ghazal/sh4#0"]));

  it("fold the letters like the server's («ألا» starts with ا)", () => expect(pick("ا")).toEqual(["/hafez/ghazal/sh3#0"]));

  it("leave out the couplets played", () => expect(pick("د", { used: new Set(["/hafez/ghazal/sh2#0"]) })).toEqual(["/hafez/ghazal/sh1#0"]));

  it("offer a couplet of the divan once, and keep the limit", () => {
    const mine = [divanEntry("/hafez/ghazal/sh2", 0, "دل می‌رود ز دستم صاحب‌دلان خدا را", "دردا که راز پنهان خواهد شد آشکارا")];
    expect(pick("د", { divan: mine, limit: 2 })).toEqual(["/hafez/ghazal/sh2#0", "/hafez/ghazal/sh1#0"]);
    expect(pick("د", { divan: mine, limit: 1 })).toHaveLength(1);
  });

  it("narrow to what starts like the typed text", () => expect(pick("د", { typed: "دلا" })).toEqual(["/hafez/ghazal/sh1#0"]));

  it("let the first couplet of a game start with any letter, the most recited first", () => {
    const found = pick(undefined);
    expect(found).toHaveLength(4);
    expect(found[0]).toBe("/hafez/ghazal/sh3#0");
  });
});

describe("typed text", () => {
  const sources = (extra: { divan?: DivanEntry[]; used?: Set<string> } = {}) => ({ letter: "د", divan: extra.divan ?? [], books, used: extra.used ?? none });
  const firstHemistich = "دل می‌رود ز دستم صاحب‌دلان خدا را";

  it("finds the couplet of a whole first hemistich", () => {
    const found = match("دل می رود ز دستم صاحب دلان خدا را", sources());
    expect(found).toMatchObject({ kind: "found", candidate: { key: "/hafez/ghazal/sh2#0" } });
  });

  it("finds a whole couplet in a different spelling", () => {
    expect(match("دَلا نزد كسي بنشين كه او از دل خبر دارد، به زیر کلک نکته‌ها", sources())).toMatchObject({ kind: "found", candidate: { key: "/hafez/ghazal/sh1#0" } });
  });

  it("does not take a text that only begins the hemistich for a couplet", () => {
    expect(match("دل", sources())).toEqual({ kind: "notFound" });
    expect(match("دل می‌رود", sources())).toEqual({ kind: "notFound" });
  });

  it("does not find a text of no book", () => {
    expect(match("دلم می‌خواد یه بیت بگم", sources())).toEqual({ kind: "notFound" });
    expect(match("   ", sources())).toEqual({ kind: "notFound" });
  });

  it("searches the divan too", () => {
    const mine = [divanEntry("/x/y/sh1", 3, "درخت دوستی بنشان که کام دل به بار آرد", "نهال دشمنی برکن")];
    expect(match("درخت دوستی بنشان که کام دل به بار آرد", sources({ divan: mine }))).toMatchObject({ kind: "found", candidate: { inDivan: true } });
  });

  it("says a couplet found with the wrong letter, or played already", () => {
    expect(match(firstHemistich, { ...sources(), letter: "ب" })).toEqual({ kind: "wrongLetter" });
    expect(match(firstHemistich, sources({ used: new Set(["/hafez/ghazal/sh2#0"]) }))).toEqual({ kind: "alreadyPlayed" });
  });
});
