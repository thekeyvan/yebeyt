import { describe, expect, it } from "vitest";
import { feedbackLog, FeedbackLog } from "../lib/feedback/log";
import { screenAt, screenNames } from "../lib/feedback/screens";
import { allowedKeys, coupletKey, networkKind, technicalBody, technicalRows, type TechnicalInfo } from "../lib/feedback/technical";
import { ApiError, messageOf } from "../lib/account/api";

const sample = (extra: Partial<TechnicalInfo> = {}): TechnicalInfo => ({
  screen: "خوندن شعر",
  couplet: "/hafez/ghazal/sh3#0",
  mode: "کل شعر",
  recitationPosition: 3,
  textSettings: { size: 21, font: "پرستو", bold: true, layout: "پلکانی", spacing: "زیاد", theme: "کاغذی" },
  network: "cellular",
  accountState: "signedIn",
  recentErrors: [],
  steps: [],
  ...extra,
});

describe("technical info (TechnicalInfoTests)", () => {
  it("has only the keys the server allows, and leaves empty lists out", () => {
    const full = technicalBody(sample({ recentErrors: ["network"], steps: ["خونه"] }));
    expect(new Set(Object.keys(full))).toEqual(allowedKeys);
    expect(Object.keys(technicalBody(sample()))).not.toContain("steps");
    expect(Object.keys(technicalBody(sample({ textSettings: {} })))).not.toContain("textSettings");
  });

  it("the contract's values come out as written", () => {
    const json = technicalBody(sample());
    expect(json.network).toBe("cellular");
    expect(json.accountState).toBe("signedIn");
    expect(json.recitationPosition).toBe(3);
    expect(json.textSettings).toEqual({ size: 21, font: "پرستو", bold: true, layout: "پلکانی", spacing: "زیاد", theme: "کاغذی" });
    const long = technicalBody(sample({ textSettings: { font: "ق".repeat(60) } })).textSettings as Record<string, string>;
    expect(long.font).toHaveLength(40);
  });

  it("steps are screen names only and both lists stop at twenty", () => {
    const many = Array.from({ length: 40 }, (_, index) => screenNames[index % screenNames.length]!);
    const errors = Array.from({ length: 40 }, (_, index) => `500 error${index}`);
    const json = technicalBody(sample({ steps: many, recentErrors: errors }));
    expect(json.steps).toHaveLength(20);
    expect((json.steps as string[]).every((name) => (screenNames as readonly string[]).includes(name))).toBe(true);
    expect(json.recentErrors).toHaveLength(20);
    expect((json.recentErrors as string[]).at(-1)).toBe("500 error39");
  });

  it("couplet keys follow the contract's pattern", () => {
    expect(coupletKey("/hafez/ghazal/sh3", 0)).toBe("/hafez/ghazal/sh3#0");
    expect(coupletKey("/saadi/ghazal/sh12", 25)).toBe("/saadi/ghazal/sh12#25");
    expect(coupletKey("/حافظ/غزل", 1)).toBeUndefined();
    expect(coupletKey("hafez", 1)).toBeUndefined();
    expect(coupletKey("/hafez", 100000)).toBeUndefined();
  });

  it("the list under «ببین چیه» shows what is sent", () => {
    const rows = technicalRows(sample({ recentErrors: ["429 rate_limited"], steps: ["خونه", "خوندن شعر"] }));
    const value = (label: string) => rows.find((row) => row.label === label)?.value;
    expect(rows[0]).toEqual({ label: "صفحه", value: "خوندن شعر" });
    for (const label of ["بیت", "حالت خوندن", "جای خوانش", "اینترنت", "حساب"]) expect(value(label), label).toBeDefined();
    expect(value("خطاهای اخیر")).toBe("429 rate_limited");
    expect(value("کارهای قبلش")).toBe("خونه، خوندن شعر");
    expect(value("جای خوانش")).toBe("۳ ثانیه");
    expect(value("متن · اندازه")).toBe("۲۱");
    expect(value("متن · پررنگ")).toBe("بله");
    expect(value("حساب")).toBe("واردشده");
    const bare = technicalRows({ screen: "خونه", textSettings: {}, network: "offline", accountState: "guest", recentErrors: [], steps: [] });
    expect(bare.map((row) => row.label)).toEqual(["صفحه", "اینترنت", "حساب", "خطاهای اخیر", "کارهای قبلش"]);
  });

  it("the network kind comes from the browser", () => {
    expect(networkKind(false, "wifi")).toBe("offline");
    expect(networkKind(true, "wifi")).toBe("wifi");
    expect(networkKind(true, "cellular")).toBe("cellular");
    expect(networkKind(true, undefined)).toBe("unknown");
    expect(networkKind(true, "ethernet")).toBe("unknown");
  });
});

