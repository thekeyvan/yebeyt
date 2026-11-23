/**
 * Tehran days and weeks. Iran has had no daylight saving since 2022, so Tehran is a fixed UTC+03:30.
 *
 * A week runs Saturday 00:00 to Friday 24:00 Tehran time. Its id is the ISO 8601 week id (`2026-W47`) of the same week
 * moved two days later, so Saturday plays Monday: the week's number and year follow the ISO rule (week 1 holds the first
 * Thursday of the shifted week's year). Ids sort as text.
 */
const OFFSET_MS = 3.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** The Tehran calendar day of an instant, as yyyy-mm-dd. */
export const tehranDate = (at: Date): string => new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** True for a yyyy-mm-dd text that is a real calendar day. */
export function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(text);
}

/** The id of the Tehran week an instant falls in. */
export function weekOf(at: Date): string {
  const localDay = Math.floor((at.getTime() + OFFSET_MS) / DAY_MS) * DAY_MS;
  const shifted = localDay + 2 * DAY_MS;
  const mondayBased = (new Date(shifted).getUTCDay() + 6) % 7;
  const thursday = shifted - mondayBased * DAY_MS + 3 * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The instant a week starts: Saturday 00:00 in Tehran. */
export function weekStart(week: string): Date {
  const [, year, number] = /^(\d{4})-W(\d{2})$/.exec(week) ?? [];
  if (!year || !number) throw new Error("bad week id");
  const jan4 = Date.UTC(Number(year), 0, 4);
  const firstMonday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS;
  const saturday = firstMonday + (Number(number) - 1) * 7 * DAY_MS - 2 * DAY_MS;
  return new Date(saturday - OFFSET_MS);
}

/** The instant the week ends (the next week starts). */
export const weekEnd = (week: string): Date => new Date(weekStart(week).getTime() + 7 * DAY_MS);

export const previousWeek = (week: string): string => weekOf(new Date(weekStart(week).getTime() - 1));
