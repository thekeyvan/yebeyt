import { dateLine } from "../library/date";
import { persianDigits } from "../persian";

const zone = "Asia/Tehran";
/** Tehran is UTC+3:30 all year (no summer time). */
const offsetSeconds = 12_600;
const secondsPerDay = 86_400;

/** A calendar day in Tehran (Games/TehranDay.swift). The daily puzzle and the streak change at Tehran midnight, for everyone. */
export class TehranDay {
  /** @param number Days since 1970-01-01. */
  constructor(readonly number: number) {}

  static of(date: Date): TehranDay {
    return new TehranDay(Math.floor((Math.floor(date.getTime() / 1000) + offsetSeconds) / secondsPerDay));
  }

  /** «2026-11-23»; undefined for anything else, or a date that doesn't exist. */
  static fromKey(key: string): TehranDay | undefined {
    const parts = key.split("-");
    if (parts.length !== 3 || !parts.every((part) => /^\d+$/.test(part))) return undefined;
    const [year, month, day] = parts.map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCFullYear(year);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
    return new TehranDay(date.getTime() / (secondsPerDay * 1000));
  }

  equals(other: TehranDay): boolean {
    return this.number === other.number;
  }

  get previous(): TehranDay {
    return new TehranDay(this.number - 1);
  }

  /** The moment this day began, at midnight in Tehran. */
  get start(): Date {
    return new Date((this.number * secondsPerDay - offsetSeconds) * 1000);
  }

  /** «2026-11-23», the form `beytToday` takes. */
  get key(): string {
    return new Date(this.number * secondsPerDay * 1000).toISOString().slice(0, 10);
  }

  /** Noon in Tehran, for showing the day in the Persian calendar. */
  private get noon(): Date {
    return new Date((this.number * secondsPerDay + secondsPerDay / 2 - offsetSeconds) * 1000);
  }

  /** «دوشنبه ۲ آذر». */
  get line(): string {
    return dateLine(this.noon, zone);
  }

  /** The day and month for the date sticker: «۱» over «آذر». */
  get stickerParts(): { day: string; month: string } {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { timeZone: zone, day: "numeric", month: "long" }).formatToParts(this.noon);
    const text = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return { day: persianDigits(Number(text("day"))), month: text("month") };
  }
}
