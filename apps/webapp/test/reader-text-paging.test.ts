import { describe, expect, it } from "vitest";
import { persianClock } from "../lib/persian";
import { above, below, clamp, dragStep, keyStep, nearestToTop, next, previous } from "../lib/reader/paging";
import { caption, copyText, progress, progressLabel, shareText, shortTitle, subtitle } from "../lib/reader/text";

describe("ReaderText", () => {
  const couplet = { m1: "بده ساقی می باقی", m2: "کنار آب رکن آباد" };

  it("drops the word «شمارهٔ» from a title", () => {
    expect(shortTitle("غزل شمارهٔ ۳")).toBe("غزل ۳");
    expect(shortTitle("رباعی شمارهٔ ۱۲")).toBe("رباعی ۱۲");
    expect(shortTitle("بخش ۲ - در ستایش")).toBe("بخش ۲ - در ستایش");
  });

  it("writes the subtitle as poet and book", () => {
    expect(subtitle("حافظ", "غزلیات")).toBe("حافظ · غزلیات");
    expect(subtitle("حافظ")).toBe("حافظ");
  });

  it("writes progress with «از», never a slash", () => {
    expect(progress(1, 9)).toBe("۲ از ۹");
    expect(progress(0, 12)).toBe("۱ از ۱۲");
    expect(progress(1, 9)).not.toContain("/");
    expect(progressLabel(1, 9)).toBe("بیت ۲ از ۹");
  });

  it("ends the share text with the site address and the copy text with the poet", () => {
    expect(shareText(couplet, "حافظ", "غزل ۳")).toBe("بده ساقی می باقی\nکنار آب رکن آباد\n— حافظ · غزل ۳\nyebeyt.com");
    expect(copyText(couplet, "حافظ")).toBe("بده ساقی می باقی\nکنار آب رکن آباد\n— حافظ");
  });

  it("has no empty line for a single-line couplet", () => {
    const single = { m1: "یک خط", m2: "" };
    expect(copyText(single, "نیما")).toBe("یک خط\n— نیما");
    expect(shareText(single, "نیما", "شعر")).toBe("یک خط\n— نیما · شعر\nyebeyt.com");
  });

  it("numbers the caption's couplet from one", () => {
    expect(caption("حافظ", "غزل ۳", 1)).toBe("حافظ · غزل ۳ · بیت ۲");
  });

  it("writes the time of the seek bar in minutes and seconds, in Persian digits", () => {
    expect([persianClock(0), persianClock(42.9), persianClock(88), persianClock(600), persianClock(-3)]).toEqual(["۰:۰۰", "۰:۴۲", "۱:۲۸", "۱۰:۰۰", "۰:۰۰"]);
  });
});

describe("couplet paging (Reader/CoupletPaging.swift)", () => {
  it("keeps an index inside the couplets", () => {
    expect([clamp(3, 9), clamp(-2, 9), clamp(9, 9), clamp(40, 9), clamp(5, 0)]).toEqual([3, 0, 8, 8, 0]);
  });

  it("stops next and previous at the ends", () => {
    expect([next(1, 3), next(2, 3), previous(1, 3), previous(0, 3)]).toEqual([2, 2, 0, 0]);
  });

  it("shows the nearest hemistichs of the neighbours", () => {
    const couplets = [
      { m1: "الف", m2: "ب" },
      { m1: "پ", m2: "ت" },
      { m1: "ث", m2: "ج" },
      { m1: "نثر", m2: "" },
    ];
    expect([above(1, couplets), below(1, couplets), above(0, couplets), below(3, couplets)]).toEqual(["ب", "ث", undefined, undefined]);
    expect(above(3, couplets)).toBe("ج");
    expect(below(2, couplets)).toBe("نثر");
  });

  it("takes the first row still on screen as the one at the top", () => {
    const rows = [
      { index: 2, minY: 170, maxY: 310 },
      { index: 0, minY: -190, maxY: -10 },
      { index: 1, minY: 10, maxY: 150 },
    ];
    expect(nearestToTop(rows)).toBe(1);
    expect(nearestToTop([{ index: 0, minY: -60, maxY: 80 }, { index: 1, minY: 95, maxY: 235 }])).toBe(0);
    expect(nearestToTop([{ index: 0, minY: -110, maxY: 30 }, { index: 1, minY: 45, maxY: 185 }])).toBe(1);
    expect(nearestToTop([])).toBeUndefined();
  });
});

describe("the direction of paging", () => {
  it("makes the next couplet a swipe up, as the page scrolls on iOS, and the previous one a swipe down", () => {
    expect(dragStep(-120, 0, 600)).toBe(1);
    expect(dragStep(120, 0, 600)).toBe(-1);
  });

  it("needs a long enough drag, or a quick flick", () => {
    expect(dragStep(-40, 0, 600)).toBe(0);
    expect(dragStep(-40, -0.8, 600)).toBe(1);
    expect(dragStep(40, 0.8, 600)).toBe(-1);
    expect(dragStep(0, 0, 600)).toBe(0);
  });

  it("makes ← next and → previous in right-to-left, and ↓ and ↑ the same", () => {
    expect([keyStep("ArrowLeft"), keyStep("ArrowDown"), keyStep("PageDown")]).toEqual([1, 1, 1]);
    expect([keyStep("ArrowRight"), keyStep("ArrowUp"), keyStep("PageUp")]).toEqual([-1, -1, -1]);
    expect(keyStep("Enter")).toBe(0);
  });
});
