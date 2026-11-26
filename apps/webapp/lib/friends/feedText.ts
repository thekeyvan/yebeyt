import { TehranDay } from "../games/tehranDay";
import { persianDigits } from "../persian";
import type { FeedItem } from "./models";

const zone = "Asia/Tehran";

/** «۲۴ آبان» (Home/PersianDate.swift `short`). */
export function shortDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone: zone, day: "numeric", month: "long" }).formatToParts(date);
  const text = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${persianDigits(Number(text("day")))} ${text("month")}`;
}

/** The day of a daily result: «امروز», «دیروز», else the date «۲۴ آبان» (the server takes results of up to two days ago). */
export function dailyDay(date: string | undefined, now: Date): string {
  const today = TehranDay.of(now);
  const day = date === undefined ? undefined : TehranDay.fromKey(date);
  if (!day || day.equals(today)) return "امروز";
  return day.equals(today.previous) ? "دیروز" : shortDate(new Date(day.start.getTime() + 12 * 3_600_000));
}

/** The line about what the friend did, without their name (Friends/Feed/FeedText.swift). */
export function action(item: FeedItem, now: Date): string {
  switch (item.type) {
    case "repost":
      return "یه بیت به اشتراک گذاشت";
    case "like":
      return "یه بیت پسندید";
    case "daily":
      return `معمای ${dailyDay(item.date, now)} رو با ${persianDigits(item.tries ?? 1)} فرصت حل کرد`;
  }
}

/** «کیان یه بیت به اشتراک گذاشت», for screen readers and tests. */
export const headline = (item: FeedItem, now: Date): string => `${item.user.displayName ?? item.user.username} ${action(item, now)}`;

/** «تو هم» is for today's puzzle only. */
export function isTodaysDaily(item: FeedItem, now: Date): boolean {
  const day = TehranDay.fromKey(item.date ?? "");
  return item.type === "daily" && day !== undefined && day.equals(TehranDay.of(now));
}

/** The poem path and the 0-based couplet of a couplet key «/hafez/ghazal/sh3#1». */
export function coupletRoute(key: string): { path: string; couplet: number } | undefined {
  const hash = key.lastIndexOf("#");
  const text = key.slice(hash + 1);
  const couplet = Number(text);
  const path = key.slice(0, hash);
  return hash >= 0 && /^\d+$/.test(text) && Number.isSafeInteger(couplet) && path.startsWith("/") && path.length > 1 ? { path, couplet } : undefined;
}

/** «همین الان», «۱۰ دقیقه پیش», «یک ساعت پیش», «۳ ساعت پیش», «دیروز», «۳ روز پیش», then the date «۲۴ آبان». */
export function relativeTime(text: string, now: Date): string {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.trunc((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "همین الان";
  if (seconds < 3600) return `${persianDigits(Math.trunc(seconds / 60))} دقیقه پیش`;
  if (seconds < 86_400) {
    const hours = Math.trunc(seconds / 3600);
    return hours === 1 ? "یک ساعت پیش" : `${persianDigits(hours)} ساعت پیش`;
  }
  if (seconds < 172_800) return "دیروز";
  if (seconds < 604_800) return `${persianDigits(Math.trunc(seconds / 86_400))} روز پیش`;
  return shortDate(date);
}
