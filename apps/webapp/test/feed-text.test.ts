import { describe, expect, it } from "vitest";
import { action, coupletRoute, dailyDay, isTodaysDaily, relativeTime } from "../lib/friends/feedText";
import type { FeedItem } from "../lib/friends/models";

// Friends/Feed/FeedText.swift: the words of a feed item. The day is Tuesday 24 November 2026, 12:00 in Tehran.
const now = new Date("2026-11-24T08:30:00.000Z");
const user = { username: "kian_k", displayName: "کیان", avatar: null };
const item = (extra: Partial<FeedItem>): FeedItem => ({ type: "like", user, at: "2026-11-24T08:00:00.000Z", ...extra });

describe("the words of a feed item", () => {
  it("says what the friend did", () => {
    expect(action(item({ type: "repost" }), now)).toBe("یه بیت به اشتراک گذاشت");
    expect(action(item({ type: "like" }), now)).toBe("یه بیت پسندید");
  });

  it("names the day of a daily result: today, yesterday, else the date", () => {
    expect(dailyDay("2026-11-24", now)).toBe("امروز");
    expect(dailyDay("2026-11-23", now)).toBe("دیروز");
    expect(dailyDay("2026-11-20", now)).toBe("۲۹ آبان");
    expect(dailyDay(undefined, now)).toBe("امروز");
    expect(dailyDay("garbage", now)).toBe("امروز");
    expect(action(item({ type: "daily", date: "2026-11-23", tries: 2 }), now)).toBe("معمای دیروز رو با ۲ فرصت حل کرد");
    expect(action(item({ type: "daily", date: "2026-11-24" }), now)).toBe("معمای امروز رو با ۱ فرصت حل کرد");
  });

  it("«تو هم» is for today's puzzle only", () => {
    expect(isTodaysDaily(item({ type: "daily", date: "2026-11-24" }), now)).toBe(true);
    expect(isTodaysDaily(item({ type: "daily", date: "2026-11-23" }), now)).toBe(false);
    expect(isTodaysDaily(item({ type: "like", date: "2026-11-24" }), now)).toBe(false);
    expect(isTodaysDaily(item({ type: "daily" }), now)).toBe(false);
  });

  it("reads the poem and couplet of a key, and refuses what is not one", () => {
    expect(coupletRoute("/hafez/ghazal/sh3#1")).toEqual({ path: "/hafez/ghazal/sh3", couplet: 1 });
    for (const key of ["", "#1", "/#1", "hafez/ghazal/sh3#1", "/hafez/ghazal/sh3", "/hafez/ghazal/sh3#x", "/hafez/ghazal/sh3#-1", "/hafez/ghazal/sh3#"]) expect(coupletRoute(key), key).toBeUndefined();
  });

  it("says how long ago, in Persian digits", () => {
    const at = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
    expect(relativeTime(at(30), now)).toBe("همین الان");
    expect(relativeTime(at(600), now)).toBe("۱۰ دقیقه پیش");
    expect(relativeTime(at(3600), now)).toBe("یک ساعت پیش");
    expect(relativeTime(at(3 * 3600), now)).toBe("۳ ساعت پیش");
    expect(relativeTime(at(30 * 3600), now)).toBe("دیروز");
    expect(relativeTime(at(3 * 86_400), now)).toBe("۳ روز پیش");
    expect(relativeTime(at(10 * 86_400), now)).toBe("۲۳ آبان");
    expect(relativeTime(at(-500), now)).toBe("همین الان"); // a clock a little behind the server's
    expect(relativeTime("not a time", now)).toBe("");
  });
});
