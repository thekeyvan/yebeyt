const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export const persianNumber = (n: number): string => String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!);
