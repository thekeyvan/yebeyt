const digits = "۰۱۲۳۴۵۶۷۸۹";

/** 2480 → «۲۴۸۰», or with `grouped` «۲٬۴۸۰»: counts shown to people use Persian digits and the Persian thousands separator. */
export function persianDigits(count: number, { grouped = false } = {}): string {
  const text = grouped ? String(count).replace(/\B(?=(\d{3})+$)/g, "٬") : String(count);
  return text.replace(/\d/g, (digit) => digits[Number(digit)] ?? digit);
}

/** «۰:۴۲» for 42 seconds, «۱:۲۸» for 88: the time on the seek bar and the game clock, minutes and seconds. */
export function persianClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${persianDigits(Math.floor(whole / 60))}:${persianDigits(whole % 60).padStart(2, "۰")}`;
}

/** The text of the «پیام‌ها» badge; null (no badge) when nothing is unread. */
export const unreadText = (unread: number): string | null => (unread > 0 ? persianDigits(unread) : null);
