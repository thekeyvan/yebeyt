import { describe, expect, it } from "vitest";
import { inviteDisplay, inviteURL, nameProblem, nameProblemMessage, normalizeUsername, problem, problemMessage, suggestionBase, usernameHint } from "../lib/account/usernameRules";

describe("the username rules mirror the server", () => {
  // The same cases as apps/server/test/usernames.test.ts and the phone's UsernameTests: the phone, the web and the server agree.
  const cases: [string, ReturnType<typeof problem>][] = [
    ["ali", undefined], ["hafez_fan", undefined], ["a.b.c", undefined], ["user_123", undefined], ["a".repeat(20), undefined],
    ["a".repeat(21), "too_long"], ["ab", "too_short"], ["", "too_short"],
    ["1abc", "bad_chars"], ["_abc", "bad_chars"], [".abc", "bad_chars"], ["ab..cd", "bad_chars"], ["abc.", "bad_chars"],
    ["ab cd", "bad_chars"], ["علی_علی", "bad_chars"], ["ab-cd", "bad_chars"], ["ABC", "bad_chars"],
    ["yebeyt", "reserved"], ["admin", "reserved"], ["support", "reserved"],
  ];
  it.each(cases)("%j → %s", (name, expected) => {
    expect(problem(name)).toBe(expected);
  });

  it("trims and lower-cases before checking", () => {
    expect(normalizeUsername("  Hafez_Fan ")).toBe("hafez_fan");
    expect(problem(normalizeUsername("ADMIN"))).toBe("reserved");
  });

  it("has the lead's copy for every problem", () => {
    expect(problemMessage).toEqual({
      taken: "قبلاً گرفته شده",
      too_short: "حداقل ۳ حرف",
      too_long: "حداکثر ۲۰ حرف",
      bad_chars: "فقط حروف انگلیسی، عدد، «_» و «.»",
      reserved: "این اسم رزرو شده",
    });
    expect(usernameHint).toBe("حروف انگلیسی، عدد، «_» و «.» · ۳ تا ۲۰ حرف · تا ۳۰ روز نمی‌شه عوضش کرد.");
  });

  it("starts the suggestions from the Latin letters of the name", () => {
    expect(suggestionBase("Niloofar Sh")).toBe("niloofarsh");
    expect(suggestionBase("José 12")).toBe("jose12");
    expect(suggestionBase("42 Ali")).toBe("ali");
    expect(suggestionBase("نیلوفر")).toBe("beyt");
    expect(suggestionBase("a".repeat(40))).toHaveLength(16);
  });

  it("writes the invite link", () => {
    expect(inviteDisplay("niloofar")).toBe("yebeyt.com/i/niloofar");
    expect(inviteURL("niloofar")).toBe("https://yebeyt.com/i/niloofar");
  });
});

describe("the display name rules", () => {
  it("allows up to 30 characters and a ZWNJ, refuses more and control characters", () => {
    expect(nameProblem("")).toBeUndefined();
    expect(nameProblem("نیلوفر")).toBeUndefined();
    expect(nameProblem("می\u200Cخواهم")).toBeUndefined();
    expect(nameProblem("a".repeat(30))).toBeUndefined();
    expect(nameProblem("a".repeat(31))).toBe("too_long");
    expect(nameProblem("a\u0007b")).toBe("control_chars");
    expect(nameProblem("a\u2028b")).toBe("control_chars");
    expect(nameProblemMessage).toEqual({ too_long: "حداکثر ۳۰ حرف", control_chars: "این حرف توی اسم نمی‌شه" });
  });
});
