import { persianDigits } from "../persian";

/** The Tehran day is the one the whole app goes by: the same couplet for everyone, changing at Tehran's midnight. */
const tehran = "Asia/Tehran";

/** The date line of the home screen, in the Persian calendar: «دوشنبه ۲ آذر» (Home/PersianDate.swift). */
export function dateLine(date: Date, timeZone = tehran): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone, weekday: "long", day: "numeric", month: "long" }).formatToParts(date);
  const text = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${text("weekday")} ${persianDigits(Number(text("day")))} ${text("month")}`;
}

/** The day as a number (days since 1 January 1970 in `timeZone`) that changes at its midnight (`DailyPick.dayNumber`). */
export function dayNumber(date: Date, timeZone = tehran): number {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone }).format(date).split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