describe("the log (FeedbackLogTests)", () => {
  it("the step ring keeps the last twenty screen names and skips repeats", () => {
    const log = new FeedbackLog();
    log.visit("خونه");
    log.visit("خونه");
    expect(log.steps).toEqual(["خونه"]);
    for (let index = 0; index < 30; index++) log.visit(index % 2 === 0 ? "کاوش" : "بازی");
    expect(log.steps).toHaveLength(20);
    expect(log.steps.at(-1)).toBe("بازی");
  });

  it("the error ring keeps the last twenty codes and no messages", () => {
    const log = new FeedbackLog();
    for (let status = 400; status < 430; status++) log.record({ status, code: "rate_limited" });
    expect(log.errors).toHaveLength(20);
    expect(log.errors.at(-1)).toBe("429 rate_limited");
    log.record({ status: 0 });
    log.record({ status: 502 });
    log.record({ status: 418 });
    log.record({ status: 503, code: "busy" });
    expect(log.errors.slice(-4)).toEqual(["network", "bad_response", "418 unknown", "503 busy"]);
  });

  it("showing an error's line notes its code", () => {
    expect(messageOf(new ApiError(0))).toBe(new ApiError(0).persianMessage);
    expect(feedbackLog.errors.at(-1)).toBe("network");
    messageOf(new ApiError(429, "rate_limited"));
    expect(feedbackLog.errors.at(-1)).toBe("429 rate_limited");
  });
});

describe("the screens have names, never typed text", () => {
  it("names the screen at an address", () => {
    const names: [string, string][] = [
      ["/", "خونه"], ["/explore", "کاوش"], ["/games", "بازی"], ["/messages", "پیام‌ها"], ["/me", "من"], ["/poem/hafez/ghazal/sh3", "خوندن شعر"],
      ["/explore/library", "کتابخونه"], ["/explore/book/hafez", "کتاب"], ["/explore/section/hafez/ghazal", "بخش کتاب"], ["/explore/poet/hafez", "صفحه‌ی شاعر"],
      ["/explore/search", "جست‌وجو"], ["/explore/mood/love", "موضوع"], ["/explore/poets", "همه‌ی شاعرها"], ["/games/catalog", "همه‌ی بازی‌ها"],
      ["/games/leaderboard", "رده‌بندی"], ["/games/daily", "معمای امروز"], ["/games/jigsaw", "جورچین بیت"], ["/games/poet", "حدس شاعر"], ["/games/misra", "مصراع دوم"],
      ["/games/book", "از کدوم کتاب؟"], ["/games/match", "معنی‌یاب"], ["/games/listen", "گوش کن"], ["/games/lobby", "بازی با دوست"], ["/games/mosh/g1", "مشاعره"],
      ["/games/duel/d1", "بازی رودررو"], ["/c/7KQ2", "چالش"], ["/me/divan", "دیوان"], ["/me/privacy", "حریم خصوصی"], ["/me/avatar", "چهره"], ["/me/invite", "دعوت دوستان"],
      ["/me/settings", "تنظیمات"], ["/me/badges", "نشان‌ها"], ["/me/licenses", "مجوزها"], ["/me/friends", "دوستا"], ["/messages/requests", "درخواست‌های دوستی"],
      ["/messages/sara", "گفتگو"], ["/messages/sara/divan", "دیوان مشترک"], ["/people", "پیدا کردن دوست"], ["/u/sara", "صفحه‌ی یه آدم"], ["/dev/stickers", "خونه"],
    ];
    for (const [path, name] of names) expect(screenAt(path), path).toBe(name);
  });

  it("every name of the list is one an address can have", () => {
    const reached = new Set(["/", "/explore", "/games", "/messages", "/me", "/poem/a", "/explore/library", "/explore/book/a", "/explore/section/a", "/explore/poet/a", "/explore/search", "/explore/mood/a", "/explore/poets", "/games/catalog", "/me/divan", "/me/privacy", "/me/avatar", "/me/invite", "/me/settings", "/me/badges", "/me/licenses", "/messages/a", "/messages/a/divan", "/people", "/u/a", "/games/leaderboard", "/me/friends", "/messages/requests", "/games/daily", "/games/jigsaw", "/games/poet", "/games/misra", "/games/book", "/games/match", "/games/listen", "/games/lobby", "/games/mosh/a", "/games/duel/a", "/c/abcd"].map(screenAt));
    expect(new Set(screenNames)).toEqual(reached);
  });
});
