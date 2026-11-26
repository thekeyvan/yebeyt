import { dayNumber } from "../library/date";
import { persianDigits } from "../persian";

/** «۲۴ آبان»: the day and the month in the Persian calendar (Home/PersianDate.swift `short`). `timeZone` is the device's, unless a test gives one. */
export function shortDate(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone, day: "numeric", month: "long" }).formatToParts(date);
  const text = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${persianDigits(Number(text("day")))} ${text("month")}`;
}

/** «امروز», «دیروز», «هفته‌ی پیش» (up to a week ago), then the date: «۲۴ آبان» (`DivanDays.relative`). */
export function relativeDay(keptAt: number, now: Date, timeZone?: string): string {
  const kept = new Date(keptAt);
  const days = dayNumber(now, timeZone) - dayNumber(kept, timeZone);
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  if (days <= 7) return "هفته‌ی پیش";
  return shortDate(kept, timeZone);
}
