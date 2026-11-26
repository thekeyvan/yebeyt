const digits = "۰۱۲۳۴۵۶۷۸۹";

/** 2480 → «۲۴۸۰», or with `grouped` «۲٬۴۸۰»: counts shown to people use Persian digits and the Persian thousands separator. */
export function persianDigits(count: number, { grouped = false } = {}): string {
  const text = grouped ? String(count).replace(/\B(?=(\d{3})+$)/g, "٬") : String(count);
  return text.replace(/\d/g, (digit) => digits[Number(digit)] ?? digit);
}

/** The text of the «پیام‌ها» badge; null (no badge) when nothing is unread. */
export const unreadText = (unread: number): string | null => (unread > 0 ? persianDigits(unread) : null);
